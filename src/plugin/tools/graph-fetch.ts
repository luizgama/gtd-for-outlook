import { fetchMessagesPage, type EmailMessage, type FetchMessagesPageOptions } from "../../graph/emails.js";
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

function buildFilter(input: FetchEmailsInput): string | undefined {
  const filters: string[] = [];
  if (input.unreadOnly ?? true) {
    filters.push("isRead eq false");
  }
  if (input.since) {
    filters.push(`receivedDateTime ge ${input.since}`);
  }
  return filters.length > 0 ? filters.join(" and ") : undefined;
}

export async function gtdFetchEmails(client: GraphClient, input: FetchEmailsInput = {}): Promise<FetchEmailsOutput> {
  const options: FetchMessagesPageOptions = {
    top: input.top ?? 10,
    filter: buildFilter(input),
  };
  const page = await fetchMessagesPage(client, options);
  return { emails: page.messages, nextLink: page.nextLink };
}
