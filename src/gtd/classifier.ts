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
  if (/\b(waiting|awaiting|follow up|follow-up|vendor|partner)\b/.test(lower)) {
    return { category: "@WaitingFor", confidence: 0.62, reason: "External dependency language detected." };
  }
  if (/\b(idea|someday|later|maybe)\b/.test(lower)) {
    return { category: "@SomedayMaybe", confidence: 0.64, reason: "Deferred/planning language detected." };
  }
  if (/\b(review|approve|reply|deadline|action|required)\b/.test(lower)) {
    return { category: "@Action", confidence: 0.72, reason: "Action-oriented wording detected." };
  }
  if (/\b(fyi|reference|documentation|notes)\b/.test(lower)) {
    return { category: "@Reference", confidence: 0.62, reason: "Reference-only content detected." };
  }
  return { category: "Archive", confidence: 0.56, reason: "No clear action signal detected." };
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
