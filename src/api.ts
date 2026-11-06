import type { Envelope, PublicError } from "../shared/contracts";

export class ApiError extends Error {
  readonly detail: PublicError;
  constructor(detail: PublicError) {
    super(detail.message);
    this.detail = detail;
  }
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as Envelope<T>;
  if ("error" in body) throw new ApiError(body.error);
  if (!response.ok || !("data" in body))
    throw new Error(
      "The local server returned an unexpected response. Restart it and try again."
    );
  return body.data;
}
