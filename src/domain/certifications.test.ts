import { describe, expect, it } from 'vitest'
import { certificationIdentity, emptyFilters, filterCertifications, isCanonicalIdentity, progressMetrics, sortCertifications, statusFor } from './certifications'
import type { Certification, CertificationProvider, ProgressMap, Track } from './models'

const providers: CertificationProvider[] = [
  { id: 'first', name: 'Primeiro Provider', slug: 'first', website: 'https://example.org' },
  { id: 'second', name: 'Segundo Provider', slug: 'second', website: 'https://example.org' },
]
const tracks: Track[] = [{ id: 'ai', name: 'Inteligência Artificial', slug: 'ai' }, { id: 'cloud', name: 'Cloud', slug: 'cloud' }]
const catalog: Certification[] = [
  { provider: 'first', code: 'B-20', name: 'Agentes e aplicações', tracks: ['ai', 'cloud'], level: 'Professional', levelRank: 30, recommendedOrder: { ai: 10, cloud: 30 }, mainContent: ['Modelos e visão computacional'], sourceUrl: 'https://example.org' },
  { provider: 'first', code: 'A-10', name: 'Fundamentos', tracks: ['cloud'], level: 'Foundational', levelRank: 10, recommendedOrder: { cloud: 10 }, mainContent: ['Redes e infraestrutura'], sourceUrl: 'https://example.org' },
  { provider: 'second', code: 'A-10', name: 'Desenvolvimento de IA', tracks: ['ai'], mainContent: ['Modelos e Python'], sourceUrl: 'https://example.org' },
]
const timestamp = '2026-10-08T12:00:00.000Z'
const progress: ProgressMap = {
  'first:b-20': { certificationCode: 'first:b-20', status: 'done', updatedAt: timestamp },
  'first:a-10': { certificationCode: 'first:a-10', status: 'studying', updatedAt: timestamp },
  'other:x': { certificationCode: 'other:x', status: 'done', updatedAt: timestamp },
}

describe('identidade canônica', () => {
  it('normaliza espaços externos e lowercase sem alterar códigos de exibição', () => {
    expect(certificationIdentity(' Microsoft ', ' AI-103 ')).toBe('microsoft:ai-103')
    expect(catalog[0]?.code).toBe('B-20')
  })
  it('distingue códigos iguais em providers diferentes', () => {
    expect(certificationIdentity('first', 'A-10')).not.toBe(certificationIdentity('second', 'A-10'))
  })
  it.each([['', 'x'], ['a:b', 'x'], ['first', ''], ['a b', 'x'], ['first', 'a:b']])('rejeita partes inválidas %s / %s', (provider, code) => {
    expect(() => certificationIdentity(provider, code)).toThrow()
  })
  it.each(['Microsoft:AI-103', 'a:b:c', '__proto__', ':x', 'a:', 'a: x'])('rejeita chave não canônica %s', (identity) => {
    expect(isCanonicalIdentity(identity)).toBe(false)
  })
})

describe('métricas de progresso', () => {
  it('conta certificações únicas mesmo com múltiplas tracks e duplicação de entrada', () => {
    expect(progressMetrics([...catalog, ...catalog], progress)).toEqual({ total: 3, done: 1, studying: 1, planned: 0, todo: 1, percentage: 33 })
  })
  it('não inclui progresso fora do catálogo e retorna zero em catálogo vazio', () => {
    expect(progressMetrics([], progress)).toEqual({ total: 0, done: 0, studying: 0, planned: 0, todo: 0, percentage: 0 })
  })
  it('calcula métricas do conjunto filtrado quando solicitado explicitamente', () => {
    expect(progressMetrics(catalog.slice(0, 1), progress).percentage).toBe(100)
    expect(progressMetrics(catalog, progress).percentage).toBe(33)
  })
  it('status ausente equivale a todo; planned é contado separadamente', () => {
    const certification = catalog[2]!
    expect(statusFor(certification, progress)).toBe('todo')
    expect(progressMetrics(catalog, { ...progress, 'second:a-10': { certificationCode: 'second:a-10', status: 'planned', updatedAt: timestamp } }).planned).toBe(1)
  })
})

describe('filtros e busca', () => {
  const filter = (changes: Partial<typeof emptyFilters>) => filterCertifications(catalog, progress, { ...emptyFilters, ...changes }, providers, tracks)
  it('combina provider, track, level, status e busca', () => {
    expect(filter({ provider: 'first', track: 'ai', level: 'Professional', status: 'done', query: 'AGENTES visão' })).toEqual([catalog[0]])
    expect(filter({ provider: 'second', track: 'cloud' })).toEqual([])
  })
  it('reconhece certificações com várias tracks sem duplicá-las', () => {
    expect(filter({ track: 'ai' })).toHaveLength(2)
    expect(filter({ track: 'cloud' })).toHaveLength(2)
  })
  it.each(['b-20', 'aplicacoes', 'visao', 'Primeiro Provider', 'inteligencia artificial'])('busca código, nome, conteúdo, provider e track: %s', (query) => {
    expect(filter({ query })).toContain(catalog[0])
  })
  it('ignora caixa, acentos e espaços externos', () => {
    expect(filter({ query: '  APLICAÇÕES   VISAO ' })).toEqual([catalog[0]])
  })
  it('filtra níveis não padronizados e certificações sem nível', () => {
    expect(filter({ level: 'Sem nível' })).toEqual([catalog[2]])
    expect(filter({ level: 'Professional' })).toEqual([catalog[0]])
  })
  it('ausência de filtros retorna todo o catálogo; busca inexistente retorna vazio', () => {
    expect(filter({})).toEqual(catalog)
    expect(filter({ query: 'inexistente' })).toEqual([])
  })
  it('alterações de status afetam imediatamente o filtro', () => {
    const changed = { ...progress, 'first:b-20': { certificationCode: 'first:b-20', status: 'planned' as const, updatedAt: timestamp } }
    expect(filterCertifications(catalog, changed, { ...emptyFilters, status: 'done' }, providers, tracks)).toEqual([])
  })
})

describe('ordenação', () => {
  it('usa rank e mantém registros sem nível ao final', () => {
    expect(sortCertifications(catalog).map((certification) => certificationIdentity(certification.provider, certification.code))).toEqual(['first:a-10', 'first:b-20', 'second:a-10'])
    expect(catalog[0]?.code).toBe('B-20')
  })
  it('usa ordem contextual da trilha antes de rank', () => {
    expect(sortCertifications(catalog, 'ai')[0]).toBe(catalog[0])
    expect(sortCertifications(catalog, 'cloud')[0]).toBe(catalog[1])
  })
  it('resolve empates por identidade e não depende da ordem de entrada', () => {
    const tied = catalog.map((certification) => ({ ...certification, levelRank: 10, recommendedOrder: {} }))
    expect(sortCertifications(tied)).toEqual(sortCertifications([...tied].reverse()))
  })
})
