import { type EmailMessage } from "../../graph/emails.js";
import type { GraphClient } from "../../graph/client.js";

export type FetchEmailsInput = {
  top?: number;
  unreadOnly?: boolean;
  since?: string;
};

export type FetchEmailsOutput = {
  emails: EmailMessage[];
  nextLink: string | null;
};

type GraphListResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

function buildFilter(input: FetchEmailsInput): string {
  const filters: string[] = [];
  if (input.unreadOnly ?? true) {
    filters.push("isRead eq false");
  }
  if (input.since) {
    filters.push(`receivedDateTime ge ${input.since}`);
  }
  return filters.join(" and ");
}

function normalizeNextLink(nextLink: string | undefined): string | null {
  if (!nextLink) {
    return null;
  }
  const idx = nextLink.indexOf("/v1.0/");
  if (idx >= 0) {
    return nextLink.slice(idx + "/v1.0".length);
  }
  return nextLink;
}

export async function gtdFetchEmails(client: GraphClient, input: FetchEmailsInput = {}): Promise<FetchEmailsOutput> {
  const top = input.top ?? 10;
  const filter = buildFilter(input);
  const query = new URLSearchParams({
    $top: String(top),
    $select: "id,subject,sender,bodyPreview,receivedDateTime,isRead,hasAttachments,parentFolderId,categories",
    $orderby: "receivedDateTime desc",
  });
  if (filter) {
    query.set("$filter", filter);
  }
  const payload = await client.get<GraphListResponse<EmailMessage>>(
    `/me/mailFolders/inbox/messages?${query.toString()}`,
  );
  return { emails: payload.value ?? [], nextLink: normalizeNextLink(payload["@odata.nextLink"]) };
}
