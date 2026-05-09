import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

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

export type ClassificationResult = {
  category: "@Action" | "@WaitingFor" | "@SomedayMaybe" | "@Reference" | "Archive";
  confidence: number;
  reason: string;
};

export function isClassificationResult(value: unknown): value is ClassificationResult {
  return Value.Check(ClassificationResultSchema, value);
}
