# Spike B: Microsoft Graph API

Working log for Microsoft Graph validation.

## Setup Instructions

Manual setup guide: `docs/microsoft-graph-setup.md`

## Environment

Fill this in during Spike B without committing secrets:

```text
Date: 2026-05-09
Node.js: v22.22.2
Account type: work/school Microsoft 365 account
Tenant value style: tenant id
Delegated permissions: Mail.ReadWrite returned in token; User.Read also returned by Microsoft defaults
Consent status: browser device-code login completed successfully
Public client flow enabled: yes, inferred from successful device-code flow
```

## B1. Azure App Registration

Status: passed.

Record after setup:

```text
Supported account type: work/school Microsoft 365 account
Delegated Mail.ReadWrite added: yes
Mail.Send absent: yes, per manual setup confirmation and token scopes
Admin/user consent status: consent/login completed during device-code flow
Public client flow enabled: yes
```

## B2. MSAL Device Code Flow

Status: passed.

Acceptance:

- Device code URL and code are displayed.
- Browser authentication completes.
- Access token is returned.
- Token scopes include `Mail.ReadWrite`.

Validation command:

```bash
node spikes/microsoft-graph/device-code.mjs
```

Evidence:

```text
Device code URL: https://login.microsoft.com/device
Account username: work/school mailbox account
Tenant id: configured tenant id
Scopes returned:
- profile
- openid
- email
- https://graph.microsoft.com/Mail.ReadWrite
- https://graph.microsoft.com/User.Read
Access token returned: true
ID token returned: true
```

Notes:

- The script redacts the client id and does not print access tokens.
- `User.Read` is returned by Microsoft defaults; it was not added as an MVP mail permission.
- The spike uses `@azure/msal-node@5.1.5` instead of the latest `5.2.0` because `5.2.0` was published within the package cooldown window.

## B3. Token Cache Persistence

Status: passed.

Acceptance:

- MSAL cache persists locally.
- Token cache file permissions are owner-only.
- Restarted process can acquire token silently.

Validation command:

```bash
node spikes/microsoft-graph/auth-cache.mjs
```

Evidence:

```text
First run:
- authMode: device-code
- cache file written
- cacheFileMode: 600
- Mail.ReadWrite scope returned

Second run, fresh process:
- authMode: silent
- cacheFileMode: 600
- Mail.ReadWrite scope returned
- no browser/device-code prompt displayed
```

Cache path:

```text
~/.gtd-outlook/token-cache.json
```

Notes:

- The spike script does not print access tokens.
- The token cache file is local user data and must not be committed.

## B4. Token Refresh

Status: passed.

Acceptance:

- Expired/near-expired access token refreshes without user interaction.

Validation command:

```bash
node spikes/microsoft-graph/force-refresh.mjs
```

Evidence:

```text
Normal silent token:
- access token returned
- Mail.ReadWrite scope returned

Forced-refresh silent token:
- access token returned
- Mail.ReadWrite scope returned
- no browser/device-code prompt displayed
- token fingerprint changed
- expiry moved later
- cacheFileMode: 600
```

Observed non-secret output:

```text
cachedAccessTokenReturned: true
refreshedAccessTokenReturned: true
cachedTokenFingerprint: fbba2385a1e5
refreshedTokenFingerprint: ddff13a2d70c
cachedExpiresOn: 2026-05-09T06:09:14.000Z
refreshedExpiresOn: 2026-05-09T06:32:50.000Z
```

Notes:

- The spike uses `acquireTokenSilent({ forceRefresh: true })` to force MSAL to redeem the refresh token without waiting for natural expiry.
- The script prints only short SHA-256 token fingerprints, not token values.

## B5. Fetch Emails

Status: passed.

Acceptance:

- Fetch messages with selected fields.
- Record body preview behavior.

Validation command:

```bash
node spikes/microsoft-graph/fetch-emails.mjs
```

Evidence:

```text
messageCount: 10
maxBodyPreviewLength: 255
bodyPreviewLooksPlainText: true
htmlLikeBodyPreviewCount: 0
hasNextLink: true
```

Notes:

- Query used: `GET /me/messages?$top=10&$select=id,subject,sender,bodyPreview,receivedDateTime,isRead,hasAttachments&$orderby=receivedDateTime desc`
- `bodyPreview` appears truncated to 255 chars in this mailbox sample and did not include HTML tags in the observed results.
- `hasNextLink=true` confirms additional pages are available, which feeds directly into B8 pagination validation.

## B6. Fetch Full Email Body

Status: passed.

Acceptance:

- Fetch full body for representative plain text and HTML messages.

Validation command:

```bash
node spikes/microsoft-graph/fetch-email-body.mjs
```

Evidence:

```text
sampledMessages: 10
contentTypeCounts: { html: 8, text: 2 }
htmlCount: 8
textCount: 2
inlineCidMessageCount: 1
attachmentMessageCount: 0
maxBodyLength: 30367
```

Notes:

- Query sequence used:
  - `GET /me/messages?$top=10&$select=id,subject,sender,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc`
  - `GET /me/messages/{id}?$select=id,subject,sender,hasAttachments,body`
- Graph returns `body.contentType` as either `html` or `text` in real mailbox data.
- HTML bodies can be much larger than preview text and may include inline content references (`cid:`), confirming sanitizer requirements for HTML normalization.

## B7. Email Headers

Status: passed.

Acceptance:

- Access `internetMessageHeaders`.
- Confirm whether `List-Unsubscribe` is available on test messages.

Validation command:

```bash
node spikes/microsoft-graph/fetch-email-headers.mjs
```

Evidence:

```text
sampledMessages: 10
listUnsubscribeCount: 0
averageHeaderCount: 51
```

Notes:

- Query sequence used:
  - `GET /me/messages?$top=10&$select=id,subject,sender,receivedDateTime&$orderby=receivedDateTime desc`
  - `GET /me/messages/{id}?$select=id,subject,sender,internetMessageHeaders`
- `internetMessageHeaders` is available and returned for sampled messages.
- No sampled message contained the `List-Unsubscribe` header. This does not block implementation; it indicates this mailbox sample did not include newsletter-style messages in the checked window.

## B8. Pagination

Status: passed.

Acceptance:

- Follow `@odata.nextLink` across multiple pages.

Validation command:

```bash
B8_MAX_PAGES=25 node spikes/microsoft-graph/messages-pagination.mjs
```

Evidence:

```text
top: 5
maxPages: 25
pageCount: 25
totalMessages: 125
uniqueCount: 125
duplicateCount: 0
multiPageTraversal: true
traversedAllPages: false (bounded run)
```

Notes:

- Query used: `GET /me/messages?$top=5&$select=id,subject,receivedDateTime,parentFolderId&$orderby=receivedDateTime desc`
- The script follows `@odata.nextLink` page by page and verifies duplicate-free aggregation of message IDs.
- This mailbox is large enough that a bounded run is used for spike validation; bounded traversal still confirms stable pagination behavior over multiple pages without missing/duplicating within the traversed window.

## B9. Create Mail Folder

Status: passed.

Acceptance:

- Test folder name starting with `@`, such as `@Action`.
- Record fallback naming if Microsoft rejects it.

Validation command:

```bash
node spikes/microsoft-graph/create-mail-folder.mjs
```

Evidence:

```text
primaryFolderName: @Action
primaryResult.status: created
createdFolderId: AAMkAGUxYjRlNmRiLTAxMmYtNDY4MC1iMjBmLTMzZDkyMzhlMDdjNwAuAAAAAAAj9_TpPGlqTpVDPDki6MZeAQA3gzQ82T4ITIwSTGfX5yc3AASs_sqgAAA=
fallbackResult: null
```

Notes:

- Query sequence used:
  - `GET /me/mailFolders?$top=50&$filter=displayName eq '@Action'&$select=id,displayName,parentFolderId,totalItemCount,childFolderCount`
  - `POST /me/mailFolders` with `{ "displayName": "@Action" }` when not present
- Microsoft Graph accepted folder names starting with `@` in this tenant/mailbox, so GTD folder naming can keep the `@Action` convention for MVP.

## B10. Create Nested Folders

Status: passed.

Acceptance:

- Create child folder under a GTD folder or record limitation.

Validation command:

```bash
node spikes/microsoft-graph/create-nested-folder.mjs
```

Evidence:

```text
parentFolderName: @Action
parentStatus: already_exists
childFolderName: Urgent
childStatus: created
nestedUnderExpectedParent: true
childParentFolderId == parentFolderId: true
```

Notes:

- Query sequence used:
  - `GET /me/mailFolders?$top=50&$filter=displayName eq '@Action'&$select=id,displayName,parentFolderId,childFolderCount`
  - `GET /me/mailFolders/{parentId}/childFolders?$top=50&$filter=displayName eq 'Urgent'&$select=id,displayName,parentFolderId,childFolderCount`
  - `POST /me/mailFolders/{parentId}/childFolders` with `{ "displayName": "Urgent" }` when not present
- Nested folder creation under a GTD parent is supported in this tenant/mailbox.

## B11. List Mail Folders

Status: passed.

Acceptance:

- List created folders and capture relevant IDs.

Validation command:

```bash
node spikes/microsoft-graph/list-mail-folders.mjs
```

Evidence:

```text
topLevelFolderCount: 81
actionFolderFound: true
actionFolderId: AAMkAGUxYjRlNmRiLTAxMmYtNDY4MC1iMjBmLTMzZDkyMzhlMDdjNwAuAAAAAAAj9_TpPGlqTpVDPDki6MZeAQA3gzQ82T4ITIwSTGfX5yc3AASs_sqgAAA=
urgentChildFound: true
urgentChildId: AAMkAGUxYjRlNmRiLTAxMmYtNDY4MC1iMjBmLTMzZDkyMzhlMDdjNwAuAAAAAAAj9_TpPGlqTpVDPDki6MZeAQA3gzQ82T4ITIwSTGfX5yc3AASs_sqhAAA=
urgentChildParentFolderId == actionFolderId: true
```

Notes:

- Query sequence used:
  - `GET /me/mailFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount` (paged via `@odata.nextLink`)
  - `GET /me/mailFolders/{actionFolderId}/childFolders?$top=100&$select=id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount`
- Top-level folder listing and child-folder listing both returned expected GTD folders and IDs required for downstream move validation.

## B12. Move Email

Status: passed.

Acceptance:

- Move a test email to a GTD folder.
- Verify it leaves Inbox and appears in destination.

Validation command:

```bash
node spikes/microsoft-graph/move-email.mjs
```

Evidence:

```text
sourceFolderName: Caixa de Entrada
destinationFolderName: @Action
selectedMessageSubject: Read the weekly digest of license requests for 123 VIAGENS E TURISMO LTDA.
moveReturnedParentFolderId == destinationFolderId: true
verifiedParentFolderId == destinationFolderId: true
movedToDestination: true
```

Notes:

- Query sequence used:
  - `GET /me/mailFolders?$top=100&$filter=displayName eq 'Caixa de Entrada'&$select=id,displayName`
  - `GET /me/mailFolders?$top=100&$filter=displayName eq '@Action'&$select=id,displayName`
  - `GET /me/mailFolders/{inboxId}/messages?$top=10&$select=id,subject,parentFolderId,receivedDateTime&$orderby=receivedDateTime desc`
  - `POST /me/messages/{id}/move` with `{ "destinationId": "@Action-folder-id" }`
  - `GET /me/messages/{movedId}?$select=id,subject,parentFolderId`
- Graph returns a new message id for the moved copy; verification should use the returned id and destination `parentFolderId`.

## B13. Apply Outlook Category

Status: passed.

Acceptance:

- Apply `GTD: Action` or equivalent category.
- Record whether category pre-creation is required.

Validation command:

```bash
node spikes/microsoft-graph/apply-category.mjs
```

Evidence:

```text
targetFolderName: @Action
targetCategory: GTD: Action
patchStatus: applied_without_master_create
preCreationRequired: false
createdMasterCategory: false
categoryApplied: true
```

Notes:

- Query sequence used:
  - `GET /me/mailFolders?$top=100&$filter=displayName eq '@Action'&$select=id,displayName`
  - `GET /me/mailFolders/{actionFolderId}/messages?$top=10&$select=id,subject,categories,receivedDateTime&$orderby=receivedDateTime desc`
  - `PATCH /me/messages/{id}` with `{ "categories": ["GTD: Action"] }` (merged with existing categories)
  - `GET /me/messages/{id}?$select=id,subject,categories,parentFolderId` for verification
- In this mailbox/tenant, category assignment succeeded without first creating `GTD: Action` in `/me/outlook/masterCategories`.

## B14. Rate Limiting Behavior

Status: passed.

Acceptance:

- Observe or document throttling behavior and `Retry-After`.

Validation command:

```bash
node spikes/microsoft-graph/rate-limit-probe.mjs
```

Evidence:

```text
requestCount: 30
delayMs: 0
statusCounts: { 200: 30 }
throttled: false
firstThrottleAt: null
retryAfterValues: []
```

Notes:

- Probe query used: repeated `GET /me/messages?$top=1&$select=id,receivedDateTime`.
- No `429 Too Many Requests` was observed in this sample run, so no `Retry-After` header was returned.
- Result documents current behavior for this tenant/mailbox at this request shape and volume; production logic should still treat `429` as expected and honor `Retry-After` when it appears.

## B15. Filter by Date

Status: passed.

Acceptance:

- Validate date filter and newest-first ordering.

Validation command:

```bash
node spikes/microsoft-graph/filter-by-date.mjs
```

Evidence:

```text
since: 2026-04-01T00:00:00Z
top: 20
returnedCount: 20
allAfterSince: true
sortedDescending: true
firstOutOfRange: null
firstOrderViolation: null
hasNextLink: true
```

Notes:

- Query used:
  - `GET /me/messages?$filter=receivedDateTime ge 2026-04-01T00:00:00Z&$orderby=receivedDateTime desc&$top=20&$select=id,subject,receivedDateTime,parentFolderId`
- All sampled results were within the date window and sorted newest-first, which validates the lookback + ordering behavior needed for batch processing.
