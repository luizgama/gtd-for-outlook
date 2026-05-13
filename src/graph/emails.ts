import type { GraphClient } from "./client.js";

export type EmailSender = {
  emailAddress?: {
    address?: string;
    name?: string;
  };
};

export type EmailMessage = {
  id: string;
  subject?: string;
  parentFolderId?: string;
  receivedDateTime?: string;
  bodyPreview?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  sender?: EmailSender;
  categories?: string[];
};

export type EmailBody = {
  contentType: "text" | "html";
  content: string;
};

export type InternetMessageHeader = {
  name: string;
  value: string;
};

export type EmailDetail = EmailMessage & {
  body?: EmailBody;
  internetMessageHeaders?: InternetMessageHeader[];
};

type GraphListResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

export type FetchMessagesPageOptions = {
  top?: number;
  filter?: string;
  orderBy?: string;
  select?: string[];
};

export type MessagesPage = {
  messages: EmailMessage[];
  nextLink: string | null;
};

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

export async function fetchMessagesPage(
  client: GraphClient,
  options: FetchMessagesPageOptions = {},
): Promise<MessagesPage> {
  const top = options.top ?? 10;
  const select =
    options.select?.join(",") ??
    "id,subject,sender,bodyPreview,receivedDateTime,isRead,hasAttachments,parentFolderId,categories";
  const orderBy = options.orderBy ?? "receivedDateTime desc";

  const query = new URLSearchParams({
    $top: String(top),
    $select: select,
    $orderby: orderBy,
  });
  if (options.filter) {
    query.set("$filter", options.filter);
  }

  const payload = await client.get<GraphListResponse<EmailMessage>>(`/me/messages?${query.toString()}`);
  return {
    messages: payload.value ?? [],
    nextLink: normalizeNextLink(payload["@odata.nextLink"]),
  };
}

export async function fetchMessagesPageByNextLink(
  client: GraphClient,
  nextLink: string,
): Promise<MessagesPage> {
  const payload = await client.get<GraphListResponse<EmailMessage>>(nextLink);
  return {
    messages: payload.value ?? [],
    nextLink: normalizeNextLink(payload["@odata.nextLink"]),
  };
}

export async function fetchMessageBodyAndHeaders(
  client: GraphClient,
  messageId: string,
): Promise<EmailDetail> {
  // GET requests accept unique ID format (AAMk...)
  return client.get<EmailDetail>(
    `/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,sender,parentFolderId,body,internetMessageHeaders,categories`,
  );
}

export async function moveMessage(
  client: GraphClient,
  messageId: string,
  destinationId: string,
): Promise<EmailMessage> {
  // POST /move requires ItemID format, not unique ID. Fetch first to get proper ID.
  const message = await fetchMessageBodyAndHeaders(client, messageId);
  return client.post<EmailMessage>(`/me/messages/${encodeURIComponent(message.id)}/move`, {
    destinationId,
  });
}

export async function applyCategories(
  client: GraphClient,
  messageId: string,
  categories: string[],
): Promise<EmailMessage> {
  // PATCH /categories requires ItemID format, not unique ID. Fetch first to get proper ID.
  const message = await fetchMessageBodyAndHeaders(client, messageId);
  return client.patch<EmailMessage>(`/me/messages/${encodeURIComponent(message.id)}`, {
    categories,
  });
}
