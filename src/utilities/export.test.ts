import { describe, expect, it } from 'vitest'
import { catalogCsv } from './export'
import type { Certification } from '../domain/models'

const certification: Certification = {
  provider: 'example', code: 'X-1', name: 'Dados, "IA"\ne cloud', tracks: ['ai', 'cloud'], mainContent: ['SQL', 'Modelos'], sourceUrl: 'https://example.org',
}

describe('CSV de catálogo e progresso', () => {
  it('usa BOM, cabeçalho, escape de aspas, vírgulas e quebras de linha', () => {
    const csv = catalogCsv([certification], {}, [], [])
    expect(csv.startsWith('\uFEFF"identity","code"')).toBe(true)
    expect(csv).toContain('"Dados, ""IA""\ne cloud"')
    expect(csv).toContain('"example:x-1"')
    expect(csv).toContain('"ai | cloud"')
    expect(csv).toContain('"todo"')
    expect(csv.split('\r\n')).toHaveLength(2)
  })
  it('inclui progresso e metadados sem duplicação por track', () => {
    const csv = catalogCsv([certification], { 'example:x-1': { certificationCode: 'example:x-1', status: 'done', updatedAt: '2026-10-08T00:00:00.000Z' } }, [{ id: 'example', name: 'Example', slug: 'example', website: 'https://example.org' }], [])
    expect(csv).toContain('"Example"')
    expect(csv).toContain('"done","2026-10-08T00:00:00.000Z"')
  })
  it.each(['=SUM(1,2)', '+cmd', '-10+20', '@formula', '  =FORMULA', '\tcmd'])('neutraliza fórmula de planilha: %s', (name) => {
    expect(catalogCsv([{ ...certification, name }], {}, [], [])).toContain(`"'${name}"`)
  })
})
