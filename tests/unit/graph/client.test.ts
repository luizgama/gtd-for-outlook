import { describe, expect, it, vi } from "vitest";
import { GraphClient, GraphRequestError } from "../../../src/graph/client";

describe("graph/client", () => {
  it("retries once on 429 and succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: fetchImpl as never,
      maxRetries: 1,
    });

    const result = await client.get<{ ok: boolean }>("/me/messages?$top=1");
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws GraphRequestError on non-429 failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("bad request", {
        status: 400,
        statusText: "Bad Request",
      }),
    );

    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: fetchImpl as never,
    });

    await expect(client.get("/me/messages")).rejects.toBeInstanceOf(GraphRequestError);
  });
});
