import { describe, expect, it, vi } from 'vitest'
import type { AuthService, AuthSnapshot } from '../auth/authService'
import type { CertificationStatus, ProgressMap } from '../domain/models'
import { createProgressCacheRepository, emptyAccountCache } from '../persistence/progressCache'
import { progressStorageKey } from '../persistence/progressRepository'
import { serializeProgress } from '../persistence/progressSerialization'
import type { RemoteProgressRepository, RemoteProgressResult } from '../persistence/supabaseProgressRepository'
import { createProgressService } from './progressService'

const a = '00000000-0000-4000-8000-0000000000a5'
const b = '00000000-0000-4000-8000-0000000000b5'
const id = 'microsoft:ai-103'
const baseTime = Date.parse('2026-10-11T12:00:00.000Z')
function data(status: CertificationStatus = 'done', time = baseTime, identity = id): ProgressMap {
  return { [identity]: { certificationCode: identity, status, updatedAt: new Date(time).toISOString() } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => { resolve = accept })
  return { promise, resolve }
}

function fixture(visitor: ProgressMap = {}, user: string | null = null) {
  const values = new Map([[progressStorageKey, serializeProgress(visitor)]])
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const local = createProgressCacheRepository(() => storage)
  let authState: AuthSnapshot = { configured: true, loading: false, pending: null, error: null, user: user ? { id: user } : null }
  const authListeners = new Set<() => void>()
  const auth: AuthService = {
    getSnapshot: () => authState,
    subscribe: (listener) => { authListeners.add(listener); return () => { authListeners.delete(listener) } },
    signIn: vi.fn(), signOut: vi.fn(),
  }
  const db = new Map<string, ProgressMap>()
  let serverTime = baseTime + 1000
  let localTime = baseTime + 100
  const remote: RemoteProgressRepository = {
    load: vi.fn(async (userId: string) => ({ progress: structuredClone(db.get(userId) ?? {}), serverOffsetMs: null })),
    upsert: vi.fn(async (records: ProgressMap, userId: string) => {
      const progress: ProgressMap = {}
      for (const [key, record] of Object.entries(records)) progress[key] = { ...record, updatedAt: new Date(serverTime++).toISOString() }
      db.set(userId, { ...db.get(userId), ...progress })
      return { progress, serverOffsetMs: null }
    }),
  }
  const service = createProgressService(local, auth, remote, () => localTime)
  const stop = service.subscribe(vi.fn())
  async function settle() { await Promise.resolve(); await service.retry(); await Promise.resolve() }
  function setAuth(next: string | null, pending: AuthSnapshot['pending'] = null) {
    authState = { ...authState, user: next ? { id: next } : null, pending }
    authListeners.forEach((listener) => listener())
  }
  return { service, local, auth, remote, db, storage, stop, settle, setAuth, setTime: (time: number) => { localTime = time } }
}

describe('serviço de progresso e sincronização', () => {
  it('retry concorrente compartilha request e termina sem loop', async () => {
    const f = fixture({}, a)
    await f.settle()
    const pending = deferred<RemoteProgressResult>()
    const previousCalls = vi.mocked(f.remote.load).mock.calls.length
    vi.mocked(f.remote.load).mockReturnValueOnce(pending.promise)
    const first = f.service.retry()
    const second = f.service.retry()
    expect(first).toBe(second)
    pending.resolve({ progress: {}, serverOffsetMs: null })
    await Promise.all([first, second])
    expect(f.service.getSnapshot().syncState).toBe('synced')
    expect(vi.mocked(f.remote.load).mock.calls.length - previousCalls).toBe(2)
    f.stop()
  })
  it('sessão inexistente usa exclusivamente localStorage; JSON continua v1', async () => {
    const f = fixture(data())
    await f.settle()
    f.service.changeStatus(id, 'planned')
    expect(f.remote.load).not.toHaveBeenCalled()
    expect(f.remote.upsert).not.toHaveBeenCalled()
    expect(f.service.getSnapshot()).toMatchObject({ syncState: 'local', authenticated: false })
    expect(JSON.parse(f.service.exportJson()).version).toBe(1)
    expect(f.local.load().state.visitor[id]?.status).toBe('planned')
    f.stop()
  })
  it('conta local e remota vazias sincronizam sem criar registros', async () => {
    const f = fixture({}, a)
    await f.settle()
    expect(f.service.getSnapshot()).toMatchObject({ progress: {}, syncState: 'synced', importAvailable: false })
    expect(f.remote.upsert).not.toHaveBeenCalled()
    f.stop()
  })
  it('carrega remoto sem seed/sem importar visitante silenciosamente', async () => {
    const f = fixture(data('planned'), a)
    f.db.set(a, data('done', baseTime + 2000))
    await f.settle()
    expect(f.service.getSnapshot()).toMatchObject({ progress: f.db.get(a), importAvailable: true })
    expect(f.remote.upsert).not.toHaveBeenCalled()
    f.stop()
  })
  it('visitante só é importado com confirmação e mescla por certificação', async () => {
    const visitor = { ...data('planned'), ...data('studying', baseTime, 'future:cert') }
    const f = fixture(visitor, a)
    f.db.set(a, data('done', baseTime + 2000))
    await f.settle()
    f.service.importVisitor()
    await f.settle()
    expect(f.db.get(a)?.[id]?.status).toBe('done')
    expect(f.db.get(a)?.['future:cert']?.status).toBe('studying')
    expect(f.service.getSnapshot().importAvailable).toBe(false)
    expect(f.local.load().state.accounts[a]?.visitorImport).toBe('accepted')
    expect(f.local.load().state.visitor).toEqual(visitor)
    f.setAuth(null)
    f.setAuth(a)
    await f.settle()
    expect(f.service.getSnapshot().importAvailable).toBe(false)
    f.stop()
  })
  it('recusa de importação é persistida e não repete o prompt', async () => {
    const f = fixture(data(), a)
    await f.settle()
    f.service.declineVisitor()
    f.setAuth(null)
    f.setAuth(a)
    await f.settle()
    expect(f.service.getSnapshot()).toMatchObject({ importAvailable: false, progress: {} })
    expect(f.local.load().state.accounts[a]?.visitorImport).toBe('declined')
    f.stop()
  })
  it('edição responsiva e resposta do servidor normalizam timestamp local', async () => {
    const f = fixture({}, a)
    await f.settle()
    f.service.changeStatus(id, 'studying')
    expect(f.service.getSnapshot().progress[id]?.status).toBe('studying')
    expect(f.local.load().state.accounts[a]?.pending).toEqual([id])
    await f.settle()
    expect(f.service.getSnapshot().progress).toEqual(f.db.get(a))
    expect(f.service.getSnapshot().progress[id]?.updatedAt).toBe(new Date(baseTime + 1000).toISOString())
    expect(f.local.load().state.accounts[a]?.pending).toEqual([])
    expect(f.service.getSnapshot().syncState).toBe('synced')
    f.stop()
  })
  it('valores já iguais não provocam upsert ou loops', async () => {
    const f = fixture({}, a)
    f.db.set(a, data())
    await f.settle()
    f.service.changeStatus(id, 'done')
    await f.settle()
    expect(f.remote.upsert).not.toHaveBeenCalled()
    f.stop()
  })
  it('edição imediatamente após ack vence seu estado anterior mesmo com relógio atrás', async () => {
    const f = fixture({}, a)
    await f.settle()
    f.service.changeStatus(id, 'studying')
    await f.settle()
    const ack = f.service.getSnapshot().progress[id]?.updatedAt
    f.service.changeStatus(id, 'done')
    expect(Date.parse(f.service.getSnapshot().progress[id]?.updatedAt ?? '')).toBeGreaterThan(Date.parse(ack ?? ''))
    await f.settle()
    expect(f.db.get(a)?.[id]?.status).toBe('done')
    f.stop()
  })
  it('variações pequenas de calibração não deslocam edição abaixo do ack anterior', async () => {
    const f = fixture({}, a)
    vi.mocked(f.remote.load).mockImplementation(async () => ({ progress: f.db.get(a) ?? {}, serverOffsetMs: 0 }))
    await f.settle()
    f.service.changeStatus(id, 'studying')
    await f.settle()
    vi.mocked(f.remote.load).mockImplementation(async () => ({ progress: f.db.get(a) ?? {}, serverOffsetMs: -500 }))
    f.service.changeStatus(id, 'done')
    await f.settle()
    expect(f.db.get(a)?.[id]?.status).toBe('done')
    expect(f.local.load().state.accounts[a]?.serverOffsetMs).toBe(0)
    f.stop()
  })
  it('falha de escrita conserva pending/UI/cache e retry confirma depois', async () => {
    const f = fixture({}, a)
    await f.settle()
    vi.mocked(f.remote.upsert).mockRejectedValueOnce(new Error('offline'))
    f.service.changeStatus(id, 'studying')
    await Promise.resolve()
    await vi.waitFor(() => expect(f.service.getSnapshot().syncState).toBe('error'))
    expect(f.local.load().state.accounts[a]?.pending).toEqual([id])
    expect(f.local.load().state.accounts[a]?.progress[id]?.status).toBe('studying')
    expect(f.service.getSnapshot().syncError).toContain('mantidos')
    expect(f.remote.upsert).toHaveBeenCalledOnce()
    await f.service.retry()
    expect(f.service.getSnapshot().syncState).toBe('synced')
    expect(f.db.get(a)?.[id]?.status).toBe('studying')
    f.stop()
  })
  it('pending é recuperado após reload e sincronizado apenas na mesma conta', async () => {
    const f = fixture({}, a)
    await f.settle()
    vi.mocked(f.remote.upsert).mockRejectedValue(new Error('offline'))
    f.service.changeStatus(id, 'done')
    await vi.waitFor(() => expect(f.service.getSnapshot().syncState).toBe('error'))
    f.stop()
    vi.mocked(f.remote.upsert).mockImplementation(async records => ({ progress: records, serverOffsetMs: null }))
    const reloaded = createProgressService(createProgressCacheRepository(() => f.storage), f.auth, f.remote)
    const stop = reloaded.subscribe(vi.fn())
    await reloaded.retry()
    expect(reloaded.getSnapshot().syncState).toBe('synced')
    expect(reloaded.getSnapshot().progress[id]?.status).toBe('done')
    stop()
  })
  it('erro de SELECT não destrói cache; edição posterior tenta novamente', async () => {
    const f = fixture({}, a)
    await f.settle()
    vi.mocked(f.remote.load).mockRejectedValueOnce(new Error('offline'))
    await f.service.retry()
    expect(f.service.getSnapshot().syncState).toBe('error')
    f.service.changeStatus(id, 'planned')
    await f.settle()
    expect(f.service.getSnapshot().syncState).toBe('synced')
    f.stop()
  })
  it('logout aborta request, ignora resposta tardia e não faz novas requests', async () => {
    const f = fixture({}, a)
    await f.settle()
    const response = deferred<RemoteProgressResult>()
    vi.mocked(f.remote.load).mockReturnValueOnce(response.promise)
    const pending = f.service.retry()
    const signal = vi.mocked(f.remote.load).mock.calls.at(-1)?.[1]
    f.setAuth(a, 'logout')
    expect(signal?.aborted).toBe(true)
    f.setAuth(null)
    response.resolve({ progress: data('done'), serverOffsetMs: null })
    await pending
    const count = vi.mocked(f.remote.load).mock.calls.length
    f.service.changeStatus(id, 'planned')
    await f.settle()
    expect(f.remote.load).toHaveBeenCalledTimes(count)
    expect(f.remote.upsert).not.toHaveBeenCalled()
    expect(f.service.getSnapshot()).toMatchObject({ syncState: 'local', authenticated: false })
    f.stop()
  })
  it('logout mantém estado conhecido e mudanças locais em namespace A nunca são enviadas a B', async () => {
    const f = fixture({}, a)
    f.db.set(a, data('done'))
    f.db.set(b, data('planned', baseTime, 'microsoft:az-900'))
    await f.settle()
    f.setAuth(null)
    expect(f.service.getSnapshot().progress[id]?.status).toBe('done')
    f.service.changeStatus(id, 'studying')
    f.setAuth(b)
    await f.settle()
    expect(f.service.getSnapshot().progress).toEqual(f.db.get(b))
    expect(f.service.getSnapshot().progress[id]).toBeUndefined()
    expect(f.remote.upsert).not.toHaveBeenCalled()
    expect(f.local.load().state.accounts[a]?.progress[id]?.status).toBe('studying')
    expect(f.local.load().state.accounts[b]?.progress['microsoft:az-900']?.status).toBe('planned')
    expect(f.service.getSnapshot().importAvailable).toBe(false)
    f.stop()
  })
  it('resposta tardia de upsert A não modifica cache B ou dispara uploads B', async () => {
    const f = fixture({}, a)
    await f.settle()
    const response = deferred<RemoteProgressResult>()
    vi.mocked(f.remote.upsert).mockReturnValueOnce(response.promise)
    f.service.changeStatus(id, 'done')
    await vi.waitFor(() => expect(f.remote.upsert).toHaveBeenCalledOnce())
    f.setAuth(b)
    await f.settle()
    response.resolve({ progress: data('done'), serverOffsetMs: null })
    await Promise.resolve()
    expect(f.service.getSnapshot().progress).toEqual({})
    expect(f.remote.upsert).toHaveBeenCalledOnce()
    expect(vi.mocked(f.remote.upsert).mock.calls[0]?.[1]).toBe(a)
    f.stop()
  })
  it('edição durante upsert não é perdida pela resposta anterior/timestamp de commit', async () => {
    const f = fixture({}, a)
    await f.settle()
    const response = deferred<RemoteProgressResult>()
    vi.mocked(f.remote.upsert).mockImplementationOnce(async (records, userId) => {
      await response.promise
      const returned = { ...records, [id]: { ...records[id]!, updatedAt: new Date(baseTime + 1000).toISOString() } }
      f.db.set(userId, returned)
      return { progress: returned, serverOffsetMs: null }
    })
    f.service.changeStatus(id, 'studying')
    await vi.waitFor(() => expect(f.remote.upsert).toHaveBeenCalledOnce())
    f.setTime(baseTime + 200)
    f.service.changeStatus(id, 'done')
    response.resolve({ progress: {}, serverOffsetMs: null })
    await f.settle()
    expect(f.service.getSnapshot().progress[id]?.status).toBe('done')
    expect(f.db.get(a)?.[id]?.status).toBe('done')
    expect(f.local.load().state.accounts[a]?.pending).toEqual([])
    f.stop()
  })
  it('calibra relógio de edição/pendências sem deslocar timestamps já confirmados', async () => {
    const f = fixture({}, a)
    const offset = -3600000
    vi.mocked(f.remote.load).mockResolvedValue({ progress: data('done', baseTime - 3600000), serverOffsetMs: offset })
    await f.settle()
    f.service.changeStatus(id, 'planned')
    expect(f.service.getSnapshot().progress[id]?.updatedAt).toBe(new Date(baseTime + 100 + offset).toISOString())
    await f.settle()
    expect(f.local.load().state.accounts[a]?.serverOffsetMs).toBe(offset)
    f.stop()
  })
  it('JSON visitante substitui e preserva timestamps; validação não grava', () => {
    const f = fixture(data())
    const imported = data('planned', Date.parse('2020-01-01T00:00:00Z'), 'future:cert')
    expect(f.service.validateImport(serializeProgress(imported))).toEqual(imported)
    expect(f.service.getSnapshot().progress).toEqual(data())
    f.service.importJson(serializeProgress(imported))
    expect(f.service.getSnapshot().progress).toEqual(imported)
    expect(() => f.service.importJson('invalid')).toThrow()
    expect(f.service.getSnapshot().progress).toEqual(imported)
    f.stop()
  })
  it('JSON autenticado aplica novos status e reseta omitidos conhecidos para todo via upsert', async () => {
    const f = fixture({}, a)
    f.db.set(a, data('done'))
    await f.settle()
    f.service.importJson(serializeProgress(data('planned', baseTime, 'future:cert')))
    expect(f.service.getSnapshot().progress[id]?.status).toBe('todo')
    await f.settle()
    expect(f.db.get(a)?.[id]?.status).toBe('todo')
    expect(f.db.get(a)?.['future:cert']?.status).toBe('planned')
    f.stop()
  })
  it('desmontagem interrompe requests e conserva cache para remontagem', async () => {
    const f = fixture({}, a)
    await f.settle()
    const pending = deferred<RemoteProgressResult>()
    vi.mocked(f.remote.load).mockReturnValueOnce(pending.promise)
    const operation = f.service.retry()
    const signal = vi.mocked(f.remote.load).mock.calls.at(-1)?.[1]
    f.stop()
    expect(signal?.aborted).toBe(true)
    pending.resolve({ progress: data(), serverOffsetMs: null })
    await operation
    expect(f.service.getSnapshot().progress).toEqual({})
  })
  it('recuperação da sessão não exibe/edita cache A enquanto identidade B está indefinida', async () => {
    const f = fixture({}, a)
    f.db.set(a, data())
    await f.settle()
    f.stop()
    let loading = true
    let listener: () => void = () => undefined
    const auth: AuthService = {
      ...f.auth,
      getSnapshot: () => ({ ...f.auth.getSnapshot(), loading, user: { id: b } }),
      subscribe: (callback) => { listener = callback; return () => undefined },
    }
    const restored = createProgressService(f.local, auth, f.remote)
    const stop = restored.subscribe(vi.fn())
    expect(restored.getSnapshot().progress).toEqual({})
    restored.changeStatus(id, 'planned')
    expect(f.local.load().state.accounts[a]?.progress[id]?.status).toBe('done')
    expect(() => restored.importJson(serializeProgress(data()))).toThrow('Aguarde')
    loading = false
    listener()
    await restored.retry()
    expect(restored.getSnapshot().progress).toEqual({})
    expect(f.remote.upsert).not.toHaveBeenCalled()
    stop()
  })
  it('conta já cacheada é reconciliada por timestamp no login', async () => {
    const f = fixture()
    const { state } = f.local.load()
    state.accounts[a] = { ...emptyAccountCache(), progress: data('studying', baseTime + 2000), pending: [id] }
    f.local.save(state)
    f.stop()
    const restored = createProgressService(f.local, f.auth, f.remote)
    const stop = restored.subscribe(vi.fn())
    f.db.set(a, data('planned', baseTime))
    f.setAuth(a)
    await restored.retry()
    expect(restored.getSnapshot().progress[id]?.status).toBe('studying')
    expect(f.db.get(a)?.[id]?.status).toBe('studying')
    stop()
  })
})
