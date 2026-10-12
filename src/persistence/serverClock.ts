export interface ServerClock {
  offsetMs(): number | null
  fetch: typeof fetch
}

// HTTP Date estimates current server time, unlike a row's last edit timestamp.
// Its second precision/network latency limit accuracy. Cache the offset offline.
export function createServerClock(transport: typeof fetch = (...args) => fetch(...args), now: () => number = Date.now, timeoutMs = 15_000): ServerClock {
  let offset: number | null = null
  return {
    offsetMs: () => offset,
    async fetch(...args) {
      const started = now()
      const [input, init] = args
      const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : null)
      const timeout = AbortSignal.timeout(timeoutMs)
      const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout
      const response = await transport(input, { ...init, signal })
      const date = response.headers.get('Date')
      const serverTime = date ? Date.parse(date) : NaN
      if (response.ok && Number.isFinite(serverTime)) offset = serverTime - (started + now()) / 2
      return response
    },
  }
}
