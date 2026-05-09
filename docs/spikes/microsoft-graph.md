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
