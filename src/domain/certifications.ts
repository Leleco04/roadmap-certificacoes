import type { Certification, CertificationProvider, CertificationStatus, ProgressMap, Track } from './models'

const identifierPart = /^[a-z0-9][a-z0-9._-]*$/

export function certificationIdentity(provider: string, code: string): string {
  const parts = [provider.trim().toLowerCase(), code.trim().toLowerCase()]
  if (!parts.every((part) => identifierPart.test(part))) {
    throw new Error('Provider e código devem ser identificadores não vazios, sem espaços ou dois-pontos.')
  }
  return parts.join(':')
}

export function isCanonicalIdentity(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 2 && parts.every((part) => identifierPart.test(part))
}

export function statusFor(certification: Certification, progress: ProgressMap): CertificationStatus {
  return progress[certificationIdentity(certification.provider, certification.code)]?.status ?? 'todo'
}

export function progressMetrics(catalog: readonly Certification[], progress: ProgressMap) {
  const counts = { total: 0, todo: 0, planned: 0, studying: 0, done: 0, percentage: 0 }
  const seen = new Set<string>()
  for (const certification of catalog) {
    const identity = certificationIdentity(certification.provider, certification.code)
    if (seen.has(identity)) continue
    seen.add(identity)
    counts.total += 1
    counts[statusFor(certification, progress)] += 1
  }
  counts.percentage = counts.total === 0 ? 0 : Math.round((counts.done / counts.total) * 100)
  return counts
}

export interface CatalogFilters {
  query: string
  provider: string
  track: string
  level: string
  status: string
}

export const emptyFilters: CatalogFilters = { query: '', provider: '', track: '', level: '', status: '' }

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function filterCertifications(
  catalog: readonly Certification[],
  progress: ProgressMap,
  filters: CatalogFilters,
  providers: readonly CertificationProvider[],
  tracks: readonly Track[],
): Certification[] {
  const terms = searchable(filters.query.trim()).split(/\s+/).filter(Boolean)
  return catalog.filter((certification) => {
    if (filters.provider && certification.provider !== filters.provider) return false
    if (filters.track && !certification.tracks.includes(filters.track)) return false
    if (filters.level && (certification.level ?? 'Sem nível') !== filters.level) return false
    if (filters.status && statusFor(certification, progress) !== filters.status) return false
    const haystack = searchable([
      certification.code,
      certification.name,
      ...certification.mainContent,
      providers.find((provider) => provider.id === certification.provider)?.name ?? certification.provider,
      ...certification.tracks.map((id) => tracks.find((track) => track.id === id)?.name ?? id),
    ].join(' '))
    return terms.every((term) => haystack.includes(term))
  })
}

export function sortCertifications(catalog: readonly Certification[], track?: string): Certification[] {
  return [...catalog].sort((a, b) => {
    const aOrder = track ? a.recommendedOrder?.[track] ?? Infinity : Infinity
    const bOrder = track ? b.recommendedOrder?.[track] ?? Infinity : Infinity
    if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1
    const aRank = a.levelRank ?? Infinity
    const bRank = b.levelRank ?? Infinity
    if (aRank !== bRank) return aRank < bRank ? -1 : 1
    return certificationIdentity(a.provider, a.code).localeCompare(certificationIdentity(b.provider, b.code))
  })
}
