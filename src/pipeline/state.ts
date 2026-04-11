// TODO: Checkpoint persistence
// - Persist processing state to ~/.gtd-outlook/state.json
// - Track: emailId → { status, classifiedAt, hash }
// - Idempotent: re-processing classified email is a no-op
// - Resume from last checkpoint on interruption
