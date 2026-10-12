import { useSyncExternalStore } from 'react'
import type { AuthService } from './authService'

export function useAuth(service: AuthService) {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  return { ...snapshot, signIn: service.signIn, signOut: service.signOut }
}
