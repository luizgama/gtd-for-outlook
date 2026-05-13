# NEXT PHASE PLAN: Fix `gtd_organize_email` Graph Move Error

## Goal
Fix `ErrorCannotUseFolderIdForItemId - Expected an item Id but received a folder Id.` by aligning `gtd_organize_email` with Microsoft Graph `message: move` semantics.

## Scope
- `src/graph/emails.ts`
- Unit tests in `tests/unit/graph/emails.test.ts`
- Optional targeted review of organize flow tests

## Step 1: Correct `moveMessage` request construction
- Remove incorrect destination-folder lookup through the message endpoint.
- Ensure `moveMessage` sends:
  - Path: `POST /me/messages/{messageId}/move`
  - Body: `{ destinationId: destinationFolderId }`
- URL-encode `messageId` for safety and consistency.

### Code Review Step 1
- Verify no call path still treats a folder ID as a message ID before move.
- Verify comments/docs in `moveMessage` match actual Graph behavior.

## Step 2: Simplify category patch behavior to avoid unnecessary ID conversion assumptions
- Keep `applyCategories` behavior compatible with IDs returned by move.
- Remove comments/logic that claim ItemID-only requirements unless required by docs.
- Keep behavior deterministic and minimal.

### Code Review Step 2
- Confirm category patch still targets the moved message ID and existing tests remain meaningful.
- Check for regressions in other callers.

## Step 3: Expand unit coverage for regression prevention
- Update/add tests to assert:
  - `moveMessage` does not perform `GET /me/messages/{destinationFolderId}`.
  - `POST` call uses expected path/body.
- Keep tests focused on the bug signature.

### Code Review Step 3
- Ensure tests fail on old buggy behavior and pass on fixed behavior.
- Ensure test names clearly describe the regression they protect.

## Step 4: Run targeted test suite and clean up
- Run relevant unit tests (`graph/emails`, plugin organize tests if needed).
- Fix any breakages.

### Code Review Step 4
- Review final diff for clarity and remove stale comments.
- Verify no unrelated changes are included.

## Deliverables
- Fixed Graph move implementation.
- Updated tests that prevent reintroduction of folder/message ID confusion.
- Short implementation summary and verification results.
