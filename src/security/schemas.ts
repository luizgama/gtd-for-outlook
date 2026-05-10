import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const InjectionDetectionResultSchema = Type.Object(
  {
    is_injection: Type.Boolean(),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const ClassificationResultSchema = Type.Object(
  {
    category: Type.Union([
      Type.Literal("@Action"),
      Type.Literal("@WaitingFor"),
      Type.Literal("@SomedayMaybe"),
      Type.Literal("@Reference"),
      Type.Literal("Archive"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type InjectionDetectionResult = {
  is_injection: boolean;
  confidence: number;
  reason: string;
};

export type ClassificationResult = {
  category: "@Action" | "@WaitingFor" | "@SomedayMaybe" | "@Reference" | "Archive";
  confidence: number;
  reason: string;
};

export function isInjectionDetectionResult(value: unknown): value is InjectionDetectionResult {
  return Value.Check(InjectionDetectionResultSchema, value);
}

export function isClassificationResult(value: unknown): value is ClassificationResult {
  return Value.Check(ClassificationResultSchema, value);
}
