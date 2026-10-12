import { describe, expect, it } from 'vitest'
import { deserializeProgress, serializeProgress } from './progressSerialization'
import type { ProgressMap } from '../domain/models'

const timestamp = '2026-10-08T12:00:00.000Z'
const progress: ProgressMap = {
  'microsoft:ai-103': { certificationCode: 'microsoft:ai-103', status: 'done', updatedAt: timestamp },
  'future:unknown': { certificationCode: 'future:unknown', status: 'todo', updatedAt: timestamp },
}
const envelope = (record: unknown) => JSON.stringify({ version: 1, progress: { 'microsoft:ai-103': record } })

describe('serialização e validação de importação', () => {
  it('roundtrip preserva identidades, status, timestamps e referências desconhecidas', () => {
    expect(deserializeProgress(serializeProgress(progress))).toEqual(progress)
    expect(JSON.parse(serializeProgress(progress))).toEqual({ version: 1, progress: {
      'microsoft:ai-103': { status: 'done', updatedAt: timestamp },
      'future:unknown': { status: 'todo', updatedAt: timestamp },
    } })
  })
  it('aceita um progresso vazio explícito e os quatro status', () => {
    expect(deserializeProgress('{"version":1,"progress":{}}')).toEqual({})
    for (const status of ['todo', 'planned', 'studying', 'done']) {
      expect(deserializeProgress(envelope({ status, updatedAt: timestamp }))['microsoft:ai-103']?.status).toBe(status)
    }
  })
  it.each(['', 'not json', '{', 'null', '[]', '{"version":2,"progress":{}}', '{"version":"1","progress":{}}', '{"version":1,"progress":[]}', '{"version":1}', '{"version":1,"progress":null}'])('rejeita JSON/formato/versão inválidos: %s', (text) => {
    expect(() => deserializeProgress(text)).toThrow()
  })
  it.each([null, [], {}, { status: 'completed', updatedAt: timestamp }, { status: 'done' }, { status: 'done', updatedAt: 42 }])('rejeita registro inválido: %j', (record) => {
    expect(() => deserializeProgress(envelope(record))).toThrow(/Registro inválido/)
  })
  it.each(['yesterday', '2026-02-30T12:00:00.000Z', '2026-10-08', '2026-10-08T12:00:00+00:00', '2026-10-08T25:00:00.000Z'])('rejeita timestamp inválido ou não UTC: %s', (updatedAt) => {
    expect(() => deserializeProgress(envelope({ status: 'done', updatedAt }))).toThrow()
  })
  it('aceita UTC sem milissegundos, preservando sua representação', () => {
    expect(deserializeProgress(envelope({ status: 'done', updatedAt: '2026-10-08T12:00:00Z' }))['microsoft:ai-103']?.updatedAt).toBe('2026-10-08T12:00:00Z')
  })
  it.each(['Microsoft:AI-103', 'a:b:c', '__proto__', 'constructor', 'a: x'])('rejeita identidades inválidas e chaves perigosas: %s', (identity) => {
    expect(() => deserializeProgress(JSON.stringify({ version: 1, progress: { [identity]: { status: 'done', updatedAt: timestamp } } }))).toThrow()
  })
  it('rejeita todo o arquivo se um registro for inválido, sem importação parcial', () => {
    const data: unknown = { version: 1, progress: { 'microsoft:ai-103': { status: 'done', updatedAt: timestamp }, 'microsoft:ai-901': { status: 'invalid', updatedAt: timestamp } } }
    expect(() => deserializeProgress(JSON.stringify(data))).toThrow()
  })
  it('não serializa um registro cuja identidade difere da chave', () => {
    expect(() => serializeProgress({ 'a:b': { certificationCode: 'a:c', status: 'done', updatedAt: timestamp } })).toThrow(/inconsistente/)
  })
})
