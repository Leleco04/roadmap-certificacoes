import { expect, type BrowserContext, type Page } from '@playwright/test'
import type { CertificationStatus } from '../src/domain/models'

export const A = '00000000-0000-4000-8000-0000000000a6'
export const B = '00000000-0000-4000-8000-0000000000b6'
export const key = 'roadmap-certificacoes.progress'
export const identity = 'microsoft:ai-103'
export interface Row { user_id: string; certification_id: string; status: CertificationStatus; created_at: string; updated_at: string }
export const row = (user: string, status: CertificationStatus, date = '2020-01-01T00:00:00.000Z', id = identity): Row => ({ user_id: user, certification_id: id, status, created_at: date, updated_at: date })

// Real Auth/PostgREST SDK requests; only the external HTTP boundary is replaced.
// These fixtures neither validate JWT signatures nor substitute for SQL RLS tests.
export async function backend(context: BrowserContext, rows: Row[] = []) {
  const writes: Row[][] = []
  const requests: string[] = []
  let account = A
  let offline = false
  let denied = false
  let authError = false
  let expired = false
  let hold: Promise<void> | null = null
  let release = () => {}
  let lastTime = Date.now()
  await context.route('https://quality.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'Date', Date: new Date().toUTCString() }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.endsWith('/authorize')) {
      account = url.searchParams.get('provider') === 'github' ? B : A
      expect(url.searchParams.get('code_challenge_method')).toBe('s256')
      const redirect = new URL(url.searchParams.get('redirect_to') ?? '')
      redirect.searchParams.set(authError ? 'error_description' : 'code', authError ? 'secret-token-must-not-be-shown' : 'quality-code')
      return route.fulfill({ status: 302, headers: { ...headers, location: redirect.href } })
    }
    if (url.pathname.endsWith('/token')) {
      if (expired && url.searchParams.get('grant_type') === 'refresh_token') return route.fulfill({ status: 400, headers, json: { code: 'refresh_token_not_found', error: 'invalid_grant', message: 'Refresh token invalid' } })
      const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const user = { id: account, aud: 'authenticated', email: `${account === A ? 'a' : 'b'}@example.test`, app_metadata: { provider: account === A ? 'google' : 'github' }, user_metadata: { full_name: '<img src=x onerror=alert(1)>' + 'Nome longo '.repeat(15) }, created_at: new Date().toISOString() }
      return route.fulfill({ headers, json: { access_token: `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment({ sub: account, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user } })
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers })
    expect(url.pathname).toBe('/rest/v1/user_cert_progress')
    requests.push(request.method())
    if (offline) return route.abort('internetdisconnected')
    if (denied) return route.fulfill({ status: 403, headers, json: { code: '42501', message: 'fixture-secret-token' } })
    const token = request.headers().authorization?.split('.')[1]
    const claims: { sub: string } = JSON.parse(Buffer.from(token ?? '', 'base64url').toString())
    if (request.method() === 'GET') {
      expect(url.searchParams.get('user_id')).toBe(`eq.${claims.sub}`)
      return route.fulfill({ headers, json: rows.filter((item) => item.user_id === claims.sub) })
    }
    expect(request.method()).toBe('POST')
    expect(url.searchParams.get('on_conflict')).toBe('user_id,certification_id')
    const submitted: Pick<Row, 'user_id' | 'certification_id' | 'status'>[] = request.postDataJSON()
    const acknowledged = submitted.map((item) => {
      expect(item.user_id).toBe(claims.sub)
      lastTime = Math.max(Date.now(), lastTime + 1)
      return row(item.user_id, item.status, new Date(lastTime).toISOString(), item.certification_id)
    })
    writes.push(acknowledged)
    if (hold) await hold
    for (const item of acknowledged) {
      const previous = rows.findIndex((value) => value.user_id === item.user_id && value.certification_id === item.certification_id)
      if (previous < 0) rows.push(item)
      else rows[previous] = item
    }
    try { await route.fulfill({ headers, json: acknowledged }) } catch { /* A cancelled request may already be closed. */ }
  })
  return {
    rows, writes, requests,
    offline: (value: boolean) => { offline = value },
    denied: (value: boolean) => { denied = value },
    authError: () => { authError = true },
    expire: () => { expired = true },
    pauseWrites: () => { hold = new Promise<void>((resolve) => { release = resolve }) },
    resume: () => { hold = null; release() },
  }
}

export async function seed(context: BrowserContext, value: unknown = { version: 1, progress: {} }) {
  await context.addInitScript(({ storageKey, text }) => {
    if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, text)
  }, { storageKey: key, text: JSON.stringify(value) })
}
export const status = (page: Page, code = 'AI-103') => page.getByLabel(`Status de ${code}`, { exact: true })
export async function login(page: Page, provider: 'Google' | 'GitHub' = 'Google') {
  await page.getByRole('button', { name: `Entrar com ${provider}`, exact: true }).click()
  await expect(page.getByText('Conta conectada', { exact: true })).toBeVisible()
}
export async function synced(page: Page) {
  await expect(page.getByText('Progresso sincronizado.', { exact: true })).toBeVisible()
}
