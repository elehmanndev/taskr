export class ApiError extends Error {
  status: number
  body: any
  constructor(status: number, message: string, body: any) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : null

  if (!res.ok) {
    const msg = (data && typeof data === 'object' && data.error) || res.statusText
    throw new ApiError(res.status, msg, data)
  }
  return data as T
}

export const api = {
  get:    <T = any>(path: string)               => request<T>('GET', path),
  post:   <T = any>(path: string, body?: any)   => request<T>('POST', path, body),
  put:    <T = any>(path: string, body?: any)   => request<T>('PUT', path, body),
  patch:  <T = any>(path: string, body?: any)   => request<T>('PATCH', path, body),
  delete: <T = any>(path: string)               => request<T>('DELETE', path),
}
