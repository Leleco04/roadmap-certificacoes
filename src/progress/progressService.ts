import type { AuthService } from '../auth/authService'
import type { CertificationStatus, ProgressMap } from '../domain/models'
import { isCanonicalIdentity } from '../domain/certifications'
import { deserializeProgress, serializeProgress } from '../persistence/progressSerialization'
import { emptyAccountCache } from '../persistence/progressCache'
import type { AccountProgressCache, ProgressCacheRepository } from '../persistence/progressCache'
import type { RemoteProgressRepository } from '../persistence/supabaseProgressRepository'
import { mergeProgress } from './mergeProgress'

export interface SyncSnapshot {
  progress: ProgressMap
  warning: string | null
  syncState: 'local' | 'syncing' | 'synced' | 'pending' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  importAvailable: boolean
  authenticated: boolean
}

export interface ProgressService {
  getSnapshot(): SyncSnapshot
  subscribe(listener: () => void): () => void
  changeStatus(identity: string, status: CertificationStatus): void
  validateImport(text: string): ProgressMap
  importJson(text: string): void
  exportJson(): string
  retry(): Promise<void>
  importVisitor(): void
  declineVisitor(): void
}

interface SyncContext {
  userId: string
  controller: AbortController
  running: Promise<void> | null
  rerun: boolean
}

export function createProgressService(local: ProgressCacheRepository, auth: AuthService, remote: RemoteProgressRepository | null, now: () => number = Date.now): ProgressService {
  const initial = local.load()
  let state = initial.state
  let context: SyncContext | null = null
  let boundUser: string | null | undefined
  let stopAuth: (() => void) | undefined
  const listeners = new Set<() => void>()
  const visibleProgress = () => state.visibleOwner === null ? state.visitor : state.accounts[state.visibleOwner]?.progress ?? {}
  let snapshot: SyncSnapshot = {
    progress: auth.getSnapshot().loading && state.visibleOwner !== null ? {} : visibleProgress(), warning: initial.warning, syncState: 'local', syncError: null,
    lastSyncedAt: null, importAvailable: false, authenticated: false,
  }

  function publish(changes: Partial<SyncSnapshot> = {}) {
    snapshot = { ...snapshot, progress: visibleProgress(), ...changes }
    listeners.forEach((listener) => listener())
  }
  function persist(explicitReplacement = false) {
    publish({ warning: local.save(state, explicitReplacement) })
  }
  function account(id: string): AccountProgressCache { return state.accounts[id] ?? emptyAccountCache() }
  function setAccount(id: string, cache: AccountProgressCache) {
    state = { ...state, accounts: { ...state.accounts, [id]: cache } }
  }
  function timestamp(cache?: AccountProgressCache, previous?: string) {
    return new Date(Math.max(now() + (cache?.serverOffsetMs ?? 0), previous ? Date.parse(previous) + 1 : 0)).toISOString()
  }
  function stableOffset(previous: number | null, incoming: number | null) {
    if (incoming === null) return previous
    // HTTP Date has second precision: avoid shifting queued edits for jitter.
    return previous !== null && Math.abs(incoming - previous) <= 1000 ? previous : incoming
  }
  function current(candidate: SyncContext) { return context === candidate && !candidate.controller.signal.aborted }

  async function cycle(candidate: SyncContext) {
    if (!remote || !current(candidate)) return
    const id = candidate.userId
    publish({ syncState: 'syncing', syncError: null })
    try {
      const cloud = await remote.load(id, candidate.controller.signal)
      if (!current(candidate)) return
      let cache = account(id)
      const offset = stableOffset(cache.serverOffsetMs, cloud.serverOffsetMs)
      if (offset !== null && offset !== cache.serverOffsetMs) {
        // Pending edits were made using the previous calibration. Rebase only
        // those edits; acknowledged server timestamps must never be shifted.
        const delta = offset - (cache.serverOffsetMs ?? 0)
        const progress = { ...cache.progress }
        for (const identity of cache.pending) {
          const record = progress[identity]
          if (record) progress[identity] = { ...record, updatedAt: new Date(Date.parse(record.updatedAt) + delta).toISOString() }
        }
        cache = { ...cache, progress, serverOffsetMs: offset }
      }
      const merged = mergeProgress(cache.progress, cloud.progress)
      setAccount(id, { ...cache, progress: merged.progress, pending: Object.keys(merged.uploads) })
      persist()
      if (Object.keys(merged.uploads).length > 0) {
        const written = await remote.upsert(merged.uploads, id, candidate.controller.signal)
        if (!current(candidate)) return
        cache = account(id)
        const progress = { ...cache.progress }
        const pending = new Set(cache.pending)
        const newOffset = stableOffset(cache.serverOffsetMs, written.serverOffsetMs)
        const delta = (newOffset ?? 0) - (cache.serverOffsetMs ?? 0)
        for (const identity of cache.pending) {
          const record = progress[identity]
          if (record && record !== merged.uploads[identity]) {
            progress[identity] = { ...record, updatedAt: new Date(Date.parse(record.updatedAt) + delta).toISOString() }
          }
        }
        for (const [identity, submitted] of Object.entries(merged.uploads)) {
          const acknowledged = written.progress[identity]
          if (!acknowledged || acknowledged.status !== submitted.status) throw new Error('Confirmação remota incompleta')
          // A response for an earlier edit must not undo a newer UI edit.
          if (progress[identity] === submitted) {
            progress[identity] = acknowledged
            pending.delete(identity)
          } else {
            const newer = progress[identity]
            if (newer) progress[identity] = {
              ...newer,
              // This edit causally follows our submitted edit, even if it was
              // made before that earlier request received its server timestamp.
              updatedAt: new Date(Math.max(Date.parse(newer.updatedAt), Date.parse(acknowledged.updatedAt) + 1)).toISOString(),
            }
            candidate.rerun = true
          }
        }
        setAccount(id, { ...cache, progress, pending: [...pending], serverOffsetMs: newOffset })
      }
      cache = account(id)
      setAccount(id, { ...cache, lastSyncedAt: timestamp(cache) })
      persist()
      publish({ syncState: cache.pending.length ? 'pending' : 'synced', lastSyncedAt: account(id).lastSyncedAt })
    } catch {
      if (!current(candidate)) return
      // No automatic retry loop on failure. Data and dirty markers survive.
      candidate.rerun = false
      publish({ syncState: 'error', syncError: 'Progresso não sincronizado. Os dados locais foram mantidos; tente novamente quando a conexão voltar.' })
    }
  }

  function retry(): Promise<void> {
    const candidate = context
    if (!candidate || !remote) return Promise.resolve()
    if (candidate.running) {
      candidate.rerun = true
      return candidate.running
    }
    candidate.running = (async () => {
      do {
        candidate.rerun = false
        await cycle(candidate)
      } while (current(candidate) && candidate.rerun)
    })().finally(() => { candidate.running = null })
    return candidate.running
  }

  function queueSync() {
    const candidate = context
    queueMicrotask(() => { if (candidate && current(candidate)) void retry() })
  }

  function selectSession() {
    const session = auth.getSnapshot()
    if (session.loading) return
    const id = session.pending === 'logout' ? null : session.user?.id ?? null
    if (id === boundUser) return
    boundUser = id
    context?.controller.abort()
    context = null
    if (id === null) {
      // Keep the last displayed account namespace, never relabel it as visitor.
      publish({ authenticated: false, syncState: 'local', syncError: null, importAvailable: false, lastSyncedAt: null })
      return
    }
    const previousOwner = state.visibleOwner
    let cache = account(id)
    if (cache.visitorImport === 'undecided' && (Object.keys(state.visitor).length === 0 || (previousOwner !== null && previousOwner !== id))) {
      cache = { ...cache, visitorImport: 'declined' }
    }
    setAccount(id, cache)
    state = { ...state, visibleOwner: id }
    context = { userId: id, controller: new AbortController(), running: null, rerun: false }
    persist()
    publish({ authenticated: true, syncState: 'pending', lastSyncedAt: cache.lastSyncedAt, syncError: null, importAvailable: cache.visitorImport === 'undecided' })
    queueSync()
  }

  function updateProgress(progress: ProgressMap, dirty: string[], explicitReplacement = false) {
    const owner = state.visibleOwner
    if (owner === null) state = { ...state, visitor: progress }
    else {
      const cache = account(owner)
      setAccount(owner, { ...cache, progress, pending: [...new Set([...cache.pending.filter((key) => Object.hasOwn(progress, key)), ...dirty])] })
    }
    persist(explicitReplacement)
    if (context) {
      publish({ syncState: 'pending', syncError: null })
      queueSync()
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        stopAuth = auth.subscribe(selectSession)
        selectSession()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          context?.controller.abort()
          context = null
          boundUser = undefined
          stopAuth?.()
          stopAuth = undefined
        }
      }
    },
    changeStatus(identity, status) {
      if (auth.getSnapshot().loading) return
      if (!isCanonicalIdentity(identity)) throw new Error('Identidade inválida.')
      if (snapshot.progress[identity]?.status === status) return
      const cache = state.visibleOwner ? account(state.visibleOwner) : undefined
      const progress = { ...snapshot.progress, [identity]: { certificationCode: identity, status, updatedAt: timestamp(cache, snapshot.progress[identity]?.updatedAt) } }
      serializeProgress(progress)
      updateProgress(progress, [identity])
    },
    validateImport: deserializeProgress,
    importJson(text) {
      if (auth.getSnapshot().loading) throw new Error('Aguarde a recuperação da sessão antes de importar.')
      const imported = deserializeProgress(text)
      const owner = state.visibleOwner
      if (!context || owner === null) {
        updateProgress(imported, Object.keys(imported), true)
        return
      }
      // A confirmed JSON replacement is a new edit on this account. Reset known
      // omitted statuses to todo without delete+insert or remote deletion.
      const progress: ProgressMap = {}
      for (const identity of new Set([...Object.keys(snapshot.progress), ...Object.keys(imported)])) {
        progress[identity] = { certificationCode: identity, status: imported[identity]?.status ?? 'todo', updatedAt: timestamp(account(owner), snapshot.progress[identity]?.updatedAt) }
      }
      updateProgress(progress, Object.keys(progress), true)
    },
    exportJson: () => serializeProgress(snapshot.progress),
    retry,
    importVisitor() {
      if (!context || !snapshot.importAvailable) return
      const id = context.userId
      const cache = account(id)
      const merged = mergeProgress(state.visitor, cache.progress)
      setAccount(id, { ...cache, visitorImport: 'accepted' })
      updateProgress(merged.progress, Object.keys(merged.uploads))
      publish({ importAvailable: false })
    },
    declineVisitor() {
      if (!context || !snapshot.importAvailable) return
      const id = context.userId
      setAccount(id, { ...account(id), visitorImport: 'declined' })
      persist()
      publish({ importAvailable: false })
    },
  }
}
