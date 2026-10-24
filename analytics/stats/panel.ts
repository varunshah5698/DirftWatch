import { bootstrapCI, describe } from ".";
import type { Interval, SampleSummary } from "./types";

/**
 * Shared contract for every statistical panel in the product (spec 5A):
 * primary chart data + a statistics strip + a generated interpretation.
 */
export interface StatStripItem {
  label: string;
  value: string;
  /** Method / sample-size note rendered under the value. */
  note?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}

export interface StatPanelModel<TChart> {
  chart: TChart;
  strip: StatStripItem[];
  interpretation: string;
  sample: SampleSummary;
  lowSample: boolean;
}

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 10) return n.toFixed(Math.min(digits, 1));
  return n.toFixed(digits);
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtInterval(i: Interval, digits = 1): string {
  if (!i || !Number.isFinite(i.low)) return "—";
  return `${fmt(i.low, digits)}–${fmt(i.high, digits)}`;
}

/** Standard strip for series panels: mean, median, p95, σ, n + bootstrap CI. */
export function describeStrip(
  xs: readonly number[],
  unit = "",
): { strip: StatStripItem[]; sample: SampleSummary; lowSample: boolean } {
  const s = describe(xs);
  const ci = bootstrapCI(xs);
  const strip: StatStripItem[] = [
    { label: "n", value: String(s.n), note: "samples" },
    { label: "mean", value: `${fmt(s.mean)}${unit}`, note: `95% CI ${fmtInterval(ci)} (bootstrap)` },
    { label: "median", value: `${fmt(s.median)}${unit}`, note: `IQR ${fmt(s.iqr)}` },
    { label: "p95", value: `${fmt(s.p95)}${unit}`, note: `p99 ${fmt(s.p99)}` },
    { label: "σ", value: fmt(s.stdev), note: `min ${fmt(s.min)} / max ${fmt(s.max)}` },
  ];
  return { strip, sample: s, lowSample: s.n < 10 };
}

export function interpretSeries(name: string, xs: readonly number[], unit = ""): string {
  const s = describe(xs);
  if (s.n === 0) return `No observations of ${name} in this window.`;
  if (s.n < 10)
    return `Only ${s.n} observations of ${name}: mean ${fmt(s.mean)}${unit}, range ${fmt(s.min)}–${fmt(s.max)}${unit}. Indicative only — intervals are widened.`;
  return `${name} averages ${fmt(s.mean)}${unit} (median ${fmt(s.median)}${unit}, p95 ${fmt(s.p95)}${unit}) across ${s.n} observations with σ=${fmt(s.stdev)}.`;
}
