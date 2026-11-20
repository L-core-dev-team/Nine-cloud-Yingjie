import { z } from "zod";

export const schemaVersion = "0.1" as const;
const version = z.literal(schemaVersion);
const text = z.string().trim().min(1);
const id = text;
const positive = z.int().positive();
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const list = z.array(text).refine(items => new Set(items).size === items.length, "duplicate value");
const time = z.iso.datetime({ offset: true });
const obj = z.strictObject;

export const SourceSchema = z.discriminatedUnion("kind", [
  obj({ schemaVersion: version, kind: z.literal("synthetic-fixture"), fixtureId: id, eventId: id }),
  obj({ schemaVersion: version, kind: z.literal("card-history"), ownerId: id, sessionId: z.uuid(),
    key: z.uuid(), revision: positive, evidence: z.literal("completed-history") }),
  obj({ schemaVersion: version, kind: z.literal("native-turn"), ownerId: id, saveId: id,
    branchId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/), parentBranchId: id.nullable(),
    forkRevision: z.int().nonnegative(), key: id, revision: positive, evidence: z.literal("accepted-archived-text") })
]).refine(s => s.kind !== "native-turn" || (s.forkRevision <= s.revision &&
  (s.parentBranchId === null ? s.branchId === "root" && s.forkRevision === 0 :
    s.branchId !== "root" && s.branchId !== s.parentBranchId)), "invalid branch lineage");
export type Source = z.infer<typeof SourceSchema>;

// Accept exactly the projection returned by CardImportService.history.
const historyRow = obj({ key: z.uuid(), action: text, narrative: text, resulting_revision: positive });
export function fromCardHistory(ownerId: string, sessionId: string, row: unknown) {
  const { key, narrative, resulting_revision } = historyRow.parse(row);
  const source = SourceSchema.parse({ schemaVersion, kind: "card-history", ownerId, sessionId,
    key, revision: resulting_revision, evidence: "completed-history" });
  return { source, narrative };
}

export const SceneSchema = obj({ schemaVersion: version, sceneId: id, source: SourceSchema,
  name: text, aliases: list, parentSceneId: id.nullable(), fixedFeatures: list });
export const FactSchema = obj({ source: SourceSchema, value: text, playerKnown: z.boolean(),
  basis: z.enum(["current-story", "memory", "plan", "rumor", "image-detail"]) });
export const VisualSchema = obj({ schemaVersion: version, source: SourceSchema, sceneId: id, visualVersion: id,
  people: list, features: list, lighting: text, timeOfDay: text, viewpoint: text, perspective: text });
export type Visual = z.infer<typeof VisualSchema>;
const reference = obj({ assetId: id, sha256: digest, visualVersion: id, reviewId: id });
const base = { schemaVersion: version, target: VisualSchema, reason: text };
export const DecisionSchema = z.discriminatedUnion("action", [
  obj({ ...base, action: z.literal("skip") }), obj({ ...base, action: z.literal("generate") }),
  obj({ ...base, action: z.literal("reuse"), assetId: id }),
  obj({ ...base, action: z.literal("edit"), reference, preservePeople: list, preserveFeatures: list, change: text })
]);
export type Decision = z.infer<typeof DecisionSchema>;

const tri = z.enum(["supported", "unsupported", "unknown"]);
export const CapabilitySchema = obj({ schemaVersion: version, entry: id,
  origin: z.enum(["codex-tool", "backend", "mock", "offline"]), verifiedAt: time.nullable(),
  generate: tri, referenceEdit: tri, query: tri, cancel: tri, idempotency: tri
}).refine(c => c.verifiedAt !== null ||
  [c.generate,c.referenceEdit,c.query,c.cancel,c.idempotency].every(v => v === "unknown"), "missing verification time");
export type Capability = z.infer<typeof CapabilitySchema>;

const remoteId = obj({ value: id, source: z.enum(["provider-response", "provider-callback"]) });
const outcome = z.discriminatedUnion("state", [
  obj({ state: z.literal("not-sent"), reason: text }), obj({ state: z.literal("waiting") }),
  obj({ state: z.literal("unknown"), reason: text }),
  obj({ state: z.literal("returned"), assetId: id, sha256: digest }),
  obj({ state: z.literal("failed"), reason: text }), obj({ state: z.literal("refused"), reason: text }),
  obj({ state: z.literal("cancelled"), confirmation: text })
]);
export const AttemptSchema = obj({ schemaVersion: version, requestKey: id, attemptId: id, capability: CapabilitySchema,
  sentAt: time.nullable(), observedAt: time, outcome, localWait: z.enum(["active","stopped"]),
  providerRequestId: remoteId.nullable(), model: text.nullable(), seed: z.string().nullable(),
  usage: obj({ unit: text, quantity: z.number().nonnegative() }).nullable(),
  cost: obj({ kind: z.enum(["actual","estimate"]), amount: z.number().nonnegative(), currency: text }).nullable()
}).refine(a => (a.sentAt === null) === (a.outcome.state === "not-sent") &&
  (a.sentAt === null ? a.providerRequestId === null : Date.parse(a.sentAt) <= Date.parse(a.observedAt)),
  "invalid dispatch or observation time")
  .refine(a => a.outcome.state !== "cancelled" || a.capability.cancel === "supported", "unverified cancellation");
export type Attempt = z.infer<typeof AttemptSchema>;

export const AssetSchema = obj({ schemaVersion: version, assetId: id, target: VisualSchema,
  requestKey: id, attemptId: id, reference: reference.nullable(), sha256: digest, width: positive,
  height: positive, format: z.enum(["png","jpeg","webp"]), invalidated: z.boolean(),
  storageKey: z.string().regex(/^[\w.-]+(?:\/[\w.-]+)*$/).refine(k => !k.split("/").some(p => p === "." || p === "..")).nullable(),
  review: obj({ id, status: z.enum(["pending","accepted","rejected"]), assessment: z.enum(["matches","contradicts","indeterminate"]),
    reason: text, basis: text })
}).refine(a => a.review.status !== "accepted" || a.review.assessment === "matches", "review inconclusive or contradictory");
export type Asset = z.infer<typeof AssetSchema>;
