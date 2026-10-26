export class SyncError extends Error {
  name = "SyncError";
}

// The saved ZJU session has expired. Only the owner can fix this, by logging in again.
export class NeedsLoginError extends SyncError {
  name = "NeedsLoginError";
}
