import { useEffect, useSyncExternalStore } from 'react'
import type { ProgressService } from './progressService'

export function useProgress(service: ProgressService) {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  useEffect(() => {
    const retry = () => { void service.retry() }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [service])
  return {
    ...snapshot,
    changeStatus: service.changeStatus,
    importJson: service.importJson,
    validateImport: service.validateImport,
    exportJson: service.exportJson,
    retry: service.retry,
    importVisitor: service.importVisitor,
    declineVisitor: service.declineVisitor,
  }
}
