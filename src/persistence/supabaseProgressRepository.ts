import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProgressMap } from '../domain/models'
import { deserializeProgress } from './progressSerialization'
import { isCanonicalIdentity } from '../domain/certifications'
import type { ServerClock } from './serverClock'

export interface RemoteProgressResult {
  progress: ProgressMap
  serverOffsetMs: number | null
}

export interface RemoteProgressRepository {
  load(expectedUser: string, signal: AbortSignal): Promise<RemoteProgressResult>
  upsert(progress: ProgressMap, expectedUser: string, signal: AbortSignal): Promise<RemoteProgressResult>
}

function rowsToProgress(rows: unknown, expectedUser: string): ProgressMap {
  if (!Array.isArray(rows)) throw new Error('Resposta de progresso inválida')
  const records: Record<string, { status: unknown; updatedAt: string }> = {}
  for (const row of rows as unknown[]) {
    if (typeof row !== 'object' || row === null) throw new Error('Registro inválido')
    const item = row as Record<string, unknown>
    if (item.user_id !== expectedUser || typeof item.certification_id !== 'string' || !isCanonicalIdentity(item.certification_id)
      || typeof item.updated_at !== 'string' || !Number.isFinite(Date.parse(item.updated_at))) throw new Error('Registro remoto inválido ou de outra conta')
    if (Object.hasOwn(records, item.certification_id)) throw new Error('Registro remoto duplicado')
    records[item.certification_id] = { status: item.status, updatedAt: new Date(item.updated_at).toISOString() }
  }
  return deserializeProgress(JSON.stringify({ version: 1, progress: records }))
}

export function createSupabaseProgressRepository(client: SupabaseClient, clock: Pick<ServerClock, 'offsetMs'> = { offsetMs: () => null }, now: () => number = Date.now): RemoteProgressRepository {
  async function currentUser(expectedUser: string, signal: AbortSignal) {
    signal.throwIfAborted()
    const { data, error } = await client.auth.getSession()
    signal.throwIfAborted()
    if (error || !data.session || data.session.user.id !== expectedUser) throw new Error('Sessão alterada ou indisponível')
    return data.session.user.id
  }
  const columns = 'user_id,certification_id,status,created_at,updated_at'
  return {
    async load(expectedUser, signal) {
      const userId = await currentUser(expectedUser, signal)
      const progress: ProgressMap = {}
      for (let start = 0; ; start += 1000) {
        signal.throwIfAborted()
        const { data, error } = await client.from('user_cert_progress').select(columns)
          .eq('user_id', userId).order('certification_id').range(start, start + 999).abortSignal(signal).retry(false)
        signal.throwIfAborted()
        if (error) throw error
        Object.assign(progress, rowsToProgress(data, userId))
        if (!data || data.length < 1000) break
        await currentUser(expectedUser, signal)
      }
      return { progress, serverOffsetMs: clock.offsetMs() }
    },
    async upsert(progress, expectedUser, signal) {
      const started = now()
      const userId = await currentUser(expectedUser, signal)
      const values = Object.values(progress).map((record) => ({
        user_id: userId, certification_id: record.certificationCode, status: record.status,
      }))
      if (values.length === 0) return { progress: {}, serverOffsetMs: clock.offsetMs() }
      const returned: ProgressMap = {}
      // Keep representations below PostgREST's usual row limit, also for JSON
      // imports containing identities outside the current catalog.
      for (let start = 0; start < values.length; start += 500) {
        await currentUser(expectedUser, signal)
        const { data, error } = await client.from('user_cert_progress')
          .upsert(values.slice(start, start + 500), { onConflict: 'user_id,certification_id' }).select(columns).abortSignal(signal).retry(false)
        signal.throwIfAborted()
        if (error) throw error
        Object.assign(returned, rowsToProgress(data, userId))
      }
      if (Object.keys(returned).length !== values.length || values.some((row) => returned[row.certification_id]?.status !== row.status)) {
        throw new Error('Confirmação remota incompleta')
      }
      // Date may not be exposed by CORS. A successful server-generated timestamp
      // provides a calibration even in that case, with network latency uncertainty.
      const serverTime = Math.max(...Object.values(returned).map((record) => Date.parse(record.updatedAt)))
      return { progress: returned, serverOffsetMs: clock.offsetMs() ?? serverTime - (started + now()) / 2 }
    },
  }
}
