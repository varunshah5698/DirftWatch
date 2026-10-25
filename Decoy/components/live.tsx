"use client";

/**
 * Live dashboard widgets for the Control Room.
 *
 * Everything here renders server data first, then animates on the client:
 * numbers count up and drift, sparklines push new points, the activity feed
 * streams events, and the baseline training panel runs its epoch loop. All
 * motion stops under prefers-reduced-motion (values settle on the server
 * numbers instead of disappearing).
 */

import { useEffect, useState } from "react";
import { AlignmentDial, Sparkline } from "@/components/charts";
import { compact } from "@/lib/format";

/* -------------------------------------------------------------- utilities */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function relativeTime(ts: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

const RESULT_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  allowed: { color: "var(--lime)", bg: "var(--lime-soft)", label: "allowed" },
  restricted: { color: "var(--orange)", bg: "var(--orange-soft)", label: "restricted" },
  blocked: { color: "var(--red)", bg: "var(--red-soft)", label: "blocked" },
};


/* --------------------------------------------------------- ticking numbers */

/**
 * Counts up from 0 on mount, then keeps moving: `jitter` oscillates around the
 * base value, `accumulate` only ever climbs (for ingest counters).
 */
export function TickingNumber({
  base,
  decimals = 0,
  suffix = "",
  compact: compactNotation = false,
  jitter = 0,
  accumulate = false,
  period = 3200,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
}: {
  base: number;
  /** Fractional digits to keep (0 snaps to whole numbers). */
  decimals?: number;
  /** Trailing unit rendered with the number (e.g. "%"). */
  suffix?: string;
  /** Render large counters compactly (1.4K, 2.1M). */
  compact?: boolean;
  jitter?: number;
  accumulate?: boolean;
  period?: number;
  /** Clamp so live updates never show absurd values (e.g. -1 incidents). */
  min?: number;
  max?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(base);
  // Format props are serializable primitives so this component can stay a
  // Client Component fed from Server Components (functions cannot cross that
  // boundary).
  const render = (n: number) => {
    if (compactNotation) return compact(n);
    if (decimals > 0) return `${n.toFixed(decimals)}${suffix}`;
    return `${Math.round(n)}${suffix}`;
  };

  // Count-up on first paint.
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const duration = 900;
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(base * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setValue(base);
    };
    setValue(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [base, reduced]);

  // Periodic live updates after the count-up settles.
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      // min/max are constant for a given instance, so inlining the clamp here
      // keeps the effect free of changing closure deps.
      const clamp = (n: number) => Math.max(min, Math.min(max, n));
      setValue((current) => {
        if (accumulate) return clamp(current + 1 + Math.floor(Math.random() * 3));
        // Whole-number metrics snap to integers; fractional ones (rates,
        // hours) drift smoothly so the decimal actually moves.
        const raw = (Math.random() * 2 - 1) * jitter;
        const delta = jitter >= 1 ? Math.round(raw) : raw;
        return clamp(base + delta);
      });
    }, period);
    return () => clearInterval(id);
  }, [base, jitter, accumulate, period, reduced, min, max]);

  return <span className="tabular-nums">{render(value)}</span>;
}

/* ------------------------------------------------------------ live sparkline */

/** A sparkline that shifts its window with a fresh point every few seconds. */
export function LiveSpark({
  values,
  color,
  height = 50,
  id,
  area = true,
  period = 2800,
}: {
  values: number[];
  color: string;
  height?: number;
  id: string;
  area?: boolean;
  period?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [series, setSeries] = useState(values);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setSeries((previous) => {
        if (previous.length < 2) return previous;
        const last = previous[previous.length - 1];
        const min = Math.min(...previous);
        const max = Math.max(...previous);
        const range = Math.max(1, max - min);
        const next = Math.min(
          max + range * 0.25,
          Math.max(min - range * 0.25, last + (Math.random() - 0.5) * range * 0.55),
        );
        return [...previous.slice(1), next];
      });
    }, period);
    return () => clearInterval(timer);
  }, [period, reduced]);

  return <Sparkline values={series} color={color} height={height} area={area} id={id} />;
}

/* ------------------------------------------------------------------ clock */

/**
 * Alignment dial whose score ramps up from 0 on mount: the number and the
 * ring sweep together over ~900ms, so the hero metric visibly "comes alive"
 * on every visit. Skipped entirely under reduced motion.
 */
export function LiveDial({
  score,
  size = 196,
  confidence,
}: {
  score: number;
  size?: number;
  confidence?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(reduced ? score : 0);

  useEffect(() => {
    if (reduced) {
      setValue(score);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 950;
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else setValue(score);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score, reduced]);

  return <AlignmentDial score={value} size={size} confidence={confidence} />;
}

/** UTC clock that only starts ticking after mount (SSR-safe). */
export function LiveClock() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setLabel(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{label ?? "--:--:--"} UTC</span>;
}

/* ------------------------------------------------------------- activity feed */

export type FeedEvent = {
  id: string;
  agent: string;
  action: string;
  detail: string;
  result: "allowed" | "restricted" | "blocked";
  ts: number;
};

const TEMPLATES: { action: string; detail: string; result: FeedEvent["result"] }[] = [
  { action: "tool.call", detail: "supplier.search", result: "allowed" },
  { action: "data.access", detail: "crm.accounts", result: "allowed" },
  { action: "network.egress", detail: "api.stripe.com", result: "allowed" },
  { action: "delegate", detail: "peer agent", result: "allowed" },
  { action: "data.access", detail: "hr.salary_bands", result: "restricted" },
  { action: "network.egress", detail: "45.83.211.19", result: "blocked" },
  { action: "tool.call", detail: "ticket.batch_read", result: "allowed" },
  { action: "canary.touch", detail: "payroll_decoy.csv", result: "blocked" },
  { action: "data.access", detail: "finance.gl_entries", result: "allowed" },
];

let syntheticSeq = 0;

function makeSynthetic(agents: string[]): FeedEvent {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const agent = agents.length
    ? agents[Math.floor(Math.random() * agents.length)]
    : "Procurement Atlas";
  syntheticSeq += 1;
  return {
    id: `live-${syntheticSeq}`,
    agent,
    action: template.action,
    detail: template.detail,
    result: template.result,
    ts: Date.now(),
  };
}

/**
 * Streaming activity list: new events prepend with a fade-in, relative times
 * tick every second, and older rows fall off the bottom.
 */
export function LiveFeed({
  seed,
  agents,
  max = 6,
  period = 2600,
  dense = false,
  onlyResults,
  slim = false,
}: {
  seed: FeedEvent[];
  agents: string[];
  max?: number;
  period?: number;
  dense?: boolean;
  /** Restrict this feed (and its synthetic events) to certain outcomes. */
  onlyResults?: FeedEvent["result"][];
  /** Narrow-card layout: drop the outcome chip, keep dot + agent + detail + age. */
  slim?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [events, setEvents] = useState<FeedEvent[]>(seed);
  // null until mounted: SSR and first client render both show "…" so there is
  // no hydration mismatch when the ticking clock starts.
  const [now, setNow] = useState<number | null>(null);

  // Relative times tick once a second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, []);

  // Stream new events (optionally filtered to restricted/blocked outcomes).
  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setEvents((previous) => {
          let next = makeSynthetic(agents);
          let guard = 0;
          while (onlyResults && !onlyResults.includes(next.result) && guard < 6) {
            next = makeSynthetic(agents);
            guard += 1;
          }
          return [next, ...previous].slice(0, max);
        });
        schedule();
      }, period + Math.random() * 900);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [agents, max, period, reduced, onlyResults]);

  const rowPadding = dense ? "py-1.5" : "py-2.5";
  const visible = events
    .filter((event) => !onlyResults || onlyResults.includes(event.result))
    .slice(0, max);

  return (
    <ul className="divide-y divide-[var(--line)]">
      {visible.map((event) => {
        const style = RESULT_STYLE[event.result];
        return (
          <li
            key={event.id}
            className={`animate-in flex items-center gap-2.5 ${rowPadding}`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: style.color }}
              aria-hidden
            />
            <span className="shrink-0 text-[11.5px] font-medium text-[var(--text)]">
              {event.agent}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]">
              {event.action} · {event.detail}
            </span>
            {slim ? null : (
              <span
                className="shrink-0 rounded-full border px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em]"
                style={{ color: style.color, background: style.bg, borderColor: style.color }}
              >
                {style.label}
              </span>
            )}
            <span className="w-14 shrink-0 text-right text-[9.5px] text-[var(--muted-dim)] tabular-nums">
              {now === null ? "…" : relativeTime(event.ts, now)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------- training panel */

/**
 * Baseline model training loop: epochs advance, loss falls, the bar fills,
 * the finished model publishes, then a new version starts. Doubles as the
 * page's "the system is working right now" signal.
 */
export function TrainingPanel() {
  const reduced = usePrefersReducedMotion();
  const TOTAL_EPOCHS = 24;
  const [version, setVersion] = useState(41);
  // Single state object keeps every rendered number deterministic at hydration
  // time; randomness only ever enters through the interval below.
  const [run, setRun] = useState({ progress: 46, loss: 0.184, throughput: 8.4 });
  const { progress, loss, throughput } = run;
  // Rolling loss curve so the panel shows the model converging, not just a bar.
  const [lossSeries, setLossSeries] = useState<number[]>([
    0.41, 0.36, 0.32, 0.29, 0.26, 0.24, 0.22, 0.2, 0.19, 0.184,
  ]);

  const training = progress < 100;
  const epoch = Math.max(1, Math.round((progress / 100) * TOTAL_EPOCHS));
  const dataset = (1.24 + (progress / 100) * 0.06).toFixed(2);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setRun((current) => {
        const next = Math.min(100, current.progress + 5 + Math.random() * 4);
        const t = next / 100;
        return {
          progress: next,
          loss:
            next >= 100
              ? 0.028
              : 0.42 * Math.pow(1 - t, 2) + 0.028 + Math.random() * 0.006,
          throughput: 7.8 + Math.random() * 1.5,
        };
      });
    }, 620);
    return () => clearInterval(id);
  }, [reduced]);

  // Mirror each settled loss value into the curve (deduped so StrictMode's
  // double-invoked effects don't append twice).
  useEffect(() => {
    setLossSeries((series) =>
      series[series.length - 1] === run.loss ? series : [...series.slice(-11), run.loss],
    );
  }, [run.loss]);

  // Publish, pause, then start the next version.
  useEffect(() => {
    if (reduced || training) return;
    const id = setTimeout(() => {
      setVersion((current) => current + 1);
      setRun({ progress: 0, loss: 0.448, throughput: 7.9 });
    }, 4000);
    return () => clearTimeout(id);
  }, [training, reduced]);

  return (
    <div className="flex flex-1 flex-col px-6 pb-5">
      <div className="flex items-center justify-between gap-2">
        <span className="chip chip-lime">
          <span className="live-dot" /> {training ? "Training" : "Published"}
        </span>
        <span className="metric-sm text-[11px] text-[var(--muted)]">
          role-drift-v{version}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[10.5px] text-[var(--muted)]">
          <span>
            Epoch <span className="metric-sm text-[var(--text)]">{training ? epoch : TOTAL_EPOCHS}</span> / {TOTAL_EPOCHS}
          </span>
          <span>
            Loss{" "}
            <span className="metric-sm text-[var(--lime)]">{loss.toFixed(3)}</span>
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <span
            className="block h-full rounded-full bg-[var(--lime)] transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Throughput", value: `${throughput.toFixed(1)}k ev/s` },
          { label: "Dataset", value: `${dataset}M rows` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2"
          >
            <dd className="metric-sm text-[13px] font-semibold tabular-nums">{item.value}</dd>
            <dt className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[9px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
          <span>Loss curve</span>
          <span>epoch {training ? epoch : TOTAL_EPOCHS}</span>
        </div>
        <div className="mt-1.5">
          <LiveSpark values={lossSeries} color="var(--lime)" height={54} id={`loss-${version}`} />
        </div>
      </div>

      <p className="mt-auto pt-4 text-[10px] leading-relaxed text-[var(--muted-dim)]">
        {training
          ? "Rolling baseline retraining on the last 7 days of scoped telemetry."
          : `v${version} promoted · live scoring now uses this baseline.`}
      </p>
    </div>
  );
}
