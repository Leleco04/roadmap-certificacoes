import type { SyncSnapshot } from './progressService'

export function SyncFeedback({ state, onRetry, onImport, onDecline }: {
  state: SyncSnapshot; onRetry: () => void; onImport: () => void; onDecline: () => void
}) {
  if (!state.authenticated) return null
  const busy = state.syncState === 'syncing'
  const label = busy ? 'Sincronizando progresso…' : state.syncState === 'synced' ? 'Progresso sincronizado.' : 'Progresso não sincronizado.'
  return <div className="data-tools">
    <p className="tool-message" role="status">{state.syncError || label}</p>
    <div className="toolbar"><button type="button" disabled={busy} onClick={onRetry}>{state.syncState === 'error' ? 'Tentar sincronizar novamente' : 'Atualizar progresso da conta'}</button></div>
    {state.importAvailable && <div className="notice">
      <p>Importar o progresso do visitante para esta conta? Cada certificação será mesclada, preservando o estado mais recente.</p>
      <div className="toolbar"><button type="button" disabled={busy} onClick={onImport}>Importar progresso do visitante</button><button type="button" disabled={busy} onClick={onDecline}>Não importar</button></div>
    </div>}
  </div>
}
