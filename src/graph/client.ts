const DEFAULT_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_MAX_RETRIES = 2;

type FetchLike = typeof fetch;

export type TokenProvider = () => Promise<string>;

export type GraphClientOptions = {
  tokenProvider: TokenProvider;
  fetchImpl?: FetchLike;
  baseUrl?: string;
  maxRetries?: number;
  logger?: (message: string) => void;
};

export class GraphRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly retryCount: number;

  constructor({
    status,
    statusText,
    method,
    path,
    body,
    retryCount,
  }: {
    status: number;
    statusText: string;
    method: string;
    path: string;
    body: unknown;
    retryCount: number;
  }) {
    super(
      `Graph request failed (${status} ${statusText}) - Method: ${method}, Path: ${path}, Body: ${JSON.stringify(body)} (Retry ${retryCount}/${DEFAULT_MAX_RETRIES + 1})`,
    );
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.path = path;
    this.body = body;
    this.retryCount = retryCount;
  }
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GraphClient {
  private readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly logger: (message: string) => void;

  constructor(options: GraphClientOptions) {
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logger = options.logger ?? (() => {});
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, "GET");
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, "POST", body);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, "PATCH", body);
  }

  async request<T>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<T> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const token = await this.tokenProvider();
      this.logger(
        `graph [${method}] ${normalizedPath} attempt=${attempt + 1}`,
      );

      const response = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = parseRetryAfterSeconds(response.headers.get("Retry-After"));
        const delayMs = (retryAfter ?? 1) * 1000;
        this.logger(`graph [${method}] ${normalizedPath} throttled retryAfter=${retryAfter ?? 1}s`);
        await sleep(delayMs);
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        const parsedBody: unknown = text ? (JSON.parse(text) as unknown) : null;
        throw new GraphRequestError({
          status: response.status,
          statusText: response.statusText,
          method,
          path: normalizedPath,
          body: parsedBody,
          retryCount: attempt + 1,
        });
      }

      return (text ? (JSON.parse(text) as T) : ({} as T));
    }

    throw new Error("Graph request retry loop exited unexpectedly.");
  }
}
