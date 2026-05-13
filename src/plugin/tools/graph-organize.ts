import { moveMessage, applyCategories } from "../../graph/emails.js";
import { createFolder, getFolderByName } from "../../graph/folders.js";
import type { GraphClient } from "../../graph/client.js";
import type { ProcessingStateStore } from "../../pipeline/state.js";

export type OrganizeEmailInput = {
  messageId: string;
  category: string;
  outlookCategory: string;
};

export type OrganizeEmailOutput = {
  messageId: string;
  destinationFolderId: string | null;
  movedMessageId: string | null;
  categories: string[];
  folderCreated: boolean;
  skipped: boolean;
};

export async function gtdOrganizeEmail(
  client: GraphClient,
  input: OrganizeEmailInput,
  stateStore?: ProcessingStateStore,
): Promise<OrganizeEmailOutput> {
  const existingState = stateStore?.getProcessed(input.messageId);
  if (existingState && existingState.category === input.category) {
    return {
      messageId: input.messageId,
      destinationFolderId: null,
      movedMessageId: null,
      categories: [input.outlookCategory],
      folderCreated: false,
      skipped: true,
    };
  }

  const existing = await getFolderByName(client, input.category);
  const folder = existing ?? (await createFolder(client, input.category));

  // Move the message first - internally fetches message to get proper ItemID for POST /move
  const moveResult = await moveMessage(client, input.messageId, folder.id);

  // Apply categories - internally fetches message to get proper ItemID for PATCH /categories
  const patched = await applyCategories(client, moveResult.id, [input.outlookCategory]);
  
  stateStore?.markProcessed(input.messageId, input.category);

  return {
    messageId: input.messageId,
    destinationFolderId: folder.id,
    movedMessageId: moveResult.id,
    categories: patched.categories ?? [],
    folderCreated: existing === null,
    skipped: false,
  };
}
