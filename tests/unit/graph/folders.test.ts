import { describe, expect, it, vi } from "vitest";
import {
  createChildFolder,
  createFolder,
  getFolderByName,
  listFolders,
} from "../../../src/graph/folders";
import { GraphClient } from "../../../src/graph/client";

function createMockClient() {
  return new GraphClient({
    tokenProvider: async () => "token",
    fetchImpl: vi.fn() as unknown as typeof fetch,
  });
}

describe("graph/folders", () => {
  it("lists folders across paginated responses", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        value: [{ id: "1", displayName: "@Action" }],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/mailFolders?$skiptoken=abc",
      })
      .mockResolvedValueOnce({
        value: [{ id: "2", displayName: "@WaitingFor" }],
      });
    const client = createMockClient();
    vi.spyOn(client, "get").mockImplementation(get);

    const folders = await listFolders(client);

    expect(folders).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][0]).toContain("/me/mailFolders?$skiptoken=abc");
  });

  it("gets folder by name", async () => {
    const client = createMockClient();
    const get = vi.spyOn(client, "get").mockResolvedValue({
      value: [{ id: "123", displayName: "@Action" }],
    });

    const folder = await getFolderByName(client, "@Action");

    expect(folder?.id).toBe("123");
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining("$filter=displayName eq '@Action'"),
    );
  });

  it("creates top-level and child folders", async () => {
    const client = createMockClient();
    const post = vi
      .spyOn(client, "post")
      .mockResolvedValueOnce({ id: "1", displayName: "@Action" })
      .mockResolvedValueOnce({ id: "2", displayName: "Urgent", parentFolderId: "1" });

    const root = await createFolder(client, "@Action");
    const child = await createChildFolder(client, "1", "Urgent");

    expect(root.displayName).toBe("@Action");
    expect(child.parentFolderId).toBe("1");
    expect(post).toHaveBeenNthCalledWith(1, "/me/mailFolders", { displayName: "@Action" });
    expect(post).toHaveBeenNthCalledWith(2, "/me/mailFolders/1/childFolders", {
      displayName: "Urgent",
    });
  });
});
