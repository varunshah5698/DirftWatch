import { mean, quantile, stdev } from "@/analytics/stats";
import type { AgentEvent, BaselineProfile, RoleManifest } from "./domain";

/** Normalise a count map to a probability distribution. */
export function normalise(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v / total;
  return out;
}

/** A simple, expressive action label used for the transition matrix. */
export function actionKey(e: AgentEvent): string {
  switch (e.type) {
    case "tool_call":
      return `tool:${e.tool ?? "unknown"}`;
    case "data_access":
      return `data:${e.dataClass ?? "unknown"}`;
    case "network_egress":
      return `egress:${e.destination ?? "unknown"}`;
    case "content_read":
      return `read:${e.source ?? "unknown"}`;
    case "delegation":
      return `delegate:${e.delegatTo ?? "unknown"}`;
    case "prompt_received":
      return "prompt";
    case "session_start":
      return "start";
    case "session_end":
      return "end";
    case "policy_decision":
      return `policy:${e.outcome ?? "unknown"}`;
  }
}

/**
 * Precompute the action list once — the engine calls actionKey on every event of a
 * 30-day window, so avoid per-call closures in the hot loop.
 */
export function sequenceOf(events: readonly AgentEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) if (e.type !== "session_start" && e.type !== "session_end") out.push(actionKey(e));
  return out;
}

/** Role-template prior: what the role *should* look like before any history exists. */
export function rolePrior(manifest: RoleManifest): BaselineProfile {
  const toolFreq = normalise(Object.fromEntries(manifest.allowedTools.map((t) => [t, 1])));
  const dataClassFreq = normalise(Object.fromEntries(manifest.allowedDataClasses.map((d) => [d, 1])));
  const destinationFreq = normalise(Object.fromEntries(manifest.allowedDestinations.map((d) => [d, 1])));
  const transitions: Record<string, Record<string, number>> = {};
  const tools = manifest.allowedTools.map((t) => `tool:${t}`);
  for (const a of tools) transitions[a] = normalise(Object.fromEntries(tools.map((b) => [b, 1])));
  return {
    agentId: manifest.agentId,
    version: 0,
    createdAt: Date.now(),
    sampleSize: 0,
    progress: 0,
    confidence: 0.15,
    toolFreq,
    dataClassFreq,
    destinationFreq,
    hourProfile: hourBands(manifest.operatingHours),
    tokenStats: { mean: 900, stdev: 300, p95: 1500 },
    transitions,
    delegationFreq: {},
    featureBands: [
      { feature: "tools", mean: manifest.allowedTools.length, low: 0, high: manifest.allowedTools.length + 2 },
      { feature: "data_classes", mean: manifest.allowedDataClasses.length, low: 0, high: manifest.allowedDataClasses.length + 2 },
      { feature: "destinations", mean: manifest.allowedDestinations.length, low: 0, high: manifest.allowedDestinations.length + 2 },
    ],
    source: "role_prior",
  };
}

function hourBands([start, end]: [number, number]): number[] {
  const hours = new Array(24).fill(0);
  for (let h = start; h < end || (end <= start && (h < 24 || h - 24 < end)); h++) {
    hours[h % 24] = 1;
    if (h > 47) break;
  }
  const total = hours.reduce((a, b) => a + b, 0) || 1;
  return hours.map((x) => x / total);
}

export interface LearnOptions {
  version?: number;
  prior?: BaselineProfile | null;
}

/**
 * Learn a baseline from a window of normal events.
 *
 * Cold start: when fewer than `minSamples` sequences exist, the learned profile is
 * blended with the role-template prior and confidence is capped, so thresholds are
 * wider until enough data accumulates (spec 4C).
 */
export function learnBaseline(
  manifest: RoleManifest,
  events: readonly AgentEvent[],
  opts: LearnOptions = {},
): BaselineProfile {
  const prior = opts.prior ?? rolePrior(manifest);
  const minSamples = 120;
  const body = events.filter((e) => e.type !== "session_start" && e.type !== "session_end");

  const toolCounts: Record<string, number> = {};
  const dataCounts: Record<string, number> = {};
  const destCounts: Record<string, number> = {};
  const delegationCounts: Record<string, number> = {};
  const hourCounts = new Array(24).fill(0);
  const bytes: number[] = [];
  for (const e of body) {
    if (e.type === "tool_call" && e.tool) toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1;
    if (e.type === "data_access" && e.dataClass) dataCounts[e.dataClass] = (dataCounts[e.dataClass] ?? 0) + 1;
    if (e.type === "network_egress" && e.destination) destCounts[e.destination] = (destCounts[e.destination] ?? 0) + 1;
    if (e.type === "delegation" && e.delegatTo) delegationCounts[e.delegatTo] = (delegationCounts[e.delegatTo] ?? 0) + 1;
    if (typeof e.bytes === "number") bytes.push(e.bytes);
    hourCounts[new Date(e.ts).getHours()]++;
  }

  // Per-session transition counts (Markov n=1 over the action sequence).
  const sessions = new Map<string, string[]>();
  for (const e of events) {
    if (e.type === "session_start" || e.type === "session_end" || e.type === "prompt_received") continue;
    const arr = sessions.get(e.sessionId) ?? [];
    arr.push(actionKey(e));
    sessions.set(e.sessionId, arr);
  }
  const transCounts: Record<string, Record<string, number>> = {};
  for (const seq of sessions.values()) {
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      (transCounts[a] ??= {})[b] = ((transCounts[a] ??= {})[b] ?? 0) + 1;
    }
  }
  const transitions: Record<string, Record<string, number>> = {};
  for (const [a, m] of Object.entries(transCounts)) transitions[a] = normalise(m);

  const hourTotal = hourCounts.reduce((a, b) => a + b, 0);
  const n = body.length;
  const progress = Math.min(1, n / minSamples);
  const confidence = Math.min(0.97, 0.15 + 0.82 * progress);

  // Blend with prior while data is thin (weight on learned = progress).
  const blend = (learned: Record<string, number>, priorDist: Record<string, number>) => {
    const keys = new Set([...Object.keys(learned), ...Object.keys(priorDist)]);
    const out: Record<string, number> = {};
    for (const k of keys) out[k] = progress * (learned[k] ?? 0) + (1 - progress) * (priorDist[k] ?? 0);
    return normalise(out);
  };

  const p = Math.max(0.02, progress);
  const featureBands = ["tools", "data_classes", "destinations"].map((feature) => {
    const observed =
      feature === "tools" ? Object.keys(toolCounts).length : feature === "data_classes" ? Object.keys(dataCounts).length : Object.keys(destCounts).length;
    const priorMean = prior.featureBands.find((b) => b.feature === feature)?.mean ?? observed;
    const m = p * observed + (1 - p) * priorMean;
    // Wider band when the sample is small: half-width shrinks like 1/sqrt(n)
    const half = 2 + 6 / Math.sqrt(Math.max(1, n));
    return { feature, mean: m, low: Math.max(0, m - half), high: m + half };
  });

  const listedTools = new Set(manifest.allowedTools);
  const listedData = new Set(manifest.allowedDataClasses);
  const listedDest = new Set(manifest.allowedDestinations);
  // Role priors always retain a floor on declared capabilities, so an agent that simply
  // did not call an allowed tool today is not considered drifted.
  const withFloor = (dist: Record<string, number>, allowed: Set<string>) => {
    const out = { ...dist };
    for (const a of allowed) out[a] = Math.max(out[a] ?? 0, 0.01);
    return normalise(out);
  };

  return {
    agentId: manifest.agentId,
    version: opts.version ?? 1,
    createdAt: Date.now(),
    sampleSize: n,
    progress,
    confidence,
    toolFreq: withFloor(blend(toolCounts, prior.toolFreq), listedTools),
    dataClassFreq: withFloor(blend(dataCounts, prior.dataClassFreq), listedData),
    destinationFreq: withFloor(blend(destCounts, prior.destinationFreq), listedDest),
    hourProfile: hourTotal > 0 ? hourCounts.map((c) => c / hourTotal) : prior.hourProfile,
    tokenStats: bytes.length
      ? { mean: mean(bytes), stdev: stdev(bytes), p95: quantile(bytes, 0.95) }
      : prior.tokenStats,
    transitions: Object.keys(transitions).length ? transitions : prior.transitions,
    delegationFreq: Object.keys(delegationCounts).length ? normalise(delegationCounts) : prior.delegationFreq,
    featureBands,
    source: progress >= 1 ? "learned" : "role_prior",
  };
}

/** Learning curve: baseline confidence as a function of accumulated samples. */
export function learningCurve(maxSamples = 400, step = 10): { n: number; confidence: number; halfWidth: number }[] {
  const out: { n: number; confidence: number; halfWidth: number }[] = [];
  for (let n = step; n <= maxSamples; n += step) {
    const progress = Math.min(1, n / 120);
    out.push({
      n,
      confidence: Math.min(0.97, 0.15 + 0.82 * progress),
      halfWidth: 2 + 6 / Math.sqrt(n),
    });
  }
  return out;
}
