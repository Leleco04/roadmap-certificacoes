import { describe, expect, it } from 'vitest'
import { createServerClock } from './serverClock'

const stalled: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
  const signal = init?.signal
  if (signal?.aborted) reject(signal.reason)
  else signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
})

describe('limites de requests compartilhados por Auth e progresso', () => {
  it('conexão sem resposta termina com timeout sem calibrar relógio', async () => {
    const clock = createServerClock(stalled, Date.now, 20)
    await expect(clock.fetch('https://example.test')).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(clock.offsetMs()).toBeNull()
  })
  it('cancelamento do chamador continua autoritativo', async () => {
    const clock = createServerClock(stalled)
    const controller = new AbortController()
    const response = clock.fetch(new Request('https://example.test', { signal: controller.signal }))
    controller.abort()
    await expect(response).rejects.toMatchObject({ name: 'AbortError' })
  })
})
