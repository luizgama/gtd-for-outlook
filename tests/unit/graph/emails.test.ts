import { describe, expect, it, vi } from "vitest";
import {
  applyCategories,
  fetchMessageBodyAndHeaders,
  fetchMessagesPage,
  fetchMessagesPageByNextLink,
  moveMessage,
} from "../../../src/graph/emails";
import { GraphClient } from "../../../src/graph/client";

function createMockClient() {
  return new GraphClient({
    tokenProvider: async () => "token",
    fetchImpl: vi.fn() as unknown as typeof fetch,
  });
}

describe("graph/emails", () => {
  it("fetches first messages page and normalizes nextLink", async () => {
    const client = createMockClient();
    const get = vi.spyOn(client, "get").mockResolvedValue({
      value: [{ id: "m1", subject: "one" }],
      "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc",
    });

    const page = await fetchMessagesPage(client, { top: 5 });

    expect(page.messages).toHaveLength(1);
    expect(page.nextLink).toBe("/me/messages?$skiptoken=abc");
    expect(get).toHaveBeenCalledWith(expect.stringContaining("%24top=5"));
  });

  it("fetches next page from nextLink", async () => {
    const client = createMockClient();
    vi.spyOn(client, "get").mockResolvedValue({
      value: [{ id: "m2", subject: "two" }],
    });

    const page = await fetchMessagesPageByNextLink(client, "/me/messages?$skiptoken=abc");
    expect(page.messages[0].id).toBe("m2");
    expect(page.nextLink).toBeNull();
  });

  it("fetches body and headers for message", async () => {
    const client = createMockClient();
    vi.spyOn(client, "get").mockResolvedValue({
      id: "m1",
      body: { contentType: "html", content: "<p>Hello</p>" },
      internetMessageHeaders: [{ name: "List-Unsubscribe", value: "<mailto:x@y.com>" }],
    });

    const detail = await fetchMessageBodyAndHeaders(client, "m1");
    expect(detail.id).toBe("m1");
    expect(detail.body?.contentType).toBe("html");
    expect(detail.internetMessageHeaders?.[0].name).toBe("List-Unsubscribe");
  });

  it("moves message with folder destinationId and applies categories", async () => {
    const client = createMockClient();
    const get = vi.spyOn(client, "get");
    const post = vi
      .spyOn(client, "post")
      .mockResolvedValue({ id: "m2", parentFolderId: "folder-1", subject: "moved" });
    const patch = vi
      .spyOn(client, "patch")
      .mockResolvedValue({ id: "m2", categories: ["GTD: Action"] });

    const moved = await moveMessage(client, "m1", "folder-1");
    const categorized = await applyCategories(client, "m2", ["GTD: Action"]);

    expect(moved.parentFolderId).toBe("folder-1");
    expect(categorized.categories).toContain("GTD: Action");
    expect(get).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith("/me/messages/m1/move", { destinationId: "folder-1" });
    expect(patch).toHaveBeenCalledWith("/me/messages/m2", { categories: ["GTD: Action"] });
  });
});
