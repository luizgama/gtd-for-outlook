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
  logToFile?: boolean;
  logFilePath?: string;
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
  private readonly logToFile: boolean;
  private readonly logFilePath: string | undefined;

  constructor(options: GraphClientOptions) {
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logger = options.logger ?? (() => {});
    this.logToFile = options.logToFile ?? false;
    this.logFilePath = options.logFilePath ?? undefined;
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
      const logMessage = `graph [${method}] ${normalizedPath} attempt=${attempt + 1}, Token: ${token.substring(0, 20)}...`;
      
      if (this.logger) {
        this.logger(logMessage);
      }

      if (this.logToFile) {
        await this.writeToLog(logMessage);
      }

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
        const throttleMessage = `graph [${method}] ${normalizedPath} throttled retryAfter=${retryAfter ?? 1}s`;
        this.logger(throttleMessage);
        await this.writeToLog(throttleMessage);
        await sleep(delayMs);
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        const parsedBody: unknown = text ? (JSON.parse(text) as unknown) : null;
        const errorMessage = `Graph request failed (${response.status} ${response.statusText}) - Method: ${method}, Path: ${normalizedPath}, Body: ${JSON.stringify(parsedBody)} (Retry ${attempt + 1}/${this.maxRetries + 1})`;
        this.logger(errorMessage);
        await this.writeToLog(errorMessage);
        throw new GraphRequestError({
          status: response.status,
          statusText: response.statusText,
          method,
          path: normalizedPath,
          body: parsedBody,
          retryCount: attempt + 1,
        });
      }

      const successMessage = `graph [${method}] ${normalizedPath} success (status=${response.status})`;
      this.logger(successMessage);
      await this.writeToLog(successMessage);

      return (text ? (JSON.parse(text) as T) : ({} as T));
    }

    throw new Error("Graph request retry loop exited unexpectedly.");
  }

  private async writeToLog(message: string): Promise<void> {
    if (!this.logFilePath) {
      return;
    }

    try {
      const fs = await import("node:fs/promises");
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${message}\n`;
      await fs.appendFile(this.logFilePath, logLine);
    } catch (error) {
      // Silently fail if file logging is unavailable
      if (this.logger) {
        this.logger(`graph [ERROR] Failed to write to log file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
