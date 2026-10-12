import { isCanonicalIdentity } from '../domain/certifications'
import { certificationStatuses } from '../domain/models'
import type { CertificationStatus, ProgressMap } from '../domain/models'

export const progressVersion = 1

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')
}

export function deserializeProgress(text: string): ProgressMap {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('O arquivo não contém JSON válido.') }
  if (!isObject(data) || data.version !== progressVersion) {
    throw new Error('Versão de progresso desconhecida. É necessário um arquivo com version: 1.')
  }
  if (!isObject(data.progress)) throw new Error('O campo progress deve conter um objeto de registros.')
  const progress: ProgressMap = {}
  for (const [identity, record] of Object.entries(data.progress)) {
    if (!isCanonicalIdentity(identity) || !isObject(record)
      || typeof record.status !== 'string'
      || !certificationStatuses.some((status) => status === record.status)
      || !validTimestamp(record.updatedAt)) {
      throw new Error(`Registro inválido: ${identity}. Verifique identidade lowercase, status e timestamp UTC.`)
    }
    progress[identity] = { certificationCode: identity, status: record.status as CertificationStatus, updatedAt: record.updatedAt }
  }
  return progress
}

export function serializeProgress(progress: ProgressMap): string {
  const records = Object.fromEntries(Object.entries(progress).map(([identity, record]) => {
    if (record.certificationCode !== identity) throw new Error('Identidade do registro de progresso inconsistente.')
    return [identity, { status: record.status, updatedAt: record.updatedAt }]
  }))
  const serialized = JSON.stringify({ version: progressVersion, progress: records }, null, 2)
  deserializeProgress(serialized)
  return serialized
}
