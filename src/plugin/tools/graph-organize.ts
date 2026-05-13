import { fetchMessageBodyAndHeaders, moveMessage, applyCategories } from "../../graph/emails.js";
import { createFolder, getFolderByName } from "../../graph/folders.js";
import type { GraphClient } from "../../graph/client.js";
import type { MailFolder } from "../../graph/folders.js";
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

/**
 * Validate that a folder ID exists by fetching it directly.
 */
async function validateFolderExists(client: GraphClient, folderId: string): Promise<MailFolder> {
  try {
    const response = await client.get(`/me/mailFolders/${encodeURIComponent(folderId)}`);
    return response as MailFolder;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Destination folder validation failed: ${message}`);
  }
}

export async function gtdOrganizeEmail(
  client: GraphClient,
  input: OrganizeEmailInput,
  stateStore?: ProcessingStateStore,
): Promise<OrganizeEmailOutput> {
  // Check idempotent skip first
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

  // Step 1: Try to get existing GTD folder by name
  const existing = await getFolderByName(client, input.category);

  let folder: MailFolder;
  if (existing) {
    // Folder exists - validate it's accessible before proceeding
    folder = await validateFolderExists(client, existing.id);
  } else {
    // Step 2: Create new GTD folder if it doesn't exist
    const created = await createFolder(client, input.category);

    // Step 3: Validate the newly created folder by fetching it
    folder = await validateFolderExists(client, created.id);

    console.log(`Created and validated GTD folder: ${folder.displayName} (ID: ${folder.id})`);
  }

  // Step 4: Now we have a validated folder - proceed with move
  // moveMessage() internally fetches the destination to get its ItemID for the POST /move body

  console.log(`Moving message to validated GTD folder: ${folder.displayName}`);

  const moveResult = await moveMessage(client, input.messageId, folder.id);
  
  console.log(`Move successful!`);

  // Step 5: Apply Outlook categories using the moved message ID
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
