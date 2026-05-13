import { describe, expect, it } from "vitest";
import { triageEmailMetadata } from "../../../src/pipeline/triage";

describe("pipeline/triage", () => {
  it("detects newsletters via List-Unsubscribe header", () => {
    const decision = triageEmailMetadata({
      id: "m1",
      subject: "Weekly digest",
      sender: "news@example.com",
      receivedAt: "2026-05-09T00:00:00.000Z",
      headers: { "List-Unsubscribe": "<mailto:unsubscribe@example.com>" },
    });
    expect(decision?.action).toBe("reference");
  });

  it("detects automated noreply senders", () => {
    const decision = triageEmailMetadata({
      id: "m2",
      subject: "System notification",
      sender: "noreply@example.com",
      receivedAt: "2026-05-09T00:00:00.000Z",
    });
    expect(decision?.action).toBe("reference");
  });

  it("applies age-based someday rule", () => {
    const decision = triageEmailMetadata(
      {
        id: "m3",
        subject: "Old email",
        sender: "user@example.com",
        receivedAt: "2025-01-01T00:00:00.000Z",
      },
      new Date("2026-05-09T00:00:00.000Z"),
    );
    expect(decision?.action).toBe("someday");
  });

  it("returns null when no triage shortcut matches", () => {
    const decision = triageEmailMetadata({
      id: "m4",
      subject: "Please review this proposal",
      sender: "person@example.com",
      receivedAt: "2026-05-09T00:00:00.000Z",
    });
    expect(decision).toBeNull();
  });

  it("keeps duplicate vendor/system notices as reference by default", () => {
    const decision = triageEmailMetadata({
      id: "m5",
      subject: "Incident update reminder",
      sender: "noreply@vendor.example",
      receivedAt: "2026-05-09T00:00:00.000Z",
    });
    expect(decision?.action).toBe("reference");
  });

  it("can archive duplicate vendor/system notices via preference", () => {
    const decision = triageEmailMetadata(
      {
        id: "m6",
        subject: "Maintenance follow-up update",
        sender: "no-reply@vendor.example",
        receivedAt: "2026-05-09T00:00:00.000Z",
      },
      new Date("2026-05-09T00:00:00.000Z"),
      { duplicateVendorNoticePreference: "archive" },
    );
    expect(decision?.action).toBe("archive");
  });
});
