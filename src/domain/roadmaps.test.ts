import { describe, expect, it } from 'vitest'
import { certifications } from '../catalog/data'
import { roadmapCertifications } from './roadmaps'
import { certificationIdentity, progressMetrics } from './certifications'
import type { Roadmap } from './models'

describe('roadmaps com ramificações', () => {
  const roadmap: Roadmap = {
    id: 'test', provider: 'microsoft', track: 'ai', description: 'Optional paths', certificationCodes: ['microsoft:ai-901'],
    branches: [
      { id: 'first', name: 'First', certificationCodes: ['microsoft:ai-103', 'microsoft:ai-200'] },
      { id: 'second', name: 'Second', certificationCodes: ['microsoft:ai-103', 'microsoft:ai-300'] },
    ],
  }
  it('preserva a ordem dos caminhos, independentemente dos cards, sem duplicar métricas', () => {
    const sequence = roadmapCertifications(roadmap, [...certifications].reverse())
    expect(sequence.map((certification) => certificationIdentity(certification.provider, certification.code))).toEqual(['microsoft:ai-901', 'microsoft:ai-103', 'microsoft:ai-200', 'microsoft:ai-300'])
    expect(progressMetrics(sequence, {}).total).toBe(4)
  })
  it('mantém compatibilidade com roadmaps lineares existentes', () => {
    expect(roadmapCertifications({ ...roadmap, branches: undefined }, certifications).map((certification) => certification.code)).toEqual(['AI-901'])
  })
  it('tolera referências ausentes na leitura sem quebrar a UI', () => {
    expect(roadmapCertifications({ ...roadmap, certificationCodes: ['microsoft:missing'], branches: [] }, certifications)).toEqual([])
  })
})
