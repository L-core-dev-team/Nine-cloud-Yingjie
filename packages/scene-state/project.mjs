import { SceneSchema, VisualSchema, DecisionSchema, FactSchema, currentFacts,
  sameVisual, schemaVersion } from "../contracts/dist/index.js";

const fields = ["people", "features", "timeOfDay", "lighting", "viewpoint", "perspective"];
const collections = ["people", "features"];
function label(value) {
  if (typeof value !== "string" || !value.trim()) throw Error("missing-label");
  return value.trim();
}

function selectPlace(state, op, source) {
  if (op.type === "create") {
    const scene = SceneSchema.parse({ schemaVersion, source, sceneId: op.sceneId, name: op.name,
      aliases: [], parentSceneId: op.parentSceneId, fixedFeatures: op.fixedFeatures });
    if (state.places.some(p => p.scene.sceneId === scene.sceneId)) throw Error("scene-id-exists");
    const place = { scene, version: 0, facts: {}, confirmed: {}, visual: null };
    state.places.push(place);
    return place;
  }
  if (op.type === "visit") {
    const matches = state.places.filter(({scene}) => op.sceneId ? scene.sceneId === op.sceneId :
      (scene.name === op.name || scene.aliases.includes(op.name)) &&
      (op.parentSceneId === undefined || scene.parentSceneId === op.parentSceneId));
    if (matches.length !== 1) {
      state.reason = matches.length ? "ambiguous-place" : "unknown-place";
      return null;
    }
    if (op.confirmedContinuity !== true) {
      state.reason = "revisit-needs-confirmation";
      return null;
    }
    return matches[0];
  }
  throw Error("invalid-location-operation");
}

function updateFacts(place, op, source) {
  if (!fields.includes(op.field)) throw Error("unknown-visual-field");
  const field = op.field;
  let value;
  if (collections.includes(field)) {
    if (!Array.isArray(op.values)) throw Error("expected-values");
    const names = op.values.map(label);
    const previous = place.facts[field];
    if (op.type !== "set" && !previous) throw Error("unknown-collection-baseline");
    switch (op.type) {
      case "set": value = names; break;
      case "add": value = [...previous, ...names]; break;
      case "remove": value = previous.filter(item => !names.includes(item)); break;
      default: throw Error("invalid-collection-operation");
    }
    value = [...new Set(value)].sort();
    const prior = place.confirmed[field] ?? [];
    place.confirmed[field] = value.map(name => {
      const previous = prior.find(entry => entry.name === name);
      return { name, source: op.type === "set" || names.includes(name) ? source : previous.source };
    });
  } else {
    if (op.type !== "set") throw Error("invalid-scalar-operation");
    value = label(op.value);
    place.confirmed[field] = source;
  }
  place.facts[field] = value;
}

// The extractor supplies ordered observations, each tied to this saved source.
// No unannotated narrative, player action or image is interpreted here.
export function project(state, source, observations) {
  if (!Array.isArray(observations)) throw Error("annotations-pending");
  let place = state.places.find(p => p.scene.sceneId === state.current);
  const touched = new Set();
  let surveyFields;
  for (const { basis, playerKnown, operation: op } of observations) {
    const fact = FactSchema.parse({ source, basis, playerKnown, value: op.type });
    if (!currentFacts(source, [fact]).length) continue;
    switch (op.type) {
      case "hold":
        if (!place) throw Error("hold-without-place");
        place.pending = {reason:label(op.reason),source};
        break;
      case "confirm-survey":
        if (!place || !fields.every(field => surveyFields?.has(field))) throw Error("incomplete-survey");
        delete place.pending;
        break;
      case "unknown":
        if (op.unresolvedPlaces) {
          for (const prior of state.places) prior.pending = {reason:label(op.reason),source};
        }

      case "leave":
        place = null;
        state.reason = label(op.reason);
        break;
      case "create":
      case "visit":
        place = selectPlace(state, op, source);
        surveyFields = new Set();
        break;
      case "rename":
        if (!place) throw Error("rename-without-place");
        place.scene.aliases = [...new Set([...place.scene.aliases, place.scene.name])];
        place.scene.name = label(op.name);
        place.scene.aliases = place.scene.aliases.filter(name => name !== place.scene.name);
        place.scene.source = source;
        break;
      case "set":
      case "add":
      case "remove":
        if (!place) throw Error("change-without-place");
        updateFacts(place, op, source);
        if (op.type === "set") surveyFields?.add(op.field);
        break;
      default: throw Error("unsupported-operation");
    }
    if (place) touched.add(place);
  }
  if (place) touched.add(place);
  for (const target of touched) snapshot(target, source);
  state.current = place?.scene.sceneId ?? null;
  if (!place) return { status: "not-ready", reason: state.reason ?? "unlocated" };
  state.reason = null;
  const scene = SceneSchema.parse(place.scene);
  if (place.pending) return { status:"not-ready", reason:place.pending.reason, scene };
  if (!fields.every(f => Object.hasOwn(place.facts, f))) {
    return { status: "not-ready", reason: "incomplete-visible-facts", scene };
  }
  return { status: "ready", scene, visual: place.visual,
    decision: DecisionSchema.parse({ schemaVersion, target: place.visual, action:"skip", reason:"状态已保存，等待画面规划" }) };
}

function snapshot(place, source) {
  if (place.pending || !fields.every(f => Object.hasOwn(place.facts, f))) return;
  const visual = VisualSchema.parse({ schemaVersion, source, sceneId: place.scene.sceneId,
    visualVersion: "V" + (place.version || 1), ...place.facts });
  if (!place.visual || !sameVisual(place.visual, visual)) {
    place.version++;
    visual.visualVersion = "V" + place.version;
  }
  place.visual = visual;
}
