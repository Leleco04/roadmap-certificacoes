import { useState } from 'react'
import { certifications, providers, tracks } from './catalog/data'
import { roadmaps } from './catalog/roadmaps'
import { certificationIdentity, emptyFilters, filterCertifications, sortCertifications, statusFor } from './domain/certifications'
import { useProgress } from './progress/useProgress'
import type { ProgressService } from './progress/progressService'
import { SyncFeedback } from './progress/SyncFeedback'
import { catalogCsv } from './utilities/export'
import { Icon } from './components/Icon'
import { Dashboard } from './components/Dashboard'
import { RoadmapPanel } from './components/RoadmapPanel'
import { Filters } from './components/Filters'
import { CertificationCard } from './components/CertificationCard'
import { DataTools } from './components/DataTools'
import { AuthPanel } from './components/AuthPanel'
import type { AuthService } from './auth/authService'

const knownIdentities = new Set(certifications.map((certification) => certificationIdentity(certification.provider, certification.code)))
const availableTracks = tracks.filter((track) => certifications.some((certification) => certification.tracks.includes(track.id)))
const levels = [...new Set(sortCertifications(certifications).map((certification) => certification.level ?? 'Sem nível'))]

export default function App({ progressService, authService }: { progressService: ProgressService; authService: AuthService }) {
  const progressState = useProgress(progressService)
  const [filters, setFilters] = useState(emptyFilters)
  const filtered = sortCertifications(filterCertifications(certifications, progressState.progress, filters, providers, tracks), filters.track || undefined)
  const unknownCount = Object.keys(progressState.progress).filter((identity) => !knownIdentities.has(identity)).length
  const hasFilters = Object.values(filters).some(Boolean)

  function explore(provider: string, track: string) {
    setFilters({ ...emptyFilters, provider, track })
    document.getElementById('catalog-title')?.focus()
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Pular para o conteúdo</a>
    <aside className="sidebar">
      <a className="brand" href="#overview"><span className="brand-mark"><Icon name="path" size={25} /></span><span>Roadmap<strong>Certificações</strong></span></a>
      <div className="sidebar-label">SEU ESPAÇO DE EVOLUÇÃO</div>
      <nav aria-label="Navegação principal"><a href="#overview"><Icon name="grid" />Visão geral</a><a href="#roadmaps"><Icon name="path" />Roadmaps</a><a href="#catalog"><Icon name="book" />Certificações<span className="nav-count">{certifications.length}</span></a></nav>
      <div className="sidebar-note"><span className="note-symbol" aria-hidden="true">↗</span><strong>Conhecimento abre caminhos.</strong><p>Escolha sua trilha e avance no seu ritmo.</p></div>
      <div className="local-mode"><span className="local-dot" aria-hidden="true" /><div><strong>{progressState.authenticated ? 'Cache neste navegador' : 'Seu espaço local'}</strong><small>{progressState.authenticated ? 'Progresso da conta.' : 'Progresso neste navegador.'}</small></div></div>
    </aside>
    <main id="main" tabIndex={-1}>
      <header className="page-header"><div className="breadcrumb">Meu espaço <span aria-hidden="true">/</span> <strong>Visão geral</strong></div><span className="local-label"><span aria-hidden="true">●</span> {progressState.authenticated ? 'Progresso da conta · cache local' : 'Progresso neste navegador'}</span></header>
      <div className="page-content">
        <AuthPanel service={authService} progressDescription={progressState.authenticated ? 'Progresso da conta no Supabase, com cache neste navegador.' : 'O progresso fica somente neste navegador, sem sincronização.'} />
        <SyncFeedback state={progressState} onRetry={() => void progressState.retry()} onImport={progressState.importVisitor} onDecline={progressState.declineVisitor} />
        <section className="welcome" aria-labelledby="welcome-title"><div><span className="eyebrow">APRENDA. CONQUISTE. EVOLUA.</span><h1 id="welcome-title">Cada passo conta<span>.</span></h1><p>Organize suas certificações e transforme planos em conquistas.</p></div><a className="primary-button" href="#catalog">Explorar certificações <Icon name="arrow" size={18} /></a></section>
        <DataTools onExportJson={progressState.exportJson} onExportCsv={() => catalogCsv(certifications, progressState.progress, providers, tracks)} onValidateImport={progressState.validateImport} onImport={progressState.importJson} knownIdentities={knownIdentities} />
        {progressState.warning && <div className="storage-warning" role="status"><strong>Atenção ao progresso local</strong><p>{progressState.warning}</p></div>}
        {unknownCount > 0 && <p className="notice" role="status">{unknownCount} registros de certificações indisponíveis foram preservados. Eles não entram nas métricas; continuam na exportação JSON.</p>}
        <Dashboard catalog={certifications} progress={progressState.progress} />
        <RoadmapPanel roadmaps={roadmaps} catalog={certifications} progress={progressState.progress} providers={providers} tracks={tracks} onExplore={explore} />
        <section id="catalog" className="section-anchor" aria-labelledby="catalog-title">
          <div className="section-heading"><div><span className="eyebrow">SUA PRÓXIMA CONQUISTA</span><h2 id="catalog-title" tabIndex={-1}>Catálogo de certificações</h2><p>Explore possibilidades e acompanhe o seu progresso.</p></div><span className="catalog-label">CATÁLOGO INICIAL</span></div>
          <Filters filters={filters} onChange={setFilters} providers={providers} tracks={availableTracks} levels={levels} />
          <div className="results-bar"><p role="status"><strong>{filtered.length}</strong> de {certifications.length} certificações <span className="subtle">· ordenadas por {filters.track ? 'ordem recomendada e nível' : 'nível e código'}</span></p>{hasFilters && <button className="text-button" onClick={() => setFilters(emptyFilters)}>Limpar filtros</button>}</div>
          {filtered.length > 0 ? <div className="catalog-grid">{filtered.map((certification) => <CertificationCard key={certificationIdentity(certification.provider, certification.code)} certification={certification} providerName={providers.find((provider) => provider.id === certification.provider)?.name ?? certification.provider} tracks={tracks} status={statusFor(certification, progressState.progress)} onStatusChange={progressState.changeStatus} />)}</div> : <div className="empty-state"><Icon name="search" size={32} /><h3>Nenhuma certificação encontrada</h3><p>Tente outro termo ou ajuste os filtros para explorar o catálogo.</p><button onClick={() => setFilters(emptyFilters)}>Limpar busca e filtros</button></div>}
          <p className="catalog-footnote">Dificuldade, prioridade e sequências são sugestões editoriais. Consulte a fonte oficial antes de planejar uma prova.</p>
        </section>
        <footer className="page-footer"><span>Roadmap de Certificações <span aria-hidden="true">·</span> Seu próximo passo começa aqui.</span><span>{progressState.authenticated ? 'Progresso da conta · cache local' : 'Uso local'} · exporte JSON para ter uma cópia</span></footer>
      </div>
    </main>
  </div>
}
