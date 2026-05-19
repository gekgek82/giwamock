import { getMockResponse } from "@/lib/mocks";

/**
 * Shared API client primitives.
 *
 * `apiFetch`, `apiUpload`, and `buildQuery` are the low-level helpers used by
 * `indexerApi`, `portfolioApi`, and `adminApi`. They are pure functions so
 * they can be unit-tested with a mocked `fetch` without any React or
 * singleton setup.
 *
 * Each caller passes an `ApiClientConfig` that carries:
 * - `baseUrl` for the target service
 * - `createError` / `isOwnError` so callers keep their own Error subclass
 *   (e.g. `IndexerApiError`) — `instanceof` checks on the consumer side keep
 *   working unchanged.
 * - `getHeaders` for per-request header injection (e.g. admin bearer token).
 */

export interface ApiErrorBody {
  /** Nest often returns `string` or `string[]` (validation). */
  message?: string | string[];
  error?: string;
}

function pickHttpErrorMessage(
  errorData: ApiErrorBody | null,
): string | undefined {
  if (!errorData) return undefined;
  const { message, error } = errorData;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (Array.isArray(message) && message.length > 0) {
    const joined = message.map((m) => String(m).trim()).filter(Boolean).join("; ");
    if (joined) return joined;
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return undefined;
}

function httpErrorFallback(response: Response): string {
  const st = response.statusText?.trim();
  return st
    ? `HTTP ${response.status}: ${st}`
    : `HTTP ${response.status} (no status text)`;
}

export interface ApiClientConfig {
  baseUrl: string;
  /** Build the client-specific error instance. */
  createError: (
    message: string,
    statusCode?: number,
    errorCode?: string,
    endpoint?: string,
  ) => Error;
  /** True when the error was already produced by `createError`. */
  isOwnError: (error: unknown) => boolean;
  /** Optional per-request header injector (e.g. for auth tokens). */
  getHeaders?: () => Record<string, string> | undefined;
  /** Used in the fallback message: `Failed to fetch from <label>: ...`. */
  networkErrorLabel: string;
}

/**
 * JSON fetch with unified error handling. Throws via `config.createError`
 * for non-2xx responses and network failures, passing through any error
 * that `config.isOwnError` recognises.
 *
 * When `NEXT_PUBLIC_MOCK_DATA=true`, every call is first routed through
 * `getMockResponse(...)` from `@/lib/mocks`. Matched requests return canned
 * data and never hit the network; unmatched ones fall through to real fetch.
 */
export async function apiFetch<T>(
  config: ApiClientConfig,
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;

  const mock = getMockResponse({
    method: options?.method ?? "GET",
    url,
    body: options?.body,
  });
  if (mock.matched) {
    return mock.data as T;
  }

  const extraHeaders = config.getHeaders?.() ?? {};

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
        ...((options?.headers as Record<string, string>) ?? {}),
      },
    });

    if (!response.ok) {
      let errorData: ApiErrorBody | null = null;
      try {
        errorData = await response.json();
      } catch {
        // Response body is not JSON — fall back to statusText.
      }

      throw config.createError(
        pickHttpErrorMessage(errorData) ?? httpErrorFallback(response),
        response.status,
        typeof errorData?.error === "string" ? errorData.error : undefined,
        endpoint,
      );
    }

    // 204 No Content (common for DELETE) has no body.
    if (response.status === 204) {
      return undefined as T;
    }

    // Some successful responses legitimately return an empty body.
    // Avoid throwing `Unexpected end of JSON input` in that case.
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (config.isOwnError(error)) {
      throw error;
    }

    throw config.createError(
      `Failed to fetch from ${config.networkErrorLabel}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      undefined,
      undefined,
      endpoint,
    );
  }
}

/**
 * Multipart/form-data upload. Content-Type is intentionally omitted so the
 * browser can set the correct multipart boundary.
 */
export async function apiUpload<T>(
  config: ApiClientConfig,
  endpoint: string,
  file: File,
  fieldName: string = "file",
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const formData = new FormData();
  formData.append(fieldName, file);

  const extraHeaders = config.getHeaders?.() ?? {};

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: extraHeaders,
    });

    if (!response.ok) {
      let errorData: ApiErrorBody | null = null;
      try {
        errorData = await response.json();
      } catch {
        // Response body is not JSON.
      }

      throw config.createError(
        pickHttpErrorMessage(errorData) ?? httpErrorFallback(response),
        response.status,
        typeof errorData?.error === "string" ? errorData.error : undefined,
        endpoint,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (config.isOwnError(error)) {
      throw error;
    }

    throw config.createError(
      error instanceof Error ? error.message : "Upload failed",
      undefined,
      undefined,
      endpoint,
    );
  }
}

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Build a URL query string from a params object, skipping `undefined`, `null`,
 * and empty-string values. Returns `""` when no params remain, otherwise a
 * string starting with `?`.
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
