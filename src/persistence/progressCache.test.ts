import { describe, expect, it, vi } from 'vitest'
import { createProgressCacheRepository, emptyAccountCache } from './progressCache'
import { progressStorageKey } from './progressRepository'
import { serializeProgress } from './progressSerialization'
import type { ProgressMap } from '../domain/models'

const userA = '00000000-0000-4000-8000-0000000000a5'
const userB = '00000000-0000-4000-8000-0000000000b5'
const data: ProgressMap = { 'future:cert': { certificationCode: 'future:cert', status: 'studying', updatedAt: '2020-01-01T00:00:00.000Z' } }
function memory(value: string | null = null) {
  const values = new Map<string, string>()
  if (value !== null) values.set(progressStorageKey, value)
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn((key: string, text: string) => { values.set(key, text) }) }
  return { storage, read: () => values.get(progressStorageKey) }
}

describe('cache local v2', () => {
  it('migra v1 explicitamente para visitante preservando IDs, timestamps e registros desconhecidos', () => {
    const m = memory(serializeProgress(data))
    const result = createProgressCacheRepository(() => m.storage).load()
    expect(result.state).toEqual({ version: 2, visitor: data, accounts: {}, visibleOwner: null })
    expect(result.warning).toBeNull()
    expect(JSON.parse(m.read() ?? '').version).toBe(2)
    expect(createProgressCacheRepository(() => m.storage).load().state).toEqual(result.state)
  })
  it('migra v1 vazio sem reaplicar seed', () => {
    const m = memory(serializeProgress({}))
    expect(createProgressCacheRepository(() => m.storage, () => data).load().state.visitor).toEqual({})
  })
  it('seed somente em armazenamento vazio', () => {
    const m = memory()
    expect(createProgressCacheRepository(() => m.storage, () => data).load().state.visitor).toEqual(data)
    expect(createProgressCacheRepository(() => m.storage, () => ({})).load().state.visitor).toEqual(data)
  })
  it('cache A/B e metadados permanecem separados após reload', () => {
    const m = memory()
    const repository = createProgressCacheRepository(() => m.storage)
    const { state } = repository.load()
    state.accounts[userA] = { ...emptyAccountCache(), progress: data, pending: ['future:cert'], serverOffsetMs: -3600000, visitorImport: 'accepted' }
    state.accounts[userB] = emptyAccountCache()
    state.visibleOwner = userA
    expect(repository.save(state)).toBeNull()
    const restored = createProgressCacheRepository(() => m.storage).load().state
    expect(restored).toEqual(state)
    expect(restored.accounts[userB]?.progress).toEqual({})
    expect(restored.visitor).toEqual({})
  })
  it.each(['invalid', '{"version":99}', '{"version":2,"visitor":{},"accounts":{},"visibleOwner":"wrong"}'])('preserva dados inválidos sem sobrescrever: %s', (text) => {
    const m = memory(text)
    const repository = createProgressCacheRepository(() => m.storage)
    const { state, warning } = repository.load()
    expect(warning).toContain('preservados')
    expect(repository.save(state)).toContain('memória')
    expect(m.read()).toBe(text)
    expect(repository.save({ ...state, visitor: data }, true)).toBeNull()
    expect(createProgressCacheRepository(() => m.storage).load().state.visitor).toEqual(data)
  })
  it('migração com erro de quota conserva v1 original e oferece recuperação em memória', () => {
    const original = serializeProgress(data)
    const storage = { getItem: () => original, setItem: () => { throw new Error('quota') } }
    const loaded = createProgressCacheRepository(() => storage).load()
    expect(loaded.state.visitor).toEqual(data)
    expect(loaded.warning).toContain('memória')
    expect(storage.getItem()).toBe(original)
  })
  it('falha de leitura não sobrescreve armazenamento', () => {
    const storage = { getItem: () => { throw new Error('blocked') }, setItem: vi.fn() }
    const repository = createProgressCacheRepository(() => storage)
    const { state } = repository.load()
    repository.save(state)
    expect(storage.setItem).not.toHaveBeenCalled()
  })
  it('rejeita pending de identidade inexistente', () => {
    const m = memory()
    const repository = createProgressCacheRepository(() => m.storage)
    const { state } = repository.load()
    state.accounts[userA] = { ...emptyAccountCache(), pending: ['microsoft:unknown'] }
    expect(repository.save(state)).not.toBeNull()
  })
  it.each([
    { visibleOwner: userA },
    { accounts: { [userA]: { progress: {} } } },
    { accounts: { [userA]: { ...emptyAccountCache(), serverOffsetMs: 1e300 } } },
    { visitor: { 'microsoft:ai-103': { status: 'invalid', updatedAt: '2020-01-01T00:00:00Z' } } },
  ])('cache parcial/adverso é preservado e não derruba o serviço: %j', (changes) => {
    const text = JSON.stringify({ version: 2, visitor: {}, accounts: {}, visibleOwner: null, ...changes })
    const m = memory(text)
    const repository = createProgressCacheRepository(() => m.storage)
    const loaded = repository.load()
    expect(loaded.warning).not.toBeNull()
    expect(loaded.state.accounts).toEqual({})
    repository.save(loaded.state)
    expect(m.read()).toBe(text)
  })
  it('campos extras não entram no estado, incluindo objetos perigosos', () => {
    const m = memory(JSON.stringify({ version: 2, visitor: data, accounts: {}, visibleOwner: null, unexpected: { ['__proto__']: { polluted: true } } }))
    const loaded = createProgressCacheRepository(() => m.storage).load()
    expect(loaded.warning).toBeNull()
    expect(loaded.state).toEqual({ version: 2, visitor: data, accounts: {}, visibleOwner: null })
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
  })
})
