# Next Phase Plan

Temporary handoff file for the next implementation context.

## Current State

- Branch: `main`
- Spike A has been merged through A7:
  - A1-A4: OpenClaw install, plugin loading, agent-to-tool invocation, TypeBox validation.
  - A5-A6: `llm-task` JSON/schema output and tool isolation validated through direct `tools.invoke`.
  - A7: parent-to-sub-agent orchestration validated with `sessions_spawn` and `sessions_yield`.
- Residual Spike A follow-ups:
  - A8: cron persists and fires, but cron runtime `--tools <plugin-tool>` did not resolve plugin tools.
  - A9: concurrent session isolation was blocked by model quota/cooldown and needs retry.
- Production implementation remains blocked until integration and dependency validation are complete.

## Recommended Next Phase

Start **Spike B: Microsoft Graph API validation**.

Reasoning:

- The product cannot work without real Microsoft 365 mailbox access.
- B1-B5 validate the minimum read path: app registration, auth, token cache, token refresh, and message fetch.
- B9 and B12 are critical product assumptions: GTD folder naming and moving mail.
- B3 token persistence is mandatory for unattended cron or scheduled processing.
- B9 can change visible UX and folder constants if `@Action`-style names fail.

Run **Spike C: Dependency Compatibility** in parallel only where it helps:

- C3 should happen before production dependencies are locked.
- C4 validates standalone TypeBox schemas used by security guardrails and plugin contracts.
- C1 validates the cache storage choice before pipeline implementation.

## Phase Goal

Produce documented evidence for Graph auth and core mailbox operations, without writing production Graph modules yet unless a spike script needs a small throwaway harness.

## Scope

### Primary Workstream: Spike B

1. B1 Azure app registration - done
   - Follow `docs/microsoft-graph-setup.md`.
   - Record evidence in `docs/spikes/microsoft-graph.md`.
   - Record tenant/account type.
   - Confirm delegated `Mail.ReadWrite` only.
   - Document admin consent requirements.

2. B2 MSAL device code flow - done
   - Add a throwaway spike script only if needed.
   - Confirm access token is returned.
   - Confirm token includes `Mail.ReadWrite`.

3. B3 token cache persistence - done
   - Persist MSAL cache to a private file.
   - Verify owner-only permissions.
   - Restart script and verify silent auth.

4. B4 token refresh - done
   - Verify refresh path or document a practical forced-expiry method.

5. B5-B8 read path - next
   - Fetch structured messages.
   - Fetch full body.
   - Access `internetMessageHeaders`.
   - Validate pagination through `@odata.nextLink`.

6. B9-B13 mutation path
   - Create GTD folder with `@` prefix.
   - Create nested folder if needed.
   - List folders.
   - Move a message.
   - Apply Outlook category.

7. B14-B15 operational behavior
   - Observe rate limiting and `Retry-After`.
   - Validate date filtering and ordering.

### Parallel Workstream: Spike C

Run these only when not blocked on Graph account/browser auth:

1. C3 exact pinned dependency install under `.npmrc`
   - Decide exact package versions.
   - Keep `ignore-scripts=true`.
   - Verify no caret/tilde ranges.

2. C4 TypeBox standalone validation
   - Validate classification output schema outside OpenClaw.
   - Confirm extra fields are rejected.

3. C1 `sql.js` cache validation
   - Confirm it works with scripts disabled.
   - Persist, reload, and query a small DB.

4. C2 SHA-256 hashing
   - Confirm deterministic hash output and acceptable runtime.

5. C5 commander/inquirer
   - Validate interactive and non-interactive setup ergonomics.

## Suggested Files

Use temporary spike files until decisions are recorded:

- `docs/spikes/microsoft-graph.md`
- `docs/spikes/dependency-compatibility.md`
- `spikes/microsoft-graph/`
- `spikes/dependency-compatibility/`

Keep production files untouched unless a spike result requires updating constants or ADRs.

## Backlog Update Rule

When confirming any task is done, update `docs/BACKLOG.md` in the same commit.

Also update:

- `docs/plan.md` for gate or go/no-go changes.
- `docs/spikes/microsoft-graph.md` for B evidence.
- `docs/spikes/dependency-compatibility.md` for C evidence.

## Verification Commands

Before committing any spike update:

```bash
git diff --check
git status --short
```

If dependencies are installed:

```bash
npm run lint
npm test
```

## Stop Conditions

Stop and record a blocker instead of guessing if:

- Azure app registration cannot be completed with delegated `Mail.ReadWrite`.
- MSAL cannot persist and silently reuse token cache.
- Microsoft rejects the planned GTD folder naming convention.
- Moving messages or applying categories requires permissions beyond `Mail.ReadWrite`.
- Dependency validation requires postinstall scripts that violate `.npmrc`.

## Expected End State

At the end of the next phase:

- Spike B has clear pass/fail evidence and decisions.
- Spike C has at least C3/C4 resolved, preferably C1-C5.
- `docs/BACKLOG.md` reflects completed B/C tasks.
- Production implementation can begin only after the remaining MVP validation blockers are understood and accepted.
