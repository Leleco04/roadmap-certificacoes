import { describe, expect, it, vi } from 'vitest'
import { createProgressRepository, progressStorageKey } from './progressRepository'
import type { StoragePort } from './progressRepository'
import { serializeProgress } from './progressSerialization'
import type { ProgressMap } from '../domain/models'

const timestamp = '2026-10-08T12:00:00.000Z'
const seed: ProgressMap = { 'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'done', updatedAt: timestamp } }
function memoryStorage(value: string | null = null) {
  const values = new Map<string, string>()
  if (value !== null) values.set(progressStorageKey, value)
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, item) => { values.set(key, item) } }
  const writes = vi.spyOn(storage, 'setItem')
  return { storage, writes, read: () => storage.getItem(progressStorageKey) }
}

describe('repositório local', () => {
  it('inicializa e persiste a amostra somente quando storage está vazio', () => {
    const { storage, read } = memoryStorage()
    const repository = createProgressRepository(() => storage, () => seed)
    expect(repository.load()).toEqual({ progress: seed, warning: null })
    expect(read()).toBe(serializeProgress(seed))
    expect(createProgressRepository(() => storage).load().progress).toEqual(seed)
  })
  it('não reaplica a amostra a um progresso vazio já salvo', () => {
    const { storage, writes } = memoryStorage(serializeProgress({}))
    expect(createProgressRepository(() => storage, () => seed).load()).toEqual({ progress: {}, warning: null })
    expect(writes).not.toHaveBeenCalled()
  })
  it('salva alterações explícitas para todo e as recupera após recarregar', () => {
    const { storage } = memoryStorage()
    const repository = createProgressRepository(() => storage)
    const changed: ProgressMap = { 'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'todo', updatedAt: timestamp } }
    expect(repository.save(changed)).toBeNull()
    expect(createProgressRepository(() => storage).load().progress).toEqual(changed)
  })
  it.each(['{bad', '{"version":9,"progress":{}}', '{"version":1,"progress":{"a:b":{"status":"bad"}}}'])('preserva armazenamento inválido e bloqueia sobrescrita silenciosa: %s', (value) => {
    const { storage, read, writes } = memoryStorage(value)
    const repository = createProgressRepository(() => storage)
    expect(repository.load().warning).toContain('preservados')
    expect(repository.save(seed)).toContain('memória')
    expect(read()).toBe(value)
    expect(writes).not.toHaveBeenCalled()
    expect(repository.exportJson(seed)).toBe(serializeProgress(seed))
  })
  it('importação válida explícita substitui estado protegido', () => {
    const { storage, read } = memoryStorage('invalid')
    const repository = createProgressRepository(() => storage)
    repository.load()
    expect(repository.importJson(serializeProgress(seed))).toEqual({ progress: seed, warning: null })
    expect(read()).toBe(serializeProgress(seed))
    expect(repository.save({})).toBeNull()
  })
  it('validação de importação não grava nada; importação inválida preserva progresso', () => {
    const { storage, writes, read } = memoryStorage(serializeProgress(seed))
    const repository = createProgressRepository(() => storage)
    expect(repository.validateImport(serializeProgress({}))).toEqual({})
    expect(() => repository.importJson('bad')).toThrow()
    expect(writes).not.toHaveBeenCalled()
    expect(read()).toBe(serializeProgress(seed))
  })
  it('importação substitui em vez de mesclar e preserva datas antigas', () => {
    const { storage } = memoryStorage(serializeProgress(seed))
    const repository = createProgressRepository(() => storage)
    const imported: ProgressMap = { 'future:cert': { certificationCode: 'future:cert', status: 'planned', updatedAt: '2020-01-01T00:00:00.000Z' } }
    expect(repository.importJson(serializeProgress(imported)).progress).toEqual(imported)
    expect(repository.load().progress).toEqual(imported)
  })
  it('trata falha ao acessar o próprio localStorage', () => {
    const repository = createProgressRepository(() => { throw new Error('SecurityError') }, () => seed)
    expect(repository.load().progress).toEqual(seed)
    expect(repository.load().warning).toContain('indisponível')
    expect(repository.save(seed)).toContain('memória')
  })
  it('trata falha de leitura', () => {
    const repository = createProgressRepository(() => ({ getItem: () => { throw new Error('Blocked') }, setItem: () => {} }))
    expect(repository.load().warning).toContain('indisponível')
  })
  it('não sobrescreve progresso existente quando somente a leitura falha', () => {
    const writes = vi.fn()
    const repository = createProgressRepository(() => ({ getItem: () => { throw new Error('Read failed') }, setItem: writes }), () => seed)
    repository.load()
    expect(repository.save(seed)).toContain('preservados')
    expect(writes).not.toHaveBeenCalled()
  })
  it('falha de quota na gravação mantém o progresso importado em memória', () => {
    const repository = createProgressRepository(() => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') } }), () => seed)
    expect(repository.load()).toEqual({ progress: seed, warning: expect.stringContaining('memória') })
    expect(repository.importJson(serializeProgress(seed))).toEqual({ progress: seed, warning: expect.stringContaining('memória') })
  })
})
