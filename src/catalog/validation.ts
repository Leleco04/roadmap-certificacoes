import { certificationIdentity, isCanonicalIdentity } from '../domain/certifications'
import type { Certification, CertificationProvider, Roadmap, Track } from '../domain/models'

interface CatalogInput {
  certifications: readonly Certification[]
  providers: readonly CertificationProvider[]
  tracks: readonly Track[]
  roadmaps: readonly Roadmap[]
  difficultyScale: readonly string[]
  priorityScale: readonly string[]
}

function validHttpsUrl(value: string): URL | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url : undefined
  } catch { return undefined }
}

function validOrder(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export function validateCatalog(input: CatalogInput): string[] {
  const errors: string[] = []
  function uniqueIds(items: readonly { id: string; slug?: string }[], label: string) {
    const ids = new Set<string>()
    const slugs = new Set<string>()
    for (const item of items) {
      if (!isCanonicalIdentity(`${item.id}:check`)) errors.push(`${label}: id inválido ${item.id}`)
      if (ids.has(item.id)) errors.push(`${label}: id duplicado ${item.id}`)
      ids.add(item.id)
      if (item.slug !== undefined) {
        if (!isCanonicalIdentity(`${item.slug}:check`) || slugs.has(item.slug)) errors.push(`${label}: slug inválido ou duplicado ${item.slug}`)
        slugs.add(item.slug)
      }
    }
  }
  uniqueIds(input.providers, 'Provider')
  uniqueIds(input.tracks, 'Track')
  uniqueIds(input.roadmaps, 'Roadmap')
  for (const provider of input.providers) {
    if (!provider.name.trim() || !validHttpsUrl(provider.website)) errors.push(`Provider ${provider.id}: nome ou website inválido`)
  }
  for (const track of input.tracks) {
    if (!track.name.trim()) errors.push(`Track ${track.id}: nome vazio`)
  }
  const providers = new Map(input.providers.map((provider) => [provider.id, provider]))
  const tracks = new Set(input.tracks.map((track) => track.id))
  const certifications = new Map<string, Certification>()
  for (const certification of input.certifications) {
    const label = `${certification.provider}:${certification.code}`
    let identity: string
    try { identity = certificationIdentity(certification.provider, certification.code) } catch {
      errors.push(`${label}: identidade inválida`)
      continue
    }
    if (certifications.has(identity)) errors.push(`${label}: código duplicado no provider`)
    certifications.set(identity, certification)
    const provider = providers.get(certification.provider)
    if (!provider) errors.push(`${label}: provider inexistente`)
    if (!certification.name.trim()) errors.push(`${label}: nome vazio`)
    if (!certification.mainContent.length || certification.mainContent.some((topic) => !topic.trim())) errors.push(`${label}: conteúdo vazio`)
    if (!certification.tracks.length || new Set(certification.tracks).size !== certification.tracks.length || certification.tracks.some((track) => !tracks.has(track))) errors.push(`${label}: tracks inválidas`)
    if (certification.level !== undefined && !certification.level.trim()) errors.push(`${label}: level vazio`)
    if (certification.levelRank !== undefined && (!certification.level || !validOrder(certification.levelRank))) errors.push(`${label}: levelRank inválido`)
    if (certification.difficulty !== undefined && !input.difficultyScale.includes(certification.difficulty)) errors.push(`${label}: difficulty fora da escala`)
    if (certification.priority !== undefined && !input.priorityScale.includes(certification.priority)) errors.push(`${label}: priority fora da escala`)
    for (const [track, order] of Object.entries(certification.recommendedOrder ?? {})) {
      if (!certification.tracks.includes(track) || !validOrder(order)) errors.push(`${label}: recommendedOrder inválido para ${track}`)
    }
    const source = validHttpsUrl(certification.sourceUrl)
    const website = provider ? validHttpsUrl(provider.website) : undefined
    if (!source || !website || !(source.hostname === website.hostname || source.hostname.endsWith(`.${website.hostname}`))) errors.push(`${label}: sourceUrl fora do website oficial do provider ou inválida`)
    if ('status' in certification || 'updatedAt' in certification) errors.push(`${label}: progresso misturado ao catálogo`)
  }
  for (const roadmap of input.roadmaps) {
    if (!providers.has(roadmap.provider) || !tracks.has(roadmap.track)) errors.push(`Roadmap ${roadmap.id}: provider ou track inexistente`)
    uniqueIds(roadmap.branches ?? [], `Roadmap ${roadmap.id} branch`)
    const paths = [{ id: 'base', certificationCodes: roadmap.certificationCodes }, ...(roadmap.branches ?? [])]
    for (const branch of roadmap.branches ?? []) {
      if (!branch.name.trim()) errors.push(`Roadmap ${roadmap.id}: branch sem nome`)
    }
    for (const path of paths) {
      if (!path.certificationCodes.length || new Set(path.certificationCodes).size !== path.certificationCodes.length) errors.push(`Roadmap ${roadmap.id}/${path.id}: sequência vazia ou duplicada`)
      for (const identity of path.certificationCodes) {
        const certification = certifications.get(identity)
        if (!isCanonicalIdentity(identity) || !certification) errors.push(`Roadmap ${roadmap.id}/${path.id}: referência inexistente ou não canônica ${identity}`)
        else if (certification.provider !== roadmap.provider || !certification.tracks.includes(roadmap.track)) errors.push(`Roadmap ${roadmap.id}/${path.id}: referência fora do provider/track ${identity}`)
      }
    }
  }
  return errors
}
