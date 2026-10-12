import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { ProgressMap } from '../domain/models'
import { createSupabaseProgressRepository } from './supabaseProgressRepository'
import { createServerClock } from './serverClock'

const a = '00000000-0000-4000-8000-0000000000a5'
const b = '00000000-0000-4000-8000-0000000000b5'
const project = 'https://p5-test.supabase.co'
const timestamp = '2026-10-11T12:00:00.123456+00:00'
const local: ProgressMap = { 'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'done', updatedAt: '2026-10-11T11:00:00.000Z' } }

function fixture() {
  const records = new Map<string, { user_id: string; certification_id: string; status: string; created_at: string; updated_at: string }>()
  let sessionUser: string | null = a
  let rejected = false
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input.toString())
    const headers = { 'Content-Type': 'application/json', Date: 'Sun, 11 Oct 2026 12:00:00 GMT' }
    if (url.pathname !== '/rest/v1/user_cert_progress') throw new Error(`Unexpected table: ${url.pathname}`)
    if (rejected) return new Response(JSON.stringify({ code: '42501', message: 'RLS denied' }), { status: 403, headers })
    if (init?.method === 'POST') {
      const body: unknown = JSON.parse(String(init.body))
      if (!Array.isArray(body)) throw new Error('Invalid body')
      const returned = []
      for (const value of body as { user_id: string; certification_id: string; status: string }[]) {
        if (value.user_id !== sessionUser) return new Response(JSON.stringify({ code: '42501', message: 'RLS denied' }), { status: 403, headers })
        const row = { ...value, created_at: timestamp, updated_at: timestamp }
        records.set(`${value.user_id}/${value.certification_id}`, row)
        returned.push(row)
      }
      return new Response(JSON.stringify(returned), { status: 200, headers })
    }
    const own = [...records.values()].filter(row => row.user_id === sessionUser && url.searchParams.get('user_id') === `eq.${sessionUser}`)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 1000)
    return new Response(JSON.stringify(own.slice(offset, offset + limit)), { status: 200, headers })
  })
  const clock = createServerClock(transport, () => Date.parse('2026-10-11T13:00:00.000Z'))
  const client = createClient(project, 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: clock.fetch },
  })
  const session = (id: string): Session => ({
    access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600,
    user: { id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-11T00:00:00Z' },
  })
  vi.spyOn(client.auth, 'getSession').mockImplementation(async () => sessionUser
    ? { data: { session: session(sessionUser) }, error: null }
    : { data: { session: null }, error: null })
  const repository = createSupabaseProgressRepository(client, clock)
  return { client, repository, transport, records, setUser: (id: string | null) => { sessionUser = id }, reject: () => { rejected = true } }
}

describe('fronteira Supabase com SDK real/PostgREST controlado', () => {
  it('SELECT retorna somente usuário da sessão, normaliza UTC/micros e calibra relógio', async () => {
    const f = fixture()
    f.records.set('a', { user_id: a, certification_id: 'microsoft:ai-103', status: 'done', created_at: timestamp, updated_at: timestamp })
    f.records.set('b', { user_id: b, certification_id: 'microsoft:az-900', status: 'planned', created_at: timestamp, updated_at: timestamp })
    const result = await f.repository.load(a, new AbortController().signal)
    expect(result.progress).toEqual({ 'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'done', updatedAt: '2026-10-11T12:00:00.123Z' } })
    expect(result.serverOffsetMs).toBe(-3600000)
    expect(new URL(f.transport.mock.calls[0]?.[0].toString() ?? '').searchParams.get('user_id')).toBe(`eq.${a}`)
  })
  it('UPSERT usa chave composta, user_id da sessão e retorna updated_at do banco', async () => {
    const f = fixture()
    const result = await f.repository.upsert(local, a, new AbortController().signal)
    const [input, init] = f.transport.mock.calls[0] ?? []
    expect(new URL(input?.toString() ?? '').searchParams.get('on_conflict')).toBe('user_id,certification_id')
    expect(new Headers(init?.headers).get('Prefer')).toContain('resolution=merge-duplicates')
    expect(new Headers(init?.headers).get('Prefer')).toContain('return=representation')
    expect(JSON.parse(String(init?.body))).toEqual([{ user_id: a, certification_id: 'microsoft:ai-103', status: 'done' }])
    expect(result.progress['microsoft:ai-103']?.updatedAt).toBe('2026-10-11T12:00:00.123Z')
  })
  it('sessão inexistente ou conta esperada diferente impede qualquer request', async () => {
    const f = fixture()
    await expect(f.repository.upsert(local, b, new AbortController().signal)).rejects.toThrow('Sessão')
    f.setUser(null)
    await expect(f.repository.load(a, new AbortController().signal)).rejects.toThrow('Sessão')
    expect(f.transport).not.toHaveBeenCalled()
  })
  it('calibra por updated_at do upsert quando Date não está disponível por CORS', async () => {
    const f = fixture()
    f.transport.mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: a, certification_id: 'microsoft:ai-103', status: 'done', updated_at: timestamp }]), { status: 200 }))
    const time = Date.parse('2026-10-11T13:00:00.000Z')
    const repository = createSupabaseProgressRepository(f.client, { offsetMs: () => null }, () => time)
    const result = await repository.upsert(local, a, new AbortController().signal)
    expect(result.serverOffsetMs).toBe(Date.parse(timestamp) - time)
  })
  it('API negada por RLS propaga erro, sem bypass', async () => {
    const f = fixture()
    f.reject()
    await expect(f.repository.load(a, new AbortController().signal)).rejects.toMatchObject({ code: '42501' })
    await expect(f.repository.upsert(local, a, new AbortController().signal)).rejects.toMatchObject({ code: '42501' })
  })
  it('abort após getSession impede iniciar request remoto', async () => {
    const f = fixture()
    const controller = new AbortController()
    vi.spyOn(f.client.auth, 'getSession').mockImplementationOnce(async () => { controller.abort(); return { data: { session: null }, error: null } })
    await expect(f.repository.load(a, controller.signal)).rejects.toThrow()
    expect(f.transport).not.toHaveBeenCalled()
  })
  it('rejeita resposta de outra conta, mesmo se transporte violar o filtro', async () => {
    const f = fixture()
    f.transport.mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: b, certification_id: 'microsoft:ai-103', status: 'done', updated_at: timestamp }]), { status: 200 }))
    await expect(f.repository.load(a, new AbortController().signal)).rejects.toThrow('outra conta')
  })
  it('rejeita status/identidade/timestamp remotos inválidos e confirmação incompleta', async () => {
    const f = fixture()
    f.transport.mockResolvedValueOnce(new Response(JSON.stringify([{ user_id: a, certification_id: '__proto__', status: 'done', updated_at: timestamp }]), { status: 200 }))
    await expect(f.repository.load(a, new AbortController().signal)).rejects.toThrow('inválido')
    f.transport.mockResolvedValueOnce(new Response('[]', { status: 200 }))
    await expect(f.repository.upsert(local, a, new AbortController().signal)).rejects.toThrow('incompleta')
  })
  it('paginação e lotes preservam mais de mil identidades sem depender do catálogo', async () => {
    const f = fixture()
    const many: ProgressMap = {}
    for (let i = 0; i < 1001; i++) {
      const identity = `future:cert-${i}`
      many[identity] = { certificationCode: identity, status: 'planned', updatedAt: '2026-10-11T10:00:00.000Z' }
    }
    expect(Object.keys((await f.repository.upsert(many, a, new AbortController().signal)).progress)).toHaveLength(1001)
    expect(Object.keys((await f.repository.load(a, new AbortController().signal)).progress)).toHaveLength(1001)
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(3)
    expect(f.transport.mock.calls.filter(([, init]) => init?.method === 'GET')).toHaveLength(2)
  })
})

describe('relógio estimado do servidor', () => {
  it('sem Date mantém calibração anterior; erros não mudam offset', async () => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { headers: { Date: 'Sun, 11 Oct 2026 12:00:00 GMT' } }))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}', { status: 500, headers: { Date: 'Sun, 11 Oct 2026 20:00:00 GMT' } }))
    const clock = createServerClock(transport, () => Date.parse('2026-10-11T13:00:00Z'))
    expect(clock.offsetMs()).toBeNull()
    await clock.fetch(project)
    expect(clock.offsetMs()).toBe(-3600000)
    await clock.fetch(project)
    await clock.fetch(project)
    expect(clock.offsetMs()).toBe(-3600000)
  })
})
