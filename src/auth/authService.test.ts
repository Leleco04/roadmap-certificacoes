import { describe, expect, it, vi } from 'vitest'
import { createAuthService } from './authService'
import type { AuthGateway, AuthUser } from './authService'
import { createProgressRepository, progressStorageKey } from '../persistence/progressRepository'

const userA: AuthUser = { id: 'user-a', displayName: 'Pessoa A' }
const userB: AuthUser = { id: 'user-b', email: 'b@example.com' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse })
  return { promise, resolve, reject }
}

function fixture(initialUser: AuthUser | null = null) {
  let notify: (user: AuthUser | null) => void = () => undefined
  const cleanup = vi.fn()
  const gateway: AuthGateway = {
    restoreUser: vi.fn().mockResolvedValue(initialUser),
    onUserChange: vi.fn((listener) => { notify = listener; return cleanup }),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  }
  const service = createAuthService(gateway)
  const listener = vi.fn()
  const stop = service.subscribe(listener)
  return { service, gateway, cleanup, listener, stop, emit: (user: AuthUser | null) => notify(user) }
}

async function settle() { await Promise.resolve(); await Promise.resolve() }

describe('estado de autenticação P4', () => {
  it('continua visitante sem configuração e não inicia login', async () => {
    const service = createAuthService(null)
    const stop = service.subscribe(vi.fn())
    await service.signIn('google')
    expect(service.getSnapshot()).toEqual({ configured: false, loading: false, user: null, pending: null, error: null })
    stop()
  })

  it('exibe falha de configuração sem bloquear modo visitante', () => {
    expect(createAuthService(null, 'Configuração inválida').getSnapshot()).toMatchObject({ loading: false, configured: false, error: 'Configuração inválida' })
  })

  it('carrega sessão salva após montagem/reload', async () => {
    const f = fixture(userA)
    expect(f.service.getSnapshot().loading).toBe(true)
    await settle()
    expect(f.service.getSnapshot()).toMatchObject({ loading: false, user: userA })
    expect(f.listener).toHaveBeenCalledOnce()
    f.stop()
  })

  it('carrega visitante quando não existe sessão', async () => {
    const f = fixture()
    await settle()
    expect(f.service.getSnapshot()).toMatchObject({ loading: false, user: null })
    f.stop()
  })

  it('acompanha login, renovação/troca de conta e logout externos', async () => {
    const f = fixture()
    await settle()
    f.emit(userA)
    expect(f.service.getSnapshot().user).toEqual(userA)
    f.emit(userB)
    expect(f.service.getSnapshot().user).toEqual(userB)
    f.emit(null)
    expect(f.service.getSnapshot().user).toBeNull()
    f.stop()
  })

  it.each([userA, null])('evento prevalece sobre leitura inicial atrasada: %s', async (eventUser) => {
    const f = fixture()
    f.stop()
    const read = deferred<AuthUser | null>()
    vi.mocked(f.gateway.restoreUser).mockReturnValue(read.promise)
    const stop = f.service.subscribe(vi.fn())
    f.emit(eventUser)
    read.resolve(userB)
    await settle()
    expect(f.service.getSnapshot().user).toEqual(eventUser)
    stop()
  })

  it('remove a inscrição e ignora leitura/eventos de montagem encerrada (StrictMode)', async () => {
    const f = fixture()
    f.stop()
    const read = deferred<AuthUser | null>()
    vi.mocked(f.gateway.restoreUser).mockReturnValueOnce(read.promise).mockResolvedValueOnce(userB)
    const firstStop = f.service.subscribe(vi.fn())
    const staleCallback = vi.mocked(f.gateway.onUserChange).mock.calls.at(-1)?.[0]
    firstStop()
    const stop = f.service.subscribe(vi.fn())
    await settle()
    staleCallback?.(null)
    read.resolve(userA)
    await settle()
    expect(f.service.getSnapshot().user).toEqual(userB)
    expect(f.cleanup).toHaveBeenCalledTimes(2)
    stop()
  })

  it('compartilha uma inscrição entre consumidores', () => {
    const f = fixture()
    const stop = f.service.subscribe(vi.fn())
    f.stop()
    expect(f.cleanup).not.toHaveBeenCalled()
    expect(f.gateway.onUserChange).toHaveBeenCalledOnce()
    stop()
    expect(f.cleanup).toHaveBeenCalledOnce()
  })

  it('trata erro ao restaurar sessão e permite nova tentativa de login', async () => {
    const f = fixture()
    f.stop()
    vi.mocked(f.gateway.restoreUser).mockRejectedValue(new Error('Network error'))
    const stop = f.service.subscribe(vi.fn())
    await settle()
    expect(f.service.getSnapshot()).toMatchObject({ loading: false, user: null, error: expect.stringContaining('recuperar') })
    await f.service.signIn('google')
    expect(f.gateway.signIn).toHaveBeenCalledWith('google')
    expect(f.service.getSnapshot().error).toBeNull()
    stop()
  })

  it.each(['google', 'github'] as const)('inicia OAuth com %s e trata rejeição', async (provider) => {
    const f = fixture()
    await settle()
    vi.mocked(f.gateway.signIn).mockRejectedValue(new Error('Provider disabled'))
    await f.service.signIn(provider)
    expect(f.gateway.signIn).toHaveBeenCalledWith(provider)
    expect(f.service.getSnapshot()).toMatchObject({ user: null, pending: null, error: expect.stringContaining('login') })
    f.stop()
  })

  it('bloqueia ações durante carregamento e impede login duplicado', async () => {
    const f = fixture()
    await f.service.signIn('google')
    expect(f.gateway.signIn).not.toHaveBeenCalled()
    await settle()
    const login = deferred<void>()
    vi.mocked(f.gateway.signIn).mockReturnValue(login.promise)
    const first = f.service.signIn('google')
    expect(f.service.getSnapshot().pending).toBe('google')
    await f.service.signIn('github')
    expect(f.gateway.signIn).toHaveBeenCalledOnce()
    login.resolve(undefined)
    await first
    f.stop()
  })

  it('sai da conta somente após sucesso; falha mantém usuário e mostra erro', async () => {
    const f = fixture(userA)
    await settle()
    vi.mocked(f.gateway.signOut).mockRejectedValueOnce(new Error('Offline'))
    await f.service.signOut()
    expect(f.service.getSnapshot()).toMatchObject({ user: userA, pending: null, error: expect.stringContaining('sair') })
    await f.service.signOut()
    expect(f.service.getSnapshot()).toMatchObject({ user: null, error: null })
    f.stop()
  })

  it('evento de renovação durante logout não libera a pausa de sincronização', async () => {
    const f = fixture(userA)
    await settle()
    const logout = deferred<void>()
    vi.mocked(f.gateway.signOut).mockReturnValue(logout.promise)
    const operation = f.service.signOut()
    f.emit(userA)
    expect(f.service.getSnapshot().pending).toBe('logout')
    logout.resolve(undefined)
    await operation
    expect(f.service.getSnapshot()).toMatchObject({ user: null, pending: null })
    f.stop()
  })

  it('login, troca de conta e logout preservam progresso local sem associá-lo à conta', async () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { values.set(key, value) }) }
    const progress = createProgressRepository(() => storage)
    const original = { 'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'done' as const, updatedAt: '2026-10-08T00:00:00.000Z' } }
    progress.save(original)
    const saved = values.get(progressStorageKey)
    storage.setItem.mockClear()
    const f = fixture()
    await settle()
    await f.service.signIn('github')
    f.emit(userA)
    f.emit(userB)
    await f.service.signOut()
    expect(progress.load().progress).toEqual(original)
    expect(values.get(progressStorageKey)).toBe(saved)
    expect(storage.setItem).not.toHaveBeenCalled()
    f.stop()
  })
})
