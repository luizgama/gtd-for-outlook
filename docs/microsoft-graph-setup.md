# Microsoft Graph Setup Guide

Manual checklist for configuring Microsoft Graph access for the Spike B validation phase.

Do not commit secrets, client secrets, access tokens, refresh tokens, or local token-cache files. The MVP uses delegated device-code authentication and should not need a client secret.

## Goal

Create an Azure app registration that allows the local CLI to authenticate with device code flow and access Microsoft 365 mail through delegated `Mail.ReadWrite`.

When this guide is complete, prompt the implementation agent with:

```text
Graph setup is complete. Continue with Spike B2 MSAL device code validation.
```

## Before You Start

You need:

- A Microsoft account or Microsoft 365 work/school account with an Outlook mailbox.
- Access to create an app registration in Microsoft Entra ID.
- Permission to consent to delegated `Mail.ReadWrite`, or an admin who can grant consent.

Open:

```text
https://portal.azure.com
```

Then go to:

```text
Microsoft Entra ID -> App registrations
```

## Step 1: Create App Registration

1. Select **New registration**.
2. Set **Name**:

```text
GTD for Outlook Local CLI
```

3. Choose supported account type:

Recommended for a work/school tenant:

```text
Accounts in this organizational directory only
```

Recommended if you need personal Microsoft account support:

```text
Accounts in any organizational directory and personal Microsoft accounts
```

4. Leave **Redirect URI** empty for now.
5. Select **Register**.

Record these values in a private local note, not in git:

```text
Application (client) ID:
Directory (tenant) ID:
Supported account type selected:
```

## Step 2: Enable Public Client Flow

Device code flow is a public-client flow.

1. In the app registration, open **Authentication**.
2. Find **Allow public client flows**.
3. Set it to **Yes**.
4. Select **Save**.

If the UI asks for a platform first:

1. Select **Add a platform**.
2. Choose **Mobile and desktop applications**.
3. Add this redirect URI:

```text
http://localhost
```

4. Save, then set **Allow public client flows** to **Yes**.

Record:

```text
Public client flow enabled: yes/no
Redirect URI added, if any:
```

## Step 3: Add Microsoft Graph Permission

1. Open **API permissions**.
2. Select **Add a permission**.
3. Select **Microsoft Graph**.
4. Select **Delegated permissions**.
5. Search for:

```text
Mail.ReadWrite
```

6. Select `Mail.ReadWrite`.
7. Select **Add permissions**.

Do not add `Mail.Send` for the MVP.

Record:

```text
Delegated permissions:
- Mail.ReadWrite
Mail.Send present: yes/no
```

## Step 4: Grant Consent

Check whether consent is required.

If you are allowed to consent:

1. Select **Grant admin consent** if available and appropriate for your tenant.
2. Confirm the prompt.

If admin consent is not available:

1. Continue anyway.
2. The device-code login may ask the signed-in user to consent.
3. If user consent is blocked by tenant policy, ask a tenant admin to grant consent for `Mail.ReadWrite`.

Record:

```text
Consent status shown in portal:
Admin consent granted: yes/no/not available
User consent expected during device login: yes/no/unknown
```

## Step 5: Decide Tenant ID Value

For a single work/school tenant, use the **Directory (tenant) ID**.

For personal Microsoft account testing, use:

```text
common
```

or, if needed:

```text
consumers
```

Record:

```text
GRAPH_TENANT_ID value to test:
Reason:
```

## Step 6: Configure Local Environment

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env`:

```text
GRAPH_CLIENT_ID=<Application client ID>
GRAPH_TENANT_ID=<Directory tenant ID or common>
```

Do not commit `.env`.

Verify `.env` is ignored:

```bash
git status --short
```

Expected: `.env` should not appear.

## Step 7: Report Back

After completing the manual setup, tell the implementation agent:

```text
Graph setup is complete.
Client ID is in .env: yes
Tenant ID is in .env: yes
Account type selected: <your selection>
Consent status: <status>
Public client flow enabled: yes
Mail.Send added: no
Continue with Spike B2.
```

Do not paste the client ID unless explicitly needed. Never paste tokens.

## Troubleshooting

### I cannot create an app registration

Your tenant may block app registrations. Ask a Microsoft 365/Entra admin to either:

- create the app registration for you, or
- allow users to register applications.

### Device code flow says the app is not configured as a public client

Go back to **Authentication** and enable **Allow public client flows**.

### Consent is blocked

Ask a tenant admin to grant delegated `Mail.ReadWrite` consent.

### Personal account login fails

Check the supported account type. Single-tenant organizational apps generally do not allow personal Microsoft accounts. Use a multi-tenant plus personal account option, then test `GRAPH_TENANT_ID=common` or `consumers`.

### Mailbox access fails after login

Confirm the signed-in account has an Outlook mailbox and that the token includes `Mail.ReadWrite`.
