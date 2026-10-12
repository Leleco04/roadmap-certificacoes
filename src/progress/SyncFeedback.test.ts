import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SyncFeedback } from './SyncFeedback'
import type { SyncSnapshot } from './progressService'

function render(changes: Partial<SyncSnapshot>) {
  const state: SyncSnapshot = { progress: {}, warning: null, syncState: 'synced', syncError: null, lastSyncedAt: null, importAvailable: false, authenticated: true, ...changes }
  return renderToStaticMarkup(createElement(SyncFeedback, { state, onRetry: () => undefined, onImport: () => undefined, onDecline: () => undefined }))
}
describe('feedback global de sync', () => {
  it('visitante não exibe controles cloud', () => { expect(render({ authenticated: false })).toBe('') })
  it('mostra sincronizando e desabilita ações', () => {
    const html = render({ syncState: 'syncing', importAvailable: true })
    expect(html).toContain('Sincronizando')
    expect(html.match(/disabled=""/g)).toHaveLength(3)
  })
  it('erro permite retry sem poluir cards', () => {
    const html = render({ syncState: 'error', syncError: 'Não sincronizado' })
    expect(html).toContain('Não sincronizado')
    expect(html).toContain('Tentar sincronizar novamente')
  })
  it('importação pede confirmação explícita com opção de recusa', () => {
    const html = render({ importAvailable: true })
    expect(html).toContain('Importar progresso do visitante')
    expect(html).toContain('Não importar')
    expect(html).toContain('preservando o estado mais recente')
  })
})
