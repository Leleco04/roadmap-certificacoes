import { certificationIdentity, progressMetrics, statusFor } from '../domain/certifications'
import { roadmapCertifications } from '../domain/roadmaps'
import type { Certification, CertificationProvider, ProgressMap, Roadmap, Track } from '../domain/models'
import { defaultTrackPresentation, trackPresentation } from '../catalog/data'
import { trackStyle } from '../utilities/presentation'
import { statusLabels } from './statusLabels'
import { Icon } from './Icon'

interface Props {
  roadmaps: readonly Roadmap[]
  catalog: readonly Certification[]
  progress: ProgressMap
  providers: readonly CertificationProvider[]
  tracks: readonly Track[]
  onExplore: (provider: string, track: string) => void
}

function RoadmapSteps({ identities, byIdentity, progress }: { identities: readonly string[]; byIdentity: ReadonlyMap<string, Certification>; progress: ProgressMap }) {
  return <ol className="roadmap-steps">{identities.flatMap((identity, index) => {
    const certification = byIdentity.get(identity)
    if (!certification) return []
    const status = statusFor(certification, progress)
    return [<li key={identity}><span className={`step-marker ${status}`}>{status === 'done' ? <Icon name="check" size={14} /> : index + 1}</span><strong>{certification.code}</strong><small>{statusLabels[status]}</small></li>]
  })}</ol>
}

export function RoadmapPanel({ roadmaps, catalog, progress, providers, tracks, onExplore }: Props) {
  const byIdentity = new Map(catalog.map((certification) => [certificationIdentity(certification.provider, certification.code), certification]))
  return <section id="roadmaps" aria-labelledby="roadmaps-title" className="section-anchor">
    <div className="section-heading"><div><span className="eyebrow">ESCOLHA SEU CAMINHO</span><h2 id="roadmaps-title">Roadmaps para evoluir</h2><p>Base comum e caminhos opcionais. Escolha sua especialização.</p></div><span className="subtle">Caminhos completos · independentes dos filtros</span></div>
    <div className="roadmaps-grid">{roadmaps.map((roadmap) => {
      const sequence = roadmapCertifications(roadmap, catalog)
      const metrics = progressMetrics(sequence, progress)
      const next = sequence.find((certification) => statusFor(certification, progress) !== 'done')
      const presentation = trackPresentation[roadmap.track] ?? defaultTrackPresentation
      const title = tracks.find((track) => track.id === roadmap.track)?.name ?? roadmap.track
      return <article className="roadmap-card" style={trackStyle(roadmap.track)} key={roadmap.id} aria-labelledby={`${roadmap.id}-title`}>
        <div className="roadmap-heading"><span className="roadmap-symbol" aria-hidden="true">{presentation.symbol}</span><div><span className="provider-name">{providers.find((provider) => provider.id === roadmap.provider)?.name ?? roadmap.provider}</span><h3 id={`${roadmap.id}-title`}>{title}</h3></div><span className="roadmap-count">{metrics.done}/{metrics.total}</span></div>
        <p>{roadmap.description}</p><progress value={metrics.done} max={metrics.total || 1} aria-label={`Progresso do roadmap ${title}`} />
        {roadmap.branches?.length ? <h4 className="roadmap-path-label">Base comum</h4> : null}
        <RoadmapSteps identities={roadmap.certificationCodes} byIdentity={byIdentity} progress={progress} />
        {roadmap.branches?.map((branch) => <div className="roadmap-branch" key={branch.id}><h4 className="roadmap-path-label">{branch.name}</h4><RoadmapSteps identities={branch.certificationCodes} byIdentity={byIdentity} progress={progress} /></div>)}
        <div className="roadmap-footer"><span>{next ? <>{roadmap.branches?.length ? 'Sugestão disponível' : 'Próximo passo'} <strong>{next.code}</strong></> : 'Caminhos concluídos. Bom trabalho!'}</span><button className="text-button" onClick={() => onExplore(roadmap.provider, roadmap.track)} aria-label={`Explorar catálogo de ${title}`}>Explorar <Icon name="arrow" size={16} /></button></div>
      </article>
    })}</div>
  </section>
}
