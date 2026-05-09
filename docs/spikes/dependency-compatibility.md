# Spike C: Dependency Compatibility

Working log for dependency compatibility validation under the project security policy.

## Environment

```text
Date: 2026-05-09
Node.js: v22.22.2
npm: 10.9.7
```

## C3. Dependency install under security policy

Status: passed.

Acceptance:

- `npm ci` works under `.npmrc` (`ignore-scripts=true`).
- `package.json` uses exact pinned versions (no `^`/`~` ranges).

Validation commands:

```bash
npm ci
```

```bash
npm install --save-exact sql.js@1.11.0 @sinclair/typebox@0.32.35 commander@12.1.0 inquirer@9.3.7
```

Evidence:

```text
npm ci: success
exact dependency ranges check: badRanges=[]
dependencies:
- @azure/msal-node: 5.1.5
- sql.js: 1.11.0
- @sinclair/typebox: 0.32.35
- commander: 12.1.0
- inquirer: 9.3.7
```

## C1. `sql.js` with `ignore-scripts=true`

Status: passed.

Acceptance:

- Create cache table, insert row, persist DB file, reload, and query inserted row.

Validation command:

```bash
node spikes/dependency-compat/c1-sqljs.mjs
```

Evidence:

```text
rowCount: 1
row.contentHash: hash-c1-test
row.category: @Action
```

Notes:

- Intended default cache path remains `~/.gtd-outlook/classification-cache.db`.
- In this sandbox run, the script used a local writable path (`.tmp/classification-cache.db`) for validation.

## C2. `node:crypto` SHA-256 hashing

Status: passed.

Acceptance:

- Deterministic hashes and acceptable runtime for representative loop workload.

Validation command:

```bash
node spikes/dependency-compat/c2-sha256.mjs
```

Evidence:

```text
algorithm: sha256
iterations: 1000
deterministic: true
avgMsPerHash: 0.013834
```

## C4. `@sinclair/typebox` standalone validation

Status: passed.

Acceptance:

- Valid payload accepted, invalid payload rejected, extra-field payload rejected.

Validation command:

```bash
node spikes/dependency-compat/c4-typebox.mjs
```

Evidence:

```text
validPass: true
invalidRejected: true
extraRejected: true
```

## C5. `commander` + `inquirer` interactive flow

Status: passed.

Acceptance:

- Interactive setup flow works.
- Non-interactive mode works for CI/piped environments.

Validation command (non-interactive CI-style):

```bash
printf '{"clientId":"abc","tenantId":"def","confirm":true}\n' | node spikes/dependency-compat/c5-commander-inquirer.mjs --non-interactive
```

Evidence:

```text
mode: non-interactive
clientIdPresent: true
tenantIdPresent: true
confirmed: true
valid: true
```

Notes:

- Script supports both interactive prompts and non-interactive stdin/flag input.
