import { describe, expect, it } from 'vitest'
import { certifications, difficultyScale, priorityScale, providers, tracks } from './data'
import { roadmaps } from './roadmaps'
import { validateCatalog } from './validation'
import type { Certification } from '../domain/models'

const input = { certifications, providers, tracks, roadmaps, difficultyScale, priorityScale }
const first = certifications[0]!
const checkCertification = (change: Partial<Certification>) => validateCatalog({ ...input, certifications: [{ ...first, ...change }, ...certifications.slice(1)] })

describe('validador de catálogo', () => {
  it('detecta código duplicado mesmo com diferenças de caixa', () => {
    expect(validateCatalog({ ...input, certifications: [...certifications, { ...first, code: first.code.toLowerCase() }] })).toEqual(expect.arrayContaining([expect.stringContaining('código duplicado')]))
  })
  it.each([
    [{ code: 'a:b' }, 'identidade'], [{ provider: 'invalid' }, 'provider inexistente'],
    [{ tracks: [] }, 'tracks'], [{ tracks: ['missing'] }, 'tracks'], [{ tracks: ['ai', 'ai'] }, 'tracks'],
    [{ level: '' }, 'level'], [{ levelRank: -10 }, 'levelRank'], [{ levelRank: NaN }, 'levelRank'], [{ levelRank: 1.5 }, 'levelRank'],
    [{ difficulty: 'Expert' }, 'difficulty'], [{ priority: 'Oficial' }, 'priority'],
    [{ recommendedOrder: { missing: 10 } }, 'recommendedOrder'], [{ recommendedOrder: { ai: 0 } }, 'recommendedOrder'], [{ recommendedOrder: { ai: Infinity } }, 'recommendedOrder'],
    [{ sourceUrl: 'javascript:alert(1)' }, 'sourceUrl'], [{ sourceUrl: 'https://learn.microsoft.com.evil.org/credentials/' }, 'sourceUrl'],
    [{ sourceUrl: 'https://evil@learn.microsoft.com/credentials/' }, 'sourceUrl'], [{ sourceUrl: 'http://learn.microsoft.com/' }, 'sourceUrl'],
    [{ name: ' ' }, 'nome vazio'], [{ mainContent: [''] }, 'conteúdo vazio'],
  ] satisfies [Partial<Certification>, string][])('detecta dados inconsistentes %j', (change, expected) => {
    expect(checkCertification(change).join('\n')).toContain(expected)
  })
  it('detecta IDs, slugs e websites inconsistentes', () => {
    expect(validateCatalog({ ...input, providers: [...providers, ...providers], tracks: [...tracks, ...tracks], roadmaps: [...roadmaps, ...roadmaps] }).join('\n')).toContain('duplicado')
    expect(validateCatalog({ ...input, providers: [{ ...providers[0]!, website: 'invalid' }] }).join('\n')).toContain('website inválido')
    expect(validateCatalog({ ...input, tracks: [{ ...tracks[0]!, id: 'Uppercase', slug: 'Uppercase' }] }).join('\n')).toContain('id inválido')
  })
  it('detecta mistura de status com catálogo estático', () => {
    const contaminated = { ...first, status: 'done' }
    expect(validateCatalog({ ...input, certifications: [contaminated] }).join('\n')).toContain('progresso misturado')
  })
  it('detecta referências inexistentes em base e ramificações', () => {
    const roadmap = roadmaps[0]!
    expect(validateCatalog({ ...input, roadmaps: [{ ...roadmap, certificationCodes: ['microsoft:missing'], branches: [{ id: 'missing', name: 'Missing', certificationCodes: ['Microsoft:AI-300'] }] }] }).join('\n')).toContain('referência inexistente')
  })
  it('detecta sequência duplicada e referência de outra track/provider', () => {
    const roadmap = roadmaps[0]!
    expect(validateCatalog({ ...input, roadmaps: [{ ...roadmap, branches: [{ id: 'wrong', name: 'Wrong', certificationCodes: ['microsoft:az-900', 'microsoft:az-900'] }] }] }).join('\n')).toContain('sequência vazia ou duplicada')
    expect(validateCatalog({ ...input, roadmaps: [{ ...roadmap, provider: 'other', branches: [] }] }).join('\n')).toContain('referência fora do provider/track')
  })
  it('permite níveis futuros e códigos iguais em providers diferentes', () => {
    const future = { ...first, provider: 'future', level: 'Custom level', levelRank: 35, sourceUrl: 'https://docs.future.example.org/certifications/' }
    expect(validateCatalog({ ...input, providers: [...providers, { id: 'future', name: 'Future', slug: 'future', website: 'https://future.example.org' }], certifications: [...certifications, future] })).toEqual([])
  })
})
