import { certificationIdentity, statusFor } from '../domain/certifications'
import type { Certification, CertificationProvider, ProgressMap, Track } from '../domain/models'

function csvCell(value: string): string {
  // Quoting alone does not prevent spreadsheet formula execution.
  const safe = /^\s*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function catalogCsv(
  catalog: readonly Certification[], progress: ProgressMap,
  providers: readonly CertificationProvider[], tracks: readonly Track[],
): string {
  const rows = [['identity', 'code', 'name', 'provider', 'tracks', 'level', 'levelRank', 'status', 'updatedAt', 'validity', 'difficulty', 'priority', 'mainContent', 'renewal', 'prerequisites', 'relevance', 'sourceUrl']]
  for (const certification of catalog) {
    const identity = certificationIdentity(certification.provider, certification.code)
    rows.push([
      identity, certification.code, certification.name,
      providers.find((provider) => provider.id === certification.provider)?.name ?? certification.provider,
      certification.tracks.map((id) => tracks.find((track) => track.id === id)?.name ?? id).join(' | '),
      certification.level ?? '', certification.levelRank?.toString() ?? '', statusFor(certification, progress), progress[identity]?.updatedAt ?? '',
      certification.validity ?? '', certification.difficulty ?? '', certification.priority ?? '', certification.mainContent.join(' | '),
      certification.renewal ?? '', certification.prerequisites ?? '', certification.relevance ?? '', certification.sourceUrl,
    ])
  }
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadText(filename: string, text: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
