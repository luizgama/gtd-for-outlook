# Spike B: Microsoft Graph API

Working log for Microsoft Graph validation.

## Setup Instructions

Manual setup guide: `docs/microsoft-graph-setup.md`

## Environment

Fill this in during Spike B without committing secrets:

```text
Date:
Node.js:
Account type:
Tenant value style: tenant-id/common/consumers
Delegated permissions:
Consent status:
Public client flow enabled:
```

## B1. Azure App Registration

Status: pending manual setup.

Record after setup:

```text
Supported account type:
Delegated Mail.ReadWrite added:
Mail.Send absent:
Admin/user consent status:
Public client flow enabled:
```

## B2. MSAL Device Code Flow

Status: pending.

Acceptance:

- Device code URL and code are displayed.
- Browser authentication completes.
- Access token is returned.
- Token scopes include `Mail.ReadWrite`.

## B3. Token Cache Persistence

Status: pending.

Acceptance:

- MSAL cache persists locally.
- Token cache file permissions are owner-only.
- Restarted process can acquire token silently.

## B4. Token Refresh

Status: pending.

Acceptance:

- Expired/near-expired access token refreshes without user interaction.

## B5. Fetch Emails

Status: pending.

Acceptance:

- Fetch messages with selected fields.
- Record body preview behavior.

## B6. Fetch Full Email Body

Status: pending.

Acceptance:

- Fetch full body for representative plain text and HTML messages.

## B7. Email Headers

Status: pending.

Acceptance:

- Access `internetMessageHeaders`.
- Confirm whether `List-Unsubscribe` is available on test messages.

## B8. Pagination

Status: pending.

Acceptance:

- Follow `@odata.nextLink` across multiple pages.

## B9. Create Mail Folder

Status: pending.

Acceptance:

- Test folder name starting with `@`, such as `@Action`.
- Record fallback naming if Microsoft rejects it.

## B10. Create Nested Folders

Status: pending.

Acceptance:

- Create child folder under a GTD folder or record limitation.

## B11. List Mail Folders

Status: pending.

Acceptance:

- List created folders and capture relevant IDs.

## B12. Move Email

Status: pending.

Acceptance:

- Move a test email to a GTD folder.
- Verify it leaves Inbox and appears in destination.

## B13. Apply Outlook Category

Status: pending.

Acceptance:

- Apply `GTD: Action` or equivalent category.
- Record whether category pre-creation is required.

## B14. Rate Limiting Behavior

Status: pending.

Acceptance:

- Observe or document throttling behavior and `Retry-After`.

## B15. Filter by Date

Status: pending.

Acceptance:

- Validate date filter and newest-first ordering.
