import type { CatalogFilters } from '../domain/certifications'
import type { CertificationProvider, Track } from '../domain/models'
import { certificationStatuses } from '../domain/models'
import { Icon } from './Icon'
import { statusLabels } from './statusLabels'

interface Props {
  filters: CatalogFilters
  onChange: (filters: CatalogFilters) => void
  providers: readonly CertificationProvider[]
  tracks: readonly Track[]
  levels: readonly string[]
}

export function Filters({ filters, onChange, providers, tracks, levels }: Props) {
  function update(key: keyof CatalogFilters, value: string) { onChange({ ...filters, [key]: value }) }
  return <div className="filters">
    <label className="search-field"><span className="sr-only">Buscar certificações</span><Icon name="search" /><input type="search" placeholder="Buscar código, nome ou conteúdo…" value={filters.query} onChange={(event) => update('query', event.target.value)} /></label>
    <div className="filter-selects">
      <label>Provider<select aria-label="Provider" value={filters.provider} onChange={(event) => update('provider', event.target.value)}><option value="">Todos os providers</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label>Trilha<select aria-label="Trilha" value={filters.track} onChange={(event) => update('track', event.target.value)}><option value="">Todas as trilhas</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>
      <label>Nível<select aria-label="Nível" value={filters.level} onChange={(event) => update('level', event.target.value)}><option value="">Todos os níveis</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
      <label>Status<select aria-label="Status" value={filters.status} onChange={(event) => update('status', event.target.value)}><option value="">Todos os status</option>{certificationStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
    </div>
  </div>
}
