import { describe, expect, it } from "vitest";
import { GraphClient } from "../../../src/graph/client";
import { gtdFetchEmails } from "../../../src/plugin/tools/graph-fetch";

describe("plugin/graph-fetch", () => {
  it("fetches unread messages with default filter", async () => {
    const requests: string[] = [];
    const client = new GraphClient({
      tokenProvider: async () => "token",
      fetchImpl: (async (url: URL | RequestInfo) => {
        const path = String(url);
        requests.push(path);
        return new Response(JSON.stringify({ value: [{ id: "m1", subject: "A" }] }), { status: 200 });
      }) as typeof fetch,
    });

    const result = await gtdFetchEmails(client, { top: 1 });
    expect(result.emails).toHaveLength(1);
    expect(requests[0]).toContain("/me/mailFolders/inbox/messages?");
    expect(requests[0]).toContain("%24filter=isRead+eq+false");
  });
});
