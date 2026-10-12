import type { ProgressMap } from '../domain/models'

export function initialProgress(): ProgressMap {
  const updatedAt = new Date().toISOString()
  return Object.fromEntries(['microsoft:ai-901', 'microsoft:ai-103'].map((certificationCode) => [
    certificationCode, { certificationCode, status: 'done', updatedAt },
  ]))
}
