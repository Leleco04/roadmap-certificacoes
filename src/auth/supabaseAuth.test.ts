import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { browserAuthService, createSupabaseAuthGateway, readAuthConfiguration } from './supabaseAuth'

const projectUrl = 'https://p4-test.supabase.co'
const publicKey = 'sb_publishable_test-only'
const redirectTo = 'http://localhost:5173/'
const jwtKey = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`
const user = {
  id: '00000000-0000-4000-8000-000000000004', email: 'person@example.com',
  app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Pessoa' },
  aud: 'authenticated', created_at: '2026-10-11T00:00:00.000Z',
}

function sdkFixture() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString()
    if (url.includes('/auth/v1/token?grant_type=pkce')) {
      return new Response(JSON.stringify({
        access_token: `header.${btoa(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`,
        refresh_token: 'fixture-refresh-token', expires_in: 3600, token_type: 'bearer', user,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 })
    throw new Error(`Unexpected endpoint: ${url}`)
  })
  const newClient = () => createClient(projectUrl, publicKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'p4-test-session', storage },
    global: { fetch: fetchMock },
  })
  return { values, fetchMock, newClient }
}

describe('configuração Supabase', () => {
  it('variáveis ausentes mantêm visitante sem criar cliente', () => {
    expect(readAuthConfiguration({})).toEqual({ config: null, error: null })
    expect(browserAuthService({}).getSnapshot()).toMatchObject({ configured: false, user: null, loading: false })
  })

  it.each([publicKey, jwtKey('anon')])('aceita somente chave pública válida: %s', (key) => {
    expect(readAuthConfiguration({ VITE_SUPABASE_URL: ` ${projectUrl} `, VITE_SUPABASE_ANON_KEY: ` ${key} ` }))
      .toEqual({ config: { url: projectUrl, key }, error: null })
  })

  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])('aceita Supabase local: %s', (url) => {
    expect(readAuthConfiguration({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: publicKey }).config?.url).toBe(url)
  })

  it.each([
    { VITE_SUPABASE_URL: projectUrl },
    { VITE_SUPABASE_ANON_KEY: publicKey },
    { VITE_SUPABASE_URL: 'invalid', VITE_SUPABASE_ANON_KEY: publicKey },
    { VITE_SUPABASE_URL: 'http://public.example.com', VITE_SUPABASE_ANON_KEY: publicKey },
    { VITE_SUPABASE_URL: 'https://user:secret@example.com', VITE_SUPABASE_ANON_KEY: publicKey },
    { VITE_SUPABASE_URL: `${projectUrl}?key=secret`, VITE_SUPABASE_ANON_KEY: publicKey },
    { VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: 'sb_secret_do-not-expose' },
    { VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: jwtKey('service_role') },
    { VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: 'not-a-key' },
  ])('rejeita configuração incompleta/insegura sem expor valores: %s', (environment) => {
    const result = readAuthConfiguration(environment)
    expect(result.config).toBeNull()
    expect(result.error).toContain('Login indisponível')
    expect(result.error).not.toContain('secret')
  })
})

describe('adapter com SDK Supabase real e transporte controlado', () => {
  it.each(['google', 'github'] as const)('OAuth %s usa PKCE, redirect correto e sessão persistente sem acesso a tabelas', async (provider) => {
    const f = sdkFixture()
    const client = f.newClient()
    const gateway = createSupabaseAuthGateway(client, redirectTo)
    expect(await gateway.restoreUser()).toBeNull()
    const listener = vi.fn()
    const stop = gateway.onUserChange(listener)
    const oauth = vi.spyOn(client.auth, 'signInWithOAuth')
    await gateway.signIn(provider)
    const result = await oauth.mock.results[0]?.value
    const authorize = new URL(result.data.url)
    expect(authorize.pathname).toBe('/auth/v1/authorize')
    expect(authorize.searchParams.get('provider')).toBe(provider)
    expect(authorize.searchParams.get('redirect_to')).toBe(redirectTo)
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy()
    expect(authorize.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256')
    expect(f.values.has('p4-test-session-code-verifier')).toBe(true)

    // Exercise SDK code exchange/session persistence against an Auth HTTP fixture.
    // This does not contact Google/GitHub or verify JWT signatures.
    const exchanged = await client.auth.exchangeCodeForSession('fixture-authorization-code')
    expect(exchanged.error).toBeNull()
    expect(await gateway.restoreUser()).toEqual({ id: user.id, email: user.email, displayName: 'Pessoa' })
    expect(listener).toHaveBeenCalledWith({ id: user.id, email: user.email, displayName: 'Pessoa' })
    expect(f.values.has('p4-test-session')).toBe(true)

    const reloadedClient = f.newClient()
    const reloaded = createSupabaseAuthGateway(reloadedClient, redirectTo)
    expect(await reloaded.restoreUser()).toEqual({ id: user.id, email: user.email, displayName: 'Pessoa' })
    await reloaded.signOut()
    expect(await reloaded.restoreUser()).toBeNull()
    expect(f.values.has('p4-test-session')).toBe(false)
    expect(f.fetchMock.mock.calls.some(([url]) => url.toString().includes('/logout?scope=local'))).toBe(true)
    expect(f.fetchMock.mock.calls.every(([url]) => url.toString().includes('/auth/v1/'))).toBe(true)
    stop()
    client.auth.stopAutoRefresh()
    reloadedClient.auth.stopAutoRefresh()
  })

  it('propaga erro de callback/inicialização para a camada de estado', async () => {
    const f = sdkFixture()
    const client = f.newClient()
    vi.spyOn(client.auth, 'initialize').mockResolvedValue({ error: new Error('OAuth rejected') } as Awaited<ReturnType<typeof client.auth.initialize>>)
    await expect(createSupabaseAuthGateway(client, redirectTo).restoreUser()).rejects.toThrow('OAuth rejected')
  })
})
