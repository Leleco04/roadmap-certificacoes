import { certificationIdentity } from './certifications'
import type { Certification, Roadmap } from './models'

export function roadmapCertifications(roadmap: Roadmap, catalog: readonly Certification[]): Certification[] {
  const byIdentity = new Map(catalog.map((certification) => [certificationIdentity(certification.provider, certification.code), certification]))
  const identities = new Set([
    ...roadmap.certificationCodes,
    ...(roadmap.branches ?? []).flatMap((branch) => branch.certificationCodes),
  ])
  return [...identities].flatMap((identity) => {
    const certification = byIdentity.get(identity)
    return certification ? [certification] : []
  })
}
