import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AuthPanel } from './AuthPanel'
import { createAuthService } from '../auth/authService'
import type { AuthService, AuthSnapshot } from '../auth/authService'

function render(changes: Partial<AuthSnapshot> = {}) {
  const snapshot: AuthSnapshot = { configured: true, loading: false, pending: null, user: null, error: null, ...changes }
  const service: AuthService = { getSnapshot: () => snapshot, subscribe: () => () => undefined, signIn: vi.fn(), signOut: vi.fn() }
  return renderToStaticMarkup(createElement(AuthPanel, { service }))
}

describe('UI de conta', () => {
  it('oferece os dois providers para visitante e informa progresso local', () => {
    const html = render()
    expect(html).toContain('Modo visitante')
    expect(html).toContain('Entrar com Google')
    expect(html).toContain('Entrar com GitHub')
    expect(html).toContain('somente neste navegador')
  })
  it('sem configuração continua visitante com login indisponível', () => {
    const html = renderToStaticMarkup(createElement(AuthPanel, { service: createAuthService(null) }))
    expect(html).toContain('Modo visitante')
    expect(html).toContain('Login indisponível')
    expect(html).not.toContain('<button')
  })
  it('carregamento desabilita login', () => {
    const html = render({ loading: true })
    expect(html).toContain('Carregando sessão')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain('aria-busy="true"')
  })
  it('mostra usuário autenticado e botão de logout; escapa metadados', () => {
    const html = render({ user: { id: 'a', displayName: '<script>secret</script>' } })
    expect(html).toContain('Conta conectada')
    expect(html).toContain('Sair da conta')
    expect(html).not.toContain('Entrar com')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
  it('mostra fallback sem depender da tabela profiles', () => {
    expect(render({ user: { id: 'a', email: 'person@example.com' } })).toContain('person@example.com')
    expect(render({ user: { id: 'a' } })).toContain('Usuário conectado')
  })
  it('anuncia falhas e mostra ação pendente', () => {
    const html = render({ pending: 'google', error: 'Falha no login' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Falha no login')
    expect(html).toContain('Entrando')
    expect(html.match(/disabled=""/g)).toHaveLength(2)
  })
})
