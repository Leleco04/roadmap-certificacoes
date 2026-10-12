import type { ProgressMap } from '../domain/models'
import { deserializeProgress, serializeProgress } from './progressSerialization'
import { progressStorageKey } from './progressRepository'
import type { StoragePort } from './progressRepository'

export interface AccountProgressCache {
  progress: ProgressMap
  pending: string[]
  lastSyncedAt: string | null
  serverOffsetMs: number | null
  visitorImport: 'undecided' | 'accepted' | 'declined'
}

export interface ProgressCacheState {
  version: 2
  visitor: ProgressMap
  accounts: Record<string, AccountProgressCache>
  visibleOwner: string | null
}

export interface ProgressCacheRepository {
  load(): { state: ProgressCacheState; warning: string | null }
  save(state: ProgressCacheState, explicitReplacement?: boolean): string | null
}

export function emptyAccountCache(): AccountProgressCache {
  return { progress: {}, pending: [], lastSyncedAt: null, serverOffsetMs: null, visitorImport: 'undecided' }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function progress(value: unknown): ProgressMap {
  return deserializeProgress(JSON.stringify({ version: 1, progress: value }))
}

function parseCache(text: string): ProgressCacheState {
  const raw: unknown = JSON.parse(text)
  if (!object(raw) || raw.version !== 2 || !object(raw.accounts)
    || !(raw.visibleOwner === null || typeof raw.visibleOwner === 'string')) throw new Error('Cache inválido')
  const accounts: Record<string, AccountProgressCache> = {}
  for (const [id, item] of Object.entries(raw.accounts)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !object(item)) throw new Error('Conta inválida')
    const records = progress(item.progress)
    if (!Array.isArray(item.pending) || !item.pending.every((key: unknown) => typeof key === 'string' && Object.hasOwn(records, key))
      || !(item.lastSyncedAt === null || (typeof item.lastSyncedAt === 'string' && Number.isFinite(Date.parse(item.lastSyncedAt))))
      || !(item.serverOffsetMs === null || (typeof item.serverOffsetMs === 'number' && Number.isFinite(item.serverOffsetMs) && Number.isFinite(new Date(Date.now() + item.serverOffsetMs).getTime())))
      || !['undecided', 'accepted', 'declined'].includes(String(item.visitorImport))) throw new Error('Metadados inválidos')
    accounts[id] = {
      progress: records, pending: item.pending as string[], lastSyncedAt: item.lastSyncedAt as string | null,
      serverOffsetMs: item.serverOffsetMs as number | null, visitorImport: item.visitorImport as AccountProgressCache['visitorImport'],
    }
  }
  if (raw.visibleOwner !== null && !Object.hasOwn(accounts, raw.visibleOwner)) throw new Error('Dono inválido')
  return { version: 2, visitor: progress(raw.visitor), accounts, visibleOwner: raw.visibleOwner }
}

export function createProgressCacheRepository(storage: () => StoragePort, seed: () => ProgressMap = () => ({})): ProgressCacheRepository {
  let protectedState = false
  const empty = (): ProgressCacheState => ({ version: 2, visitor: seed(), accounts: {}, visibleOwner: null })
  function save(state: ProgressCacheState, explicitReplacement = false): string | null {
    if (explicitReplacement) protectedState = false
    if (protectedState) return 'Dados locais não reconhecidos foram preservados. Alterações ficam em memória; exporte JSON ou importe um arquivo válido.'
    try {
      serializeProgress(state.visitor)
      Object.values(state.accounts).forEach((cache) => serializeProgress(cache.progress))
      const text = JSON.stringify(state)
      parseCache(text)
      storage().setItem(progressStorageKey, text)
      return null
    } catch {
      return 'Não foi possível salvar o cache neste navegador. Alterações ficam em memória; exporte JSON antes de sair.'
    }
  }
  return {
    load() {
      let text: string | null
      try { text = storage().getItem(progressStorageKey) } catch {
        protectedState = true
        return { state: empty(), warning: 'Armazenamento local indisponível. Use exportação JSON para guardar seu progresso.' }
      }
      if (text === null) {
        const state = empty()
        return { state, warning: save(state) }
      }
      try {
        const raw: unknown = JSON.parse(text)
        if (object(raw) && raw.version === 1) {
          // One atomic replacement: all v1 records/timestamps become visitor data.
          const state: ProgressCacheState = { version: 2, visitor: deserializeProgress(text), accounts: {}, visibleOwner: null }
          return { state, warning: save(state) }
        }
        return { state: parseCache(text), warning: null }
      } catch {
        protectedState = true
        return { state: { version: 2, visitor: {}, accounts: {}, visibleOwner: null }, warning: 'Dados locais inválidos foram preservados. Alterações ficam em memória até uma importação válida.' }
      }
    },
    save,
  }
}

export function browserProgressCacheRepository(seed: () => ProgressMap): ProgressCacheRepository {
  return createProgressCacheRepository(() => window.localStorage, seed)
}
