export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Default SWR fetcher: GET a JSON endpoint, throw ApiError on non-2xx. */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** POST a JSON body, parse the JSON response, throw ApiError on non-2xx. */
export async function postJson<TBody, TResponse>(url: string, body: TBody): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.message ?? res.statusText);
  }
  return res.json() as Promise<TResponse>;
}
