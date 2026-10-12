export type OAuthProvider = 'google' | 'github'

export interface AuthUser {
  id: string
  email?: string
  displayName?: string
}

export interface AuthGateway {
  restoreUser(): Promise<AuthUser | null>
  onUserChange(listener: (user: AuthUser | null) => void): () => void
  signIn(provider: OAuthProvider): Promise<void>
  signOut(): Promise<void>
}

export interface AuthSnapshot {
  configured: boolean
  loading: boolean
  user: AuthUser | null
  pending: OAuthProvider | 'logout' | null
  error: string | null
}

export interface AuthService {
  getSnapshot(): AuthSnapshot
  subscribe(listener: () => void): () => void
  signIn(provider: OAuthProvider): Promise<void>
  signOut(): Promise<void>
}

export function createAuthService(gateway: AuthGateway | null, configurationError: string | null = null): AuthService {
  let snapshot: AuthSnapshot = {
    configured: gateway !== null, loading: gateway !== null,
    user: null, pending: null, error: configurationError,
  }
  const listeners = new Set<() => void>()
  let unsubscribe: (() => void) | undefined
  let generation = 0

  function update(changes: Partial<AuthSnapshot>) {
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }

  function start() {
    if (!gateway) return
    const currentGeneration = ++generation
    let receivedEvent = false
    unsubscribe = gateway.onUserChange((user) => {
      if (generation !== currentGeneration) return
      receivedEvent = true
      // Do not reopen cloud access if a refresh event arrives during logout.
      update({ user, loading: false, pending: user ? snapshot.pending : null, error: null })
    })
    // Events are authoritative: a late initial read must not undo logout/login.
    void gateway.restoreUser().then((user) => {
      if (generation === currentGeneration && !receivedEvent) update({ user, loading: false })
    }).catch(() => {
      if (generation === currentGeneration) {
        update({ loading: false, error: 'Não foi possível recuperar a sessão. Tente entrar novamente.' })
      }
    })
  }

  async function action(pending: OAuthProvider | 'logout', execute: (gateway: AuthGateway) => Promise<void>, error: string) {
    if (!gateway || snapshot.loading || snapshot.pending) return
    update({ pending, error: null })
    try {
      await execute(gateway)
    } catch {
      update({ error })
    } finally {
      update({ pending: null })
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          ++generation
          unsubscribe?.()
          unsubscribe = undefined
        }
      }
    },
    signIn(provider) {
      return action(provider, (activeGateway) => activeGateway.signIn(provider), 'Não foi possível iniciar o login. Verifique sua conexão e tente novamente.')
    },
    signOut() {
      return action('logout', async (activeGateway) => {
        await activeGateway.signOut()
        update({ user: null })
      }, 'Não foi possível sair da conta. Verifique sua conexão e tente novamente.')
    },
  }
}
