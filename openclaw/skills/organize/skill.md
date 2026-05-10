# Organize Skill

## Objective

Apply validated classification result to mailbox state.

## Steps

1. Resolve destination GTD folder/category from classification output.
2. Ensure destination folder exists.
3. Move message to destination folder.
4. Apply Outlook category label.
5. Update processing state/checkpoint for idempotent re-runs.

## Constraints

- do not organize messages without validated classification
- preserve state consistency when move succeeds but category update fails
- emit actionable error details on Graph failures
