import { describe, expect, it } from "vitest";
import { GraphClient } from "../../src/graph/client";
import { createFolder, getFolderByName } from "../../src/graph/folders";
import { applyCategories, moveMessage } from "../../src/graph/emails";

describe("integration/organize-flow", () => {
  it("runs classify -> ensure folder -> move -> categorize with mocked Graph", async () => {
    const requests: Array<{ method: string; url: string; body?: string }> = [];
    const mockFetch = async (url: URL | RequestInfo, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : undefined;
      const path = String(url);
      requests.push({ method, url: path, body });

      if (path.includes("displayName%20eq%20%27%40Action%27")) {
        return new Response(JSON.stringify({ value: [] }), { status: 200 });
      }
      if (path.endsWith("/me/mailFolders") && method === "POST") {
        return new Response(JSON.stringify({ id: "folder-action", displayName: "@Action" }), {
          status: 200,
        });
      }
      if (path.includes("/move") && method === "POST") {
        return new Response(JSON.stringify({ id: "m2", parentFolderId: "folder-action" }), {
          status: 200,
        });
      }
      if (path.includes("/me/messages/m2") && method === "PATCH") {
        return new Response(JSON.stringify({ id: "m2", categories: ["GTD: Action"] }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    };

    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const classification = {
      messageId: "m1",
      category: "@Action",
      outlookCategory: "GTD: Action",
    };

    const existing = await getFolderByName(client, classification.category);
    const folder = existing ?? (await createFolder(client, classification.category));

    const moved = await moveMessage(client, classification.messageId, folder.id);
    expect(moved.parentFolderId).toBe("folder-action");

    const categorized = await applyCategories(client, moved.id, [classification.outlookCategory]);
    expect(categorized.categories).toContain("GTD: Action");
    expect(requests.some((r) => r.url.includes("/move"))).toBe(true);
    expect(requests.some((r) => r.method === "PATCH")).toBe(true);
  });
});
