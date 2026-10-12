import { progressMetrics } from '../domain/certifications'
import type { Certification, ProgressMap } from '../domain/models'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function Dashboard({ catalog, progress }: { catalog: readonly Certification[]; progress: ProgressMap }) {
  const metrics = progressMetrics(catalog, progress)
  const stats: { label: string; value: number; icon: IconName; tone: string }[] = [
    { label: 'Certificações', value: metrics.total, icon: 'book', tone: 'neutral' },
    { label: 'Concluídas', value: metrics.done, icon: 'check', tone: 'green' },
    { label: 'Estudando', value: metrics.studying, icon: 'clock', tone: 'blue' },
    { label: 'Planejadas', value: metrics.planned, icon: 'target', tone: 'purple' },
    { label: 'A fazer', value: metrics.todo, icon: 'path', tone: 'neutral' },
  ]
  return <section id="overview" aria-labelledby="overview-title" className="overview section-anchor">
    <div className="section-heading"><div><span className="eyebrow">SEU PONTO DE PARTIDA</span><h2 id="overview-title">Visão geral</h2></div><span className="subtle">Todo o catálogo · sem efeito dos filtros</span></div>
    <div className="metrics-grid" aria-live="polite">
      {stats.map((stat) => <div className="metric" key={stat.label}><span className={`metric-icon ${stat.tone}`}><Icon name={stat.icon} /></span><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
      <div className="metric completion"><span className="metric-icon green"><Icon name="target" /></span><strong>{metrics.percentage}<small>%</small></strong><span>Progresso geral</span></div>
    </div>
    <div className="overall-progress"><div className="progress-caption"><span><strong>{metrics.done} de {metrics.total}</strong> certificações concluídas</span><span>Um passo de cada vez.</span></div><progress value={metrics.done} max={metrics.total || 1} aria-label="Progresso geral de certificações" /></div>
  </section>
}
