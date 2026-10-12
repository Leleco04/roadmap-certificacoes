import type { AuthService } from '../auth/authService'
import { useAuth } from '../auth/useAuth'

export function AuthPanel({ service, progressDescription = 'O progresso fica somente neste navegador, mesmo com login.' }: { service: AuthService; progressDescription?: string }) {
  const auth = useAuth(service)
  const busy = auth.loading || auth.pending !== null
  return <section className="auth-panel" aria-label="Sua conta" aria-busy={busy}>
    <div className="auth-details" aria-live="polite">
      <strong>{auth.loading ? 'Carregando sessão…' : auth.user ? 'Conta conectada' : 'Modo visitante'}</strong>
      {auth.user && <span className="auth-identity">{auth.user.displayName || auth.user.email || 'Usuário conectado'}</span>}
      <p>{progressDescription}</p>
    </div>
    <div className="auth-actions">
      {auth.user ? <button type="button" disabled={busy} onClick={() => void auth.signOut()}>{auth.pending === 'logout' ? 'Saindo…' : 'Sair da conta'}</button>
        : auth.configured ? <>
          <button type="button" disabled={busy} onClick={() => void auth.signIn('google')}>{auth.pending === 'google' ? 'Entrando…' : 'Entrar com Google'}</button>
          <button type="button" disabled={busy} onClick={() => void auth.signIn('github')}>{auth.pending === 'github' ? 'Entrando…' : 'Entrar com GitHub'}</button>
        </> : <span className="subtle">Login indisponível neste ambiente.</span>}
    </div>
    {auth.error && <p className="auth-error" role="alert">{auth.error}</p>}
  </section>
}
