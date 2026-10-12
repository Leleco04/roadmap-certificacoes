import type { CertificationStatus } from '../domain/models'

export const statusLabels: Record<CertificationStatus, string> = {
  todo: 'A fazer', planned: 'Planejada', studying: 'Estudando', done: 'Concluída',
}
