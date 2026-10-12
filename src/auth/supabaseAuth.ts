import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAuthService } from './authService'
import type { AuthGateway, AuthUser } from './authService'
import { createServerClock } from '../persistence/serverClock'

export interface AuthEnvironment {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export function readAuthConfiguration(environment: AuthEnvironment) {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const key = environment.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url && !key) return { config: null, error: null }
  try {
    if (!url || !key) throw new Error('Incomplete configuration')
    const parsed = new URL(url)
    if (parsed.username || parsed.password || parsed.search || parsed.hash
      || !(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) {
      throw new Error('Invalid URL')
    }
    // Configuration check only; JWT verification and session management belong to Auth.
    if (!key.startsWith('sb_publishable_')) {
      const payload = key.split('.')[1]
      if (!payload || JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') {
        throw new Error('Only public keys are allowed')
      }
    }
    return { config: { url, key }, error: null }
  } catch {
    return { config: null, error: 'Login indisponível: confira a URL e a chave pública do Supabase na configuração.' }
  }
}

function authUser(user: User | undefined): AuthUser | null {
  if (!user) return null
  const name: unknown = user.user_metadata.full_name ?? user.user_metadata.name ?? user.user_metadata.user_name
  return { id: user.id, email: user.email, displayName: typeof name === 'string' ? name : undefined }
}

export function createSupabaseAuthGateway(client: SupabaseClient, redirectTo: string): AuthGateway {
  return {
    async restoreUser() {
      const initialized = await client.auth.initialize()
      if (initialized.error) throw initialized.error
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      return authUser(data.session?.user)
    },
    onUserChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // Keep this callback synchronous; no SDK calls under Auth's session lock.
        listener(authUser(session?.user))
      })
      return () => data.subscription.unsubscribe()
    },
    async signIn(provider) {
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } })
      if (error) throw error
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
    },
  }
}

export function browserAuthContext(environment: AuthEnvironment) {
  const { config, error } = readAuthConfiguration(environment)
  const clock = createServerClock()
  if (!config) return { authService: createAuthService(null, error), client: null, clock }
  try {
    const client = createClient(config.url, config.key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: clock.fetch },
    })
    // Return to this app's path, without forwarding query/hash input into redirects.
    const redirectTo = window.location.origin + window.location.pathname
    return { authService: createAuthService(createSupabaseAuthGateway(client, redirectTo)), client, clock }
  } catch {
    return { authService: createAuthService(null, 'Login indisponível neste navegador. Você pode continuar como visitante.'), client: null, clock }
  }
}

export function browserAuthService(environment: AuthEnvironment) {
  return browserAuthContext(environment).authService
}
