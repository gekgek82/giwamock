import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiFetch,
  apiUpload,
  buildQuery,
  type ApiClientConfig,
} from "@/lib/apiClient";

class TestApiError extends Error {
  public statusCode?: number;
  public errorCode?: string;
  public endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    errorCode?: string,
    endpoint?: string,
  ) {
    super(message);
    this.name = "TestApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.endpoint = endpoint;
  }
}

function makeConfig(overrides?: Partial<ApiClientConfig>): ApiClientConfig {
  return {
    baseUrl: "https://api.test",
    createError: (message, statusCode, errorCode, endpoint) =>
      new TestApiError(message, statusCode, errorCode, endpoint),
    isOwnError: (error) => error instanceof TestApiError,
    networkErrorLabel: "test API",
    ...overrides,
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("buildQuery", () => {
  it("returns empty string when no params are provided", () => {
    expect(buildQuery({})).toBe("");
  });

  it("skips undefined, null, and empty-string values", () => {
    expect(
      buildQuery({ a: undefined, b: null, c: "", d: "ok" }),
    ).toBe("?d=ok");
  });

  it("coerces numbers and booleans to strings", () => {
    expect(buildQuery({ limit: 10, active: true })).toBe("?limit=10&active=true");
  });

  it("preserves the zero value", () => {
    expect(buildQuery({ offset: 0 })).toBe("?offset=0");
  });
});

describe("apiFetch", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on 2xx", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>(
      makeConfig(),
      "/resource",
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/resource",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("injects dynamic headers from getHeaders", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch(
      makeConfig({
        getHeaders: () => ({ Authorization: "Bearer token-1" }),
      }),
      "/resource",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer token-1",
    });
  });

  it("throws a typed error when the response body contains a message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: "Not found", error: "NOT_FOUND" },
        { status: 404, statusText: "Not Found" },
      ),
    );

    await expect(
      apiFetch(makeConfig(), "/missing"),
    ).rejects.toMatchObject({
      name: "TestApiError",
      message: "Not found",
      statusCode: 404,
      errorCode: "NOT_FOUND",
      endpoint: "/missing",
    });
  });

  it("falls back to statusText when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("oops", { status: 500, statusText: "Server Error" }),
    );

    await expect(apiFetch(makeConfig(), "/boom")).rejects.toMatchObject({
      message: "HTTP 500: Server Error",
      statusCode: 500,
    });
  });

  it("wraps network failures with the fetch-failure prefix", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await expect(apiFetch(makeConfig(), "/any")).rejects.toMatchObject({
      name: "TestApiError",
      message: "Failed to fetch from test API: network down",
      endpoint: "/any",
    });
  });

  it("re-throws errors that createError already produced", async () => {
    const original = new TestApiError("original", 401, "AUTH", "/auth");
    fetchMock.mockImplementationOnce(() => {
      throw original;
    });

    await expect(apiFetch(makeConfig(), "/auth")).rejects.toBe(original);
  });
});

describe("apiUpload", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("posts multipart/form-data without forcing Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const result = await apiUpload<{ id: number }>(
      makeConfig({ getHeaders: () => ({ Authorization: "Bearer t" }) }),
      "/upload",
      file,
    );

    expect(result).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    // Content-Type must NOT be set so the browser sets the multipart boundary.
    expect(init.headers).toEqual({ Authorization: "Bearer t" });
  });

  it("reports server-side upload errors with parsed message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: "File too large" },
        { status: 413, statusText: "Payload Too Large" },
      ),
    );

    const file = new File(["x"], "x.bin");
    await expect(
      apiUpload(makeConfig(), "/upload", file),
    ).rejects.toMatchObject({
      message: "File too large",
      statusCode: 413,
      endpoint: "/upload",
    });
  });
});
