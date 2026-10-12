import { describe, expect, it } from 'vitest'
import { certifications, difficultyScale, priorityScale, providers, tracks } from './data'
import { roadmaps } from './roadmaps'
import { initialProgress } from './initialProgress'
import { certificationIdentity, emptyFilters, filterCertifications, isCanonicalIdentity, progressMetrics, sortCertifications, statusFor } from '../domain/certifications'
import { roadmapCertifications } from '../domain/roadmaps'
import { createProgressRepository, progressStorageKey } from '../persistence/progressRepository'
import { serializeProgress } from '../persistence/progressSerialization'
import { validateCatalog } from './validation'

describe('catálogo Microsoft P1', () => {
  it('passa a validação automatizada de dados, fontes, escalas e roadmaps', () => {
    expect(validateCatalog({ certifications, providers, tracks, roadmaps, difficultyScale, priorityScale })).toEqual([])
  })
  it('inclui o recorte acordado, sem códigos ou identidades duplicados', () => {
    expect(certifications.map((certification) => certification.code).sort()).toEqual([
      'AI-901', 'AI-103', 'AI-200', 'AI-300', 'AI-500', 'AB-620', 'AB-100',
      'AZ-900', 'AZ-104', 'AZ-305', 'AZ-700', 'AZ-400', 'AZ-140', 'AZ-120', 'AZ-802',
      'SC-900', 'SC-500', 'SC-300', 'SC-200', 'SC-401', 'SC-100',
      'DP-900', 'DP-700', 'DP-800', 'DP-600', 'DP-750', 'DP-300', 'DP-420', 'PL-300',
    ].sort())
    expect(new Set(certifications.map((certification) => certification.code.toLowerCase())).size).toBe(29)
    expect(new Set(certifications.map((certification) => certificationIdentity(certification.provider, certification.code))).size).toBe(29)
    expect(providers.map((provider) => provider.id)).toEqual(['microsoft'])
  })
  it('mantém provider e tracks válidos, fontes oficiais e progresso separado', () => {
    for (const certification of certifications) {
      expect(providers.some((provider) => provider.id === certification.provider)).toBe(true)
      expect(certification.tracks.length).toBeGreaterThan(0)
      for (const track of certification.tracks) expect(tracks.some((item) => item.id === track)).toBe(true)
      expect(new URL(certification.sourceUrl).hostname).toBe('learn.microsoft.com')
      expect(new URL(certification.sourceUrl).protocol).toBe('https:')
      expect(new URL(certification.sourceUrl).pathname).toMatch(/^\/en-us\/credentials\/certifications\//)
      expect(isCanonicalIdentity(certificationIdentity(certification.provider, certification.code))).toBe(true)
      expect(certification).not.toHaveProperty('status')
      expect(certification).not.toHaveProperty('updatedAt')
    }
  })
  it('mantém as 12 identidades P0 e todo progresso já persistido sem migration ou escrita', () => {
    const originalCodes = ['ai-901', 'ai-103', 'ai-200', 'az-900', 'az-104', 'az-305', 'sc-900', 'sc-500', 'sc-300', 'dp-900', 'dp-700', 'dp-800']
    const originalProgress = Object.fromEntries(originalCodes.map((code) => {
      const identity = `microsoft:${code}`
      return [identity, { certificationCode: identity, status: 'studying' as const, updatedAt: '2026-01-01T00:00:00.000Z' }]
    }))
    const serialized = serializeProgress(originalProgress)
    const repository = createProgressRepository(() => ({ getItem: (key) => key === progressStorageKey ? serialized : null, setItem: () => { throw new Error('Leitura não deve gravar nem migrar') } }))
    expect(repository.load()).toEqual({ progress: originalProgress, warning: null })
    for (const certificationCode of Object.keys(originalProgress)) {
      const certification = certifications.find((item) => certificationIdentity(item.provider, item.code) === certificationCode)
      expect(certification).toBeDefined()
      expect(statusFor(certification!, repository.load().progress)).toBe('studying')
    }
  })
  it('mantém as duas conclusões iniciais e não conta múltiplas tracks duas vezes', () => {
    expect(progressMetrics(certifications, initialProgress())).toEqual({ total: 29, done: 2, studying: 0, planned: 0, todo: 27, percentage: 7 })
  })
  it('não inclui códigos aposentados ou credenciais funcionais fora do recorte', () => {
    for (const code of ['AI-900', 'AI-102', 'DP-100', 'DP-203', 'AZ-204', 'AZ-500', 'AZ-800', 'AZ-801', 'SC-400', 'MS-102', 'AB-900', 'PL-200', 'PL-400', 'AB-410']) {
      expect(certifications.some((certification) => certification.code === code)).toBe(false)
    }
  })
  it('explicita transições e mantém pré-requisitos obrigatórios separados de recomendações', () => {
    expect(certifications.find((certification) => certification.code === 'DP-420')).toMatchObject({ name: 'Azure Cosmos DB AI Developer Associate', level: 'Associate', levelRank: 20 })
    expect(certifications.find((certification) => certification.code === 'AI-500')?.name).toContain('(beta)')
    expect(certifications.find((certification) => certification.code === 'AZ-305')?.prerequisites).toContain('obrigatória')
    expect(certifications.find((certification) => certification.code === 'AZ-120')?.prerequisites).toContain('não requisito formal')
    expect(certifications.find((certification) => certification.code === 'AZ-400')?.prerequisites).toContain('aposentada')
  })
  it('usa a escala editorial existente e validade compatível com os tiers oficiais', () => {
    for (const certification of certifications) {
      expect(difficultyScale).toContain(certification.difficulty)
      expect(priorityScale).toContain(certification.priority)
      expect(certification.levelRank).toBeGreaterThan(0)
      expect(Number.isSafeInteger(certification.levelRank)).toBe(true)
      expect(certification.validity).toBe(certification.level === 'Fundamentals' ? 'Não expira' : '12 meses')
      for (const track of certification.tracks) expect(certification.recommendedOrder?.[track]).toBeGreaterThan(0)
    }
  })
  it.each(['ai', 'cloud', 'cybersecurity', 'data', 'devops', 'development'])('filtros combinados funcionam na track %s', (track) => {
    const results = filterCertifications(certifications, initialProgress(), { ...emptyFilters, provider: 'microsoft', track, level: 'Associate', status: 'todo' }, providers, tracks)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((certification) => certification.provider === 'microsoft' && certification.tracks.includes(track) && certification.level === 'Associate' && !['AI-901', 'AI-103'].includes(certification.code))).toBe(true)
  })
  it.each([['GenAIOps', 'AI-300'], ['Databricks', 'DP-750'], ['Purview', 'SC-401'], ['Power BI', 'PL-300'], ['MCP', 'AB-620'], ['AI-500', 'AI-500']])('busca conteúdo/nome/código ampliados: %s', (query, code) => {
    expect(filterCertifications(certifications, {}, { ...emptyFilters, query }, providers, tracks).some((certification) => certification.code === code)).toBe(true)
  })
  it('certificação multitrack aparece em cada filtro, uma vez por resultado', () => {
    for (const track of ['cloud', 'ai', 'cybersecurity']) {
      expect(filterCertifications(certifications, {}, { ...emptyFilters, track }, providers, tracks).filter((certification) => certification.code === 'SC-500')).toHaveLength(1)
    }
  })
  it('ordena por track sem depender da ordem dos dados nem inventar dependências', () => {
    for (const track of ['ai', 'cloud', 'cybersecurity', 'data']) {
      const subset = certifications.filter((certification) => certification.tracks.includes(track))
      const ordered = sortCertifications([...subset].reverse(), track)
      expect(ordered).toEqual(sortCertifications(subset, track))
      const orders = ordered.map((certification) => certification.recommendedOrder?.[track])
      expect(orders).toEqual([...orders].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)))
    }
    expect(sortCertifications(certifications)[0]?.level).toBe('Fundamentals')
    expect(sortCertifications(certifications).at(-1)?.level).toBe('Specialty')
  })
  it('sequências são explícitas e suas referências pertencem ao provider/trilha', () => {
    expect(roadmaps.map((roadmap) => roadmap.track)).toEqual(['ai', 'cloud', 'cybersecurity', 'data'])
    for (const roadmap of roadmaps) {
      expect(roadmap.branches?.length).toBeGreaterThan(0)
      const allCodes = [roadmap.certificationCodes, ...(roadmap.branches ?? []).map((branch) => branch.certificationCodes)].flat()
      expect(new Set(allCodes).size).toBe(allCodes.length)
      for (const identity of allCodes) {
        const certification = [...certifications].reverse().find((item) => certificationIdentity(item.provider, item.code) === identity)
        expect(certification?.provider).toBe(roadmap.provider)
        expect(certification?.tracks).toContain(roadmap.track)
      }
    }
    const covered = new Set(roadmaps.flatMap((roadmap) => roadmapCertifications(roadmap, certifications).map((certification) => certificationIdentity(certification.provider, certification.code))))
    expect(covered.size).toBe(certifications.length)
    const dataRoadmap = roadmaps.find((roadmap) => roadmap.track === 'data')!
    expect(dataRoadmap.certificationCodes).toEqual(['microsoft:dp-900'])
    expect(dataRoadmap.branches?.find((branch) => branch.id === 'databricks')?.certificationCodes).toEqual(['microsoft:dp-750'])
  })
})
