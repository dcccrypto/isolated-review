const TRANSIENT_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

interface StatusLike {
  status?: number;
  code?: string;
  message?: string;
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as StatusLike;
  if (typeof e.status === 'number' && TRANSIENT_STATUSES.has(e.status)) return true;
  if (typeof e.code === 'string' && (
    e.code === 'ECONNRESET' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'ENETUNREACH' ||
    e.code === 'EAI_AGAIN' ||
    e.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    e.code === 'UND_ERR_SOCKET'
  )) return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (/rate limit|overloaded|try again|temporarily/i.test(msg)) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[] = [1000, 3000]
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt === delays.length || !isTransient(e)) throw e;
      await new Promise(res => setTimeout(res, delays[attempt]));
    }
  }
  throw lastError;
}
