// Core domain model shared by the API, engine, seed generator and UI.

export type Lifecycle = "registered" | "learning" | "active" | "degraded" | "quarantined" | "isolated" | "retired";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type Env = "production" | "staging" | "sandbox";

export type EventType =
  | "session_start"
  | "session_end"
  | "prompt_received"
  | "content_read"
  | "tool_call"
  | "data_access"
  | "network_egress"
  | "delegation"
  | "policy_decision";

export type TrustLevel = "trusted" | "internal" | "untrusted";

export interface RoleManifest {
  version: number;
  agentId: string;
  name: string;
  declaredRole: string;
  businessPurpose: string;
  owner: string;
  environment: Env;
  riskTier: RiskTier;
  allowedTools: string[];
  allowedDataClasses: string[];
  allowedDestinations: string[];
  allowedActionTypes: string[];
  operatingHours: [number, number]; // local hours [start, end)
  delegableTo: string[];
  maxDelegationDepth: number;
  canaryIds: string[];
  changeEventId?: string;
  effectiveAt?: number;
}

export interface AgentRecord {
  id: string;
  name: string;
  owner: string;
  ownerAvatar: string;
  team: string;
  environment: Env;
  declaredRole: string;
  businessPurpose: string;
  riskTier: RiskTier;
  lifecycle: Lifecycle;
  createdAt: number;
  manifest: RoleManifest;
  containmentLevel: number; // 0 monitor .. 5 isolate
  /** JSON-encoded restrictions applied by the gateway. */
  restrictions: Restrictions;
  signedKeyId: string;
}

export interface Restrictions {
  blockedTools: string[];
  blockedDataClasses: string[];
  blockedDestinations: string[];
  paused: boolean;
  readOnly: boolean;
  tokenRevoked: boolean;
  egressCut: boolean;
}

export const EMPTY_RESTRICTIONS: Restrictions = {
  blockedTools: [],
  blockedDataClasses: [],
  blockedDestinations: [],
  paused: false,
  readOnly: false,
  tokenRevoked: false,
  egressCut: false,
};

export interface AgentEvent {
  id: string;
  agentId: string;
  sessionId: string;
  ts: number;
  seq: number;
  type: EventType;
  /** Null when unknown (e.g. network egress). */
  tool?: string;
  dataClass?: string;
  sensitivity?: "public" | "internal" | "confidential" | "restricted";
  destination?: string;
  bytes?: number;
  source?: string;
  trustLevel?: TrustLevel;
  delegatTo?: string;
  actionType?: string;
  outcome?: "allowed" | "blocked" | "approval_required" | "error";
  argsHash?: string;
  latencyMs?: number;
  canary?: boolean;
  /** Injected taint ids carried forward from untrusted reads (spans multiple events). */
  taintIds?: string[];
  /** Id of an untrusted taint source established by this event (content_read of untrusted source). */
  taintOrigin?: string;
  /** For delegation/policy events, the parent event id. */
  parentEventId?: string;
  label?: 0 | 1; // ground-truth for simulation metrics
}

export interface TaintTrace {
  taintId: string;
  agentId: string;
  originEventId: string;
  sourceName: string;
  trustLevel: TrustLevel;
  startedAt: number;
  /** Event ids in causal order downstream of the origin. */
  path: string[];
  terminalAction?: string;
  resolved: boolean;
}

export type ContributionKey =
  | "scope_violation"
  | "distributional_drift"
  | "sequence_anomaly"
  | "exfiltration"
  | "delegation"
  | "injection"
  | "canary"
  | "slow_drift"
  | "mimicry";

export interface Contribution {
  key: ContributionKey;
  label: string;
  /** Points contributed to the 0–100 risk score (all contributions sum to `score`). */
  points: number;
  /** Raw signal value in its natural unit (e.g. 0.34 nats, 4 out-of-scope events). */
  value: number;
  unit: string;
  baseline: string;
  explanation: string;
}

export interface AlignmentScore {
  agentId: string;
  windowStart: number;
  windowEnd: number;
  /** 0–100 role alignment (100 = perfectly matches declared role). */
  alignment: number;
  /** 0–100 drift risk = 100 - alignment, decomposed into contributions. */
  risk: number;
  contributions: Contribution[];
  confidence: number;
  coldStart: boolean;
  baselineVersion: number;
  changePointDetected: boolean;
}

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface AlertRecord {
  id: string;
  agentId: string;
  incidentId?: string;
  createdAt: number;
  riskScore: number;
  severity: Severity;
  confidence: number;
  title: string;
  explanation: string[];
  contributions: Contribution[];
  triggerEventIds: string[];
  taintId?: string;
  taintSource?: string;
  roleDiff: { declared: string[]; observed: string[] }[];
  suggestedAction: { level: number; label: string; reasoning: string };
  status: "open" | "acknowledged" | "escalated" | "closed";
  disposition?: "true_positive" | "false_positive" | "benign_change" | null;
  firstSeenOffsetS?: number;
  rule: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  agentIds: string[];
  severity: Severity;
  alertIds: string[];
  createdAt: number;
  status: "open" | "contained" | "closed";
  acknowledgedAt?: number;
  containedAt?: number;
  blastRadius?: number;
}

export interface ChangeEvent {
  id: string;
  agentId: string;
  ts: number;
  kind: "deploy" | "new_tool" | "manifest_update" | "task_change" | "infra";
  description: string;
  approvedBy: string;
  gracePeriodMin: number;
}

export interface BaselineProfile {
  agentId: string;
  version: number;
  createdAt: number;
  sampleSize: number;
  /** Fraction of the learning window completed 0..1. */
  progress: number;
  confidence: number;
  toolFreq: Record<string, number>;
  dataClassFreq: Record<string, number>;
  destinationFreq: Record<string, number>;
  hourProfile: number[]; // 24 buckets
  tokenStats: { mean: number; stdev: number; p95: number };
  transitions: Record<string, Record<string, number>>; // action -> next action
  delegationFreq: Record<string, number>;
  /** Per-feature confidence half-width at 95%. */
  featureBands: { feature: string; mean: number; low: number; high: number }[];
  source: "role_prior" | "learned";
}

export interface PolicyRecord {
  id: string;
  name: string;
  description: string;
  level: number;
  rego: string;
  enabled: boolean;
  createdAt: number;
}

export interface ContainmentAction {
  id: string;
  agentId: string;
  ts: number;
  fromLevel: number;
  toLevel: number;
  actor: string;
  reason: string;
  dryRun: boolean;
  blockedEstimate?: number;
  allowedEstimate?: number;
  rolledBack?: boolean;
}

export interface AuditEntry {
  seq: number;
  ts: number;
  actor: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export const SEVERITY_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];

export function severityFor(score: number): Severity {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 30) return "low";
  return "info";
}

export const CONTRIBUTION_LABELS: Record<ContributionKey, string> = {
  scope_violation: "Scope violation",
  distributional_drift: "Distributional drift",
  sequence_anomaly: "Sequence anomaly",
  exfiltration: "Exfiltration signal",
  delegation: "Delegation anomaly",
  injection: "Injection signal",
  canary: "Canary / honeypot touch",
  slow_drift: "Slow drift (CUSUM)",
  mimicry: "Mimicry",
};

export const LADDER = [
  { level: 0, key: "monitor", label: "Monitor", description: "Observe and score. No enforcement." },
  { level: 1, key: "notify", label: "Notify owner", description: "Page the agent owner and open an incident." },
  { level: 2, key: "step_up", label: "Step-up approval", description: "High-risk actions require human approval." },
  { level: 3, key: "restrict", label: "Restrict", description: "Block specific tools, destinations or data classes." },
  { level: 4, key: "quarantine", label: "Quarantine", description: "Pause the agent; allow in-flight safe tasks to finish." },
  { level: 5, key: "isolate", label: "Isolate", description: "Revoke tokens, cut egress, snapshot state for forensics." },
];
