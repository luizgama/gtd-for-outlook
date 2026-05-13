import { validateClassification } from "../security/guardrails.js";
import { sanitizeEmailContent } from "../security/sanitizer.js";
import { isClassificationResult, type ClassificationResult } from "../security/schemas.js";
import { type DetectorInput, type InjectionDetector, createInjectionDetector } from "../security/detector.js";
import { buildClassificationPrompt } from "./prompts.js";

export interface ClassifierDependencies {
  detector?: InjectionDetector;
  classify?: (prompt: string, input: ClassifyEmailInput) => Promise<unknown>;
}

export interface ClassifyEmailInput {
  id: string;
  subject: string;
  sender: string;
  body: string;
  receivedAt?: string;
  headers?: Record<string, string>;
}

export interface ClassifierResult extends ClassificationResult {
  sanitizedContent: string;
  detectionConfidence: number;
  injectionDetected: boolean;
  guardrailReasons: string[];
}

function fallbackClassification(sanitizedText: string): ClassificationResult {
  const lower = sanitizedText.toLowerCase();

  const actionStrong = [
    /\b(please|por favor)\s+(review|approve|reply|respond|confirm)\b/,
    /\b(action required|required action|requires your action)\b/,
    /\b(awaiting your approval|pending your approval|aguarda aprovação|aguardando aprovação)\b/,
    /\b(by|until)\s+(monday|tuesday|wednesday|thursday|friday|eod|end of day|amanhã|hoje)\b/,
    /\b(deadline|prazo)\b/,
  ];
  const waitingSignals = [
    /\b(waiting for|awaiting|pending response|follow up|follow-up)\b/,
    /\b(vendor|partner|supplier|terceiro|fornecedor)\b/,
  ];
  const somedaySignals = [/\b(idea|someday|later|maybe|talvez|futuro)\b/];
  const referenceStrong = [
    /\b(fyi|for your information|reference|documentation|notes|ata|meeting report|relatório)\b/,
    /\b(incident|outage|maintenance|manutenção)\b/,
    /\b(approved|aprovado|aprovada|approval complete|confirmed|confirmado|confirmada)\b/,
    /\b(receipt|invoice approved|timesheet approved|férias aprovadas)\b/,
    /\b(report|summary|minutes)\b/,
  ];
  const archiveStrong = [
    /\b(unsubscribe|newsletter|promo|promotion|marketing|sale|discount|deal)\b/,
    /\b(one-time code|verification code|otp|login code|security code|código de verificação)\b/,
    /\b(no-reply marketing)\b/,
  ];

  const actionMatches = actionStrong.filter((re) => re.test(lower)).length;
  const waitingMatches = waitingSignals.filter((re) => re.test(lower)).length;
  const somedayMatches = somedaySignals.filter((re) => re.test(lower)).length;
  const referenceMatches = referenceStrong.filter((re) => re.test(lower)).length;
  const archiveMatches = archiveStrong.filter((re) => re.test(lower)).length;

  const score = {
    "@Action": actionMatches * 4 + (/\b(review|approve|reply)\b/.test(lower) ? 1 : 0),
    "@WaitingFor": waitingMatches * 3,
    "@SomedayMaybe": somedayMatches * 2,
    "@Reference": referenceMatches * 3,
    Archive: archiveMatches * 3,
  };

  // Pending approval is an explicit action; completed approval is a reference record.
  if (/\b(aguarda aprovação|aguardando aprovação|awaiting your approval|pending your approval)\b/.test(lower)) {
    score["@Action"] += 3;
  }
  if (/\b(aprovado|aprovada|approved|approval complete)\b/.test(lower)) {
    score["@Reference"] += 3;
    score["@Action"] = Math.max(0, score["@Action"] - 1);
  }

  // OTP/login code notices are generally non-actionable records after use.
  if (/\b(one-time code|verification code|otp|login code|security code|código de verificação)\b/.test(lower)) {
    score.Archive += 5;
    score["@Action"] = 0;
  }

  // Choose the highest score category. Tie-breaking prefers @Action > @Reference > @WaitingFor > @SomedayMaybe > Archive.
  const ordered: Array<keyof typeof score> = ["@Action", "@Reference", "@WaitingFor", "@SomedayMaybe", "Archive"];
  let best: keyof typeof score = "Archive";
  for (const category of ordered) {
    if (score[category] > score[best]) {
      best = category;
    }
  }
  const sortedScores = Object.values(score).sort((a, b) => b - a);
  const scoreGap = sortedScores[0] - (sortedScores[1] ?? 0);
  const ambiguityPenalty = scoreGap <= 1 ? 0.08 : 0;
  const calibrated = (base: number) => Math.max(0, Math.min(1, Number((base - ambiguityPenalty).toFixed(2))));

  if (score[best] <= 0) {
    return { category: "Archive", confidence: 0.52, reason: "No meaningful GTD signal detected." };
  }

  if (best === "@Action") {
    return {
      category: "@Action",
      confidence: calibrated(score["@Action"] >= 6 ? 0.86 : 0.74),
      reason:
        score["@Action"] >= 6
          ? "Explicit user action and urgency signals detected."
          : "User follow-up/action language detected.",
    };
  }
  if (best === "@WaitingFor") {
    return {
      category: "@WaitingFor",
      confidence: calibrated(score["@WaitingFor"] >= 6 ? 0.82 : 0.71),
      reason: "External dependency or pending response signal detected.",
    };
  }
  if (best === "@SomedayMaybe") {
    return {
      category: "@SomedayMaybe",
      confidence: calibrated(score["@SomedayMaybe"] >= 4 ? 0.76 : 0.67),
      reason: "Deferred/planning language detected.",
    };
  }
  if (best === "@Reference") {
    return {
      category: "@Reference",
      confidence: calibrated(score["@Reference"] >= 6 ? 0.83 : 0.72),
      reason: "Non-actionable but useful record signal detected.",
    };
  }
  return {
    category: "Archive",
    confidence: calibrated(score.Archive >= 6 ? 0.78 : 0.66),
    reason: "Low-value, promotional, or one-time code signal detected.",
  };
}

export async function classifyEmail(
  input: ClassifyEmailInput,
  dependencies: ClassifierDependencies = {},
): Promise<ClassifierResult> {
  const detector = dependencies.detector ?? createInjectionDetector();
  const sanitized = sanitizeEmailContent(`${input.subject}\n${input.body}`);

  const detectorInput: DetectorInput = {
    subject: input.subject,
    sender: input.sender,
    body: sanitized.sanitizedContent,
  };
  const detection = await detector.detect(detectorInput);

  const prompt = buildClassificationPrompt({
    subject: input.subject,
    sender: input.sender,
    receivedAt: input.receivedAt,
    body: sanitized.sanitizedContent,
  });

  const modelCandidate = dependencies.classify
    ? await dependencies.classify(prompt, input)
    : fallbackClassification(sanitized.sanitizedContent);

  if (!isClassificationResult(modelCandidate)) {
    throw new Error("Classifier output failed schema validation.");
  }

  const decision = validateClassification({
    detection,
    classification: modelCandidate,
    sanitizedContent: sanitized.sanitizedContent,
    rawContent: input.body,
  });

  if (!decision.accepted) {
    throw new Error(`Classification rejected by guardrails: ${decision.reasons.join("; ")}`);
  }

  return {
    ...modelCandidate,
    sanitizedContent: sanitized.sanitizedContent,
    detectionConfidence: detection.confidence,
    injectionDetected: detection.is_injection,
    guardrailReasons: decision.reasons,
  };
}
