import type { ProgressMap } from '../domain/models'

export interface ProgressMerge {
  progress: ProgressMap
  uploads: ProgressMap
}

export function mergeProgress(local: ProgressMap, remote: ProgressMap): ProgressMerge {
  const progress: ProgressMap = { ...remote }
  const uploads: ProgressMap = {}
  for (const [identity, record] of Object.entries(local)) {
    const cloud = remote[identity]
    // Equal values need no write, even when their clocks differ. Cloud wins ties.
    if (!cloud || (record.status !== cloud.status && Date.parse(record.updatedAt) > Date.parse(cloud.updatedAt))) {
      progress[identity] = record
      uploads[identity] = record
    }
  }
  return { progress, uploads }
}
