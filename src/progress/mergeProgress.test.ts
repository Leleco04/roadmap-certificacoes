import { describe, expect, it } from 'vitest'
import type { CertificationStatus, ProgressMap } from '../domain/models'
import { mergeProgress } from './mergeProgress'

function records(status: CertificationStatus, updatedAt = '2026-10-11T10:00:00.000Z', id = 'microsoft:ai-103'): ProgressMap {
  return { [id]: { certificationCode: id, status, updatedAt } }
}

describe('merge independente por certificação', () => {
  it('local e remoto vazios', () => { expect(mergeProgress({}, {})).toEqual({ progress: {}, uploads: {} }) })
  it('local com dados e remoto vazio', () => {
    const local = records('done')
    expect(mergeProgress(local, {})).toEqual({ progress: local, uploads: local })
  })
  it('local vazio e remoto com dados', () => {
    const remote = records('done')
    expect(mergeProgress({}, remote)).toEqual({ progress: remote, uploads: {} })
  })
  it('ambos iguais não geram escrita', () => {
    const data = records('done')
    expect(mergeProgress(data, data)).toEqual({ progress: data, uploads: {} })
  })
  it('local mais recente vence', () => {
    const local = records('studying', '2026-10-11T11:00:00.000Z')
    expect(mergeProgress(local, records('done'))).toEqual({ progress: local, uploads: local })
  })
  it('remoto mais recente vence e empate favorece remoto', () => {
    const remote = records('done', '2026-10-11T11:00:00.000Z')
    expect(mergeProgress(records('planned'), remote)).toEqual({ progress: remote, uploads: {} })
    expect(mergeProgress(records('planned'), records('done')).progress).toEqual(records('done'))
  })
  it('valores iguais adotam a data cloud sem loops por relógio local adiantado', () => {
    const remote = records('done')
    expect(mergeProgress(records('done', '2030-01-01T00:00:00.000Z'), remote)).toEqual({ progress: remote, uploads: {} })
  })
  it('conflitos distintos são independentes e registros não envolvidos permanecem', () => {
    const local = { ...records('done', '2026-10-11T11:00:00.000Z'), ...records('planned', undefined, 'microsoft:az-900'), ...records('todo', undefined, 'future:cert') }
    const remote = { ...records('planned'), ...records('studying', '2026-10-11T12:00:00.000Z', 'microsoft:az-900'), ...records('done', undefined, 'microsoft:dp-700') }
    const original = structuredClone({ local, remote })
    const result = mergeProgress(local, remote)
    expect(result.progress['microsoft:ai-103']?.status).toBe('done')
    expect(result.progress['microsoft:az-900']?.status).toBe('studying')
    expect(result.progress['future:cert']).toEqual(local['future:cert'])
    expect(result.progress['microsoft:dp-700']).toEqual(remote['microsoft:dp-700'])
    expect(Object.keys(result.uploads).sort()).toEqual(['future:cert', 'microsoft:ai-103'])
    expect({ local, remote }).toEqual(original)
  })
})
