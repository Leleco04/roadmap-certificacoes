export interface CertificationProvider {
  id: string
  name: string
  slug: string
  website: string
}

export interface Track {
  id: string
  name: string
  slug: string
}

export interface Certification {
  provider: string
  code: string
  name: string
  tracks: readonly string[]
  level?: string
  levelRank?: number
  recommendedOrder?: Readonly<Record<string, number>>
  validity?: string
  renewal?: string
  difficulty?: string
  priority?: string
  mainContent: readonly string[]
  prerequisites?: string
  relevance?: string
  sourceUrl: string
}

export const certificationStatuses = ['todo', 'planned', 'studying', 'done'] as const
export type CertificationStatus = (typeof certificationStatuses)[number]

export interface CertificationProgress {
  certificationCode: string
  status: CertificationStatus
  updatedAt: string
}

export type ProgressMap = Record<string, CertificationProgress>

export interface Roadmap {
  id: string
  provider: string
  track: string
  description: string
  certificationCodes: readonly string[]
  branches?: readonly RoadmapBranch[]
}

export interface RoadmapBranch {
  id: string
  name: string
  certificationCodes: readonly string[]
}
