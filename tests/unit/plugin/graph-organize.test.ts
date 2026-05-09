import { describe, expect, it } from "vitest";
import { GraphClient } from "../../../src/graph/client";
import { gtdOrganizeEmail } from "../../../src/plugin/tools/graph-organize";

describe("plugin/graph-organize", () => {
  it("creates missing folder, then moves and categorizes message", async () => {
    const requests: Array<{ method: string; url: string; body?: string }> = [];
    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = String(url);
        const body = typeof init?.body === "string" ? init.body : undefined;
        requests.push({ method, url: path, body });

        if (method === "GET" && path.includes("$filter=displayName+eq+%27%40Action%27")) {
          return new Response(JSON.stringify({ value: [] }), { status: 200 });
        }
        if (method === "POST" && path.endsWith("/me/mailFolders")) {
          return new Response(JSON.stringify({ id: "f-action", displayName: "@Action" }), { status: 200 });
        }
        if (method === "POST" && path.endsWith("/me/messages/m1/move")) {
          return new Response(JSON.stringify({ id: "m2", parentFolderId: "f-action" }), { status: 200 });
        }
        if (method === "PATCH" && path.endsWith("/me/messages/m2")) {
          return new Response(JSON.stringify({ id: "m2", categories: ["GTD: Action"] }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch,
    });

    const result = await gtdOrganizeEmail(client, {
      messageId: "m1",
      category: "@Action",
      outlookCategory: "GTD: Action",
    });

    expect(result.folderCreated).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.destinationFolderId).toBe("f-action");
    expect(result.categories).toContain("GTD: Action");
    expect(requests.some((r) => r.url.endsWith("/move"))).toBe(true);
  });

  it("skips move when message is already organized with same category", async () => {
    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: (async () => {
        throw new Error("Graph should not be called for idempotent skip.");
      }) as typeof fetch,
    });

    const stateStore = {
      getProcessed: () => ({
        messageId: "m1",
        category: "@Action",
        organizedAt: "2026-05-09T00:00:00.000Z",
      }),
      markProcessed: () => ({
        messageId: "m1",
        category: "@Action",
        organizedAt: "2026-05-09T00:00:00.000Z",
      }),
    };

    const result = await gtdOrganizeEmail(
      client,
      { messageId: "m1", category: "@Action", outlookCategory: "GTD: Action" },
      stateStore,
    );

    expect(result.skipped).toBe(true);
    expect(result.movedMessageId).toBeNull();
  });
});
