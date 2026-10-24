/**
 * Schema migrations. Each entry is applied once and recorded in schema_migrations.
 * Events are stored in range-partitionable monthly chunks (SQLite has no native
 * partitioning, so we emulate the Postgres/Timescale layout from infra/ with an
 * index on (agent_id, ts) plus a ts index for window scans).
 */
export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: "core schema",
    sql: `
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      owner_avatar TEXT NOT NULL,
      team TEXT NOT NULL,
      environment TEXT NOT NULL,
      declared_role TEXT NOT NULL,
      business_purpose TEXT NOT NULL,
      risk_tier TEXT NOT NULL,
      lifecycle TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      manifest_json TEXT NOT NULL,
      containment_level INTEGER NOT NULL DEFAULT 0,
      restrictions_json TEXT NOT NULL,
      signed_key_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manifest_versions (
      agent_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      manage_json TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (agent_id, version)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      tool TEXT,
      data_class TEXT,
      sensitivity TEXT,
      destination TEXT,
      bytes INTEGER,
      source TEXT,
      trust_level TEXT,
      delegate_to TEXT,
      action_type TEXT,
      outcome TEXT,
      args_hash TEXT,
      latency_ms INTEGER,
      canary INTEGER,
      taint_ids TEXT,
      taint_origin TEXT,
      parent_event_id TEXT,
      label INTEGER,
      scenario TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_agent_ts ON events(agent_id, ts);
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_taint ON events(taint_origin);

    CREATE TABLE IF NOT EXISTS taints (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      origin_event_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      trust_level TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      path_json TEXT NOT NULL,
      terminal_action TEXT,
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS baselines (
      agent_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      profile_json TEXT NOT NULL,
      PRIMARY KEY (agent_id, version)
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      window_end INTEGER NOT NULL,
      alignment REAL NOT NULL,
      risk REAL NOT NULL,
      confidence REAL NOT NULL,
      cold_start INTEGER NOT NULL,
      contributions_json TEXT NOT NULL,
      baseline_version INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scores_agent_window ON scores(agent_id, window_end);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      incident_id TEXT,
      created_at INTEGER NOT NULL,
      risk_score REAL NOT NULL,
      severity TEXT NOT NULL,
      confidence REAL NOT NULL,
      title TEXT NOT NULL,
      rule TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      disposition TEXT,
      acknowledged_at INTEGER,
      contained_at INTEGER,
      trigger_offset_s INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_agent ON alerts(agent_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      severity TEXT NOT NULL,
      agent_ids TEXT NOT NULL,
      alert_ids TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      blast_radius INTEGER,
      acknowledged_at INTEGER,
      contained_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS change_events (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      grace_period_min INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      level INTEGER NOT NULL,
      rego TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      from_level INTEGER NOT NULL,
      to_level INTEGER NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      dry_run INTEGER NOT NULL DEFAULT 0,
      blocked_estimate INTEGER,
      allowed_estimate INTEGER,
      rolled_back INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      detail TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canaries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      sensitivity TEXT NOT NULL,
      owner TEXT NOT NULL,
      data_class TEXT NOT NULL,
      destination TEXT
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      rule TEXT NOT NULL,
      disposition TEXT NOT NULL,
      actor TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency (
      key TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      scenario TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      label INTEGER,
      scenario TEXT,
      risk REAL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id, started_at);
    `,
  },
];
