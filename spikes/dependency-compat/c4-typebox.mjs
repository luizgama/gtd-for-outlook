import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const ClassificationSchema = Type.Object(
  {
    category: Type.Union([
      Type.Literal("@Action"),
      Type.Literal("@WaitingFor"),
      Type.Literal("@SomedayMaybe"),
      Type.Literal("@Reference"),
    ]),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    reason: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const validPayload = {
  category: "@Action",
  confidence: 0.92,
  reason: "Direct request requiring follow-up.",
};

const invalidPayload = {
  category: "@Unknown",
  confidence: 1.2,
  reason: "",
};

const extraFieldPayload = {
  category: "@Action",
  confidence: 0.7,
  reason: "Valid content",
  extra: "should-reject",
};

const validPass = Value.Check(ClassificationSchema, validPayload);
const invalidRejected = !Value.Check(ClassificationSchema, invalidPayload);
const extraRejected = !Value.Check(ClassificationSchema, extraFieldPayload);

console.log(
  JSON.stringify(
    {
      validPass,
      invalidRejected,
      extraRejected,
    },
    null,
    2,
  ),
);

if (!validPass || !invalidRejected || !extraRejected) {
  throw new Error("TypeBox validation checks failed.");
}
