import type { ProgressMap } from '../domain/models'
import { deserializeProgress, serializeProgress } from './progressSerialization'

export const progressStorageKey = 'roadmap-certificacoes.progress'

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ProgressSnapshot {
  progress: ProgressMap
  warning: string | null
}

export interface ProgressRepository {
  load(): ProgressSnapshot
  save(progress: ProgressMap): string | null
  exportJson(progress: ProgressMap): string
  validateImport(text: string): ProgressMap
  importJson(text: string): ProgressSnapshot
}

export function createProgressRepository(
  storage: () => StoragePort,
  seed: () => ProgressMap = () => ({}),
): ProgressRepository {
  let protectedState = false

  function save(progress: ProgressMap): string | null {
    if (protectedState) return 'Dados locais indisponíveis ou não reconhecidos foram preservados. As alterações estão apenas em memória; exporte JSON ou importe um arquivo válido para substituir os dados.'
    try {
      storage().setItem(progressStorageKey, serializeProgress(progress))
      return null
    } catch {
      return 'Não foi possível salvar neste navegador. As alterações estão em memória; exporte JSON antes de sair.'
    }
  }

  return {
    load() {
      let serialized: string | null
      try { serialized = storage().getItem(progressStorageKey) } catch {
        protectedState = true
        return { progress: seed(), warning: 'Armazenamento local indisponível. Use exportação JSON para guardar seu progresso.' }
      }
      if (serialized === null) {
        const progress = seed()
        return { progress, warning: save(progress) }
      }
      try {
        const progress = deserializeProgress(serialized)
        protectedState = false
        return { progress, warning: null }
      } catch (error) {
        protectedState = true
        const reason = error instanceof Error ? error.message : 'Formato inválido.'
        return { progress: {}, warning: `${reason} Os dados originais foram preservados. Alterações ficarão em memória até uma importação válida.` }
      }
    },
    save,
    exportJson: serializeProgress,
    validateImport: deserializeProgress,
    importJson(text) {
      const progress = deserializeProgress(text)
      // This is called only after the user confirms replacement in the UI.
      protectedState = false
      return { progress, warning: save(progress) }
    },
  }
}

export function browserProgressRepository(seed: () => ProgressMap): ProgressRepository {
  return createProgressRepository(() => window.localStorage, seed)
}
