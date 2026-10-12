import { certificationIdentity } from '../domain/certifications'
import type { Certification, CertificationStatus, Track } from '../domain/models'
import { certificationStatuses } from '../domain/models'
import { TrackBadge } from './TrackBadge'
import { trackStyle } from '../utilities/presentation'
import { statusLabels } from './statusLabels'
import { Icon } from './Icon'

interface Props {
  certification: Certification
  providerName: string
  tracks: readonly Track[]
  status: CertificationStatus
  onStatusChange: (identity: string, status: CertificationStatus) => void
}

export function CertificationCard({ certification, providerName, tracks, status, onStatusChange }: Props) {
  const identity = certificationIdentity(certification.provider, certification.code)
  return <article className={`cert-card status-${status}`} style={trackStyle(certification.tracks[0] ?? '')} aria-labelledby={`${identity}-title`}>
    <div className="card-top"><span className="cert-code">{certification.code}</span><span className={`status-badge ${status}`}>{status === 'done' && <Icon name="check" size={13} />}{statusLabels[status]}</span></div>
    <div className="card-identity"><span className="provider-name">{providerName} <span aria-hidden="true">/</span> {certification.level ?? 'Sem nível'}</span><h3 id={`${identity}-title`}>{certification.name}</h3></div>
    <div className="track-badges">{certification.tracks.map((id) => <TrackBadge key={id} track={tracks.find((track) => track.id === id) ?? { id, name: id, slug: id }} />)}</div>
    <p className="content-summary">{certification.mainContent.join(' · ')}</p>
    <dl className="card-metadata"><div><dt>Validade</dt><dd>{certification.validity ?? 'Não informada'}</dd></div><div><dt>Dificuldade</dt><dd>{certification.difficulty ?? 'Não informada'}</dd></div><div><dt>Prioridade</dt><dd>{certification.priority ?? 'Não informada'}</dd></div></dl>
    <div className="card-actions"><label htmlFor={`${identity}-status`}>Meu progresso</label><select id={`${identity}-status`} aria-label={`Status de ${certification.code}`} value={status} onChange={(event) => onStatusChange(identity, event.target.value as CertificationStatus)}>{certificationStatuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></div>
    <details><summary>Detalhes da certificação</summary><dl className="cert-details"><div><dt>Renovação</dt><dd>{certification.renewal ?? 'Não informada'}</dd></div><div><dt>Pré-requisitos</dt><dd>{certification.prerequisites ?? 'Não informados'}</dd></div><div><dt>Relevância</dt><dd>{certification.relevance ?? 'Não informada'}</dd></div></dl><a href={certification.sourceUrl} target="_blank" rel="noreferrer">Fonte oficial <span aria-hidden="true">↗</span><span className="sr-only"> de {certification.code} (abre em nova aba)</span></a></details>
  </article>
}
