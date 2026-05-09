import type { GraphClient } from "./client.js";

export type MailFolder = {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount?: number;
  totalItemCount?: number;
  unreadItemCount?: number;
};

type GraphListResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

function encodeFilterValue(value: string): string {
  return value.replace(/'/g, "''");
}

export async function listFolders(client: GraphClient): Promise<MailFolder[]> {
  const all: MailFolder[] = [];
  let path =
    "/me/mailFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount";

  while (path) {
    const page = await client.get<GraphListResponse<MailFolder>>(path);
    all.push(...(page.value ?? []));
    const next = page["@odata.nextLink"];
    if (typeof next === "string") {
      const idx = next.indexOf("/v1.0/");
      path = idx >= 0 ? next.slice(idx + "/v1.0".length) : "";
    } else {
      path = "";
    }
  }

  return all;
}

export async function getFolderByName(
  client: GraphClient,
  displayName: string,
): Promise<MailFolder | null> {
  const escaped = encodeFilterValue(displayName);
  const payload = await client.get<GraphListResponse<MailFolder>>(
    `/me/mailFolders?$top=100&$filter=displayName eq '${escaped}'&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount`,
  );
  return payload.value?.[0] ?? null;
}

export async function createFolder(client: GraphClient, displayName: string): Promise<MailFolder> {
  return client.post<MailFolder>("/me/mailFolders", { displayName });
}

export async function createChildFolder(
  client: GraphClient,
  parentFolderId: string,
  displayName: string,
): Promise<MailFolder> {
  return client.post<MailFolder>(
    `/me/mailFolders/${encodeURIComponent(parentFolderId)}/childFolders`,
    { displayName },
  );
}
