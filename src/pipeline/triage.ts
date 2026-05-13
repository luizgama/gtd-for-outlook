export interface EmailMetadata {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  headers?: Record<string, string>;
}

export interface TriageDecision {
  action: "classify" | "archive" | "reference" | "someday";
  reason: string;
}

export interface TriageOptions {
  duplicateVendorNoticePreference?: "reference" | "archive";
}

export function triageEmailMetadata(
  email: EmailMetadata,
  now: Date = new Date(),
  options: TriageOptions = {},
): TriageDecision | null {
  const subject = email.subject.toLowerCase();
  const sender = email.sender.toLowerCase();
  const headers = email.headers ?? {};
  const duplicateVendorNoticePreference = options.duplicateVendorNoticePreference ?? "reference";
  const listUnsubscribe = Object.entries(headers).find(([key]) => key.toLowerCase() === "list-unsubscribe");
  const isAutomatedSender = sender.includes("noreply@") || sender.includes("no-reply@");
  const isSystemNotice = /\b(incident|maintenance|outage|status page|service alert)\b/.test(subject);
  const isLikelyDuplicateNotice = /\b(update|reminder|follow-up|resolved|closure|recap)\b/.test(subject);

  if (isAutomatedSender && isSystemNotice && isLikelyDuplicateNotice) {
    return {
      action: duplicateVendorNoticePreference,
      reason: `Likely duplicate vendor/system notice (preferred: ${duplicateVendorNoticePreference}).`,
    };
  }

  if (listUnsubscribe && listUnsubscribe[1]) {
    return { action: "reference", reason: "Detected newsletter header (List-Unsubscribe)." };
  }

  if (isAutomatedSender) {
    return { action: "reference", reason: "Detected automated sender address." };
  }

  const received = new Date(email.receivedAt);
  if (!Number.isNaN(received.getTime())) {
    const ageMs = now.getTime() - received.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 60) {
      return { action: "someday", reason: "Older than 60 days." };
    }
  }

  if (subject.includes("weekly digest") || subject.includes("newsletter")) {
    return { action: "reference", reason: "Digest/newsletter subject detected." };
  }

  return null;
}
