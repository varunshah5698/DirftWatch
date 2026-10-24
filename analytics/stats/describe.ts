import type { ECDFPoint, Histogram, SampleSummary } from "./types";
import { clean, mad, mean, median, quantile, stdev, sum, variance } from "./core";

/** Descriptive statistics. n=0 yields NaNs, never throws. */
export function describe(xs: readonly number[]): SampleSummary {
  const v = clean(xs);
  const q1 = quantile(v, 0.25);
  const q3 = quantile(v, 0.75);
  return {
    n: v.length,
    mean: mean(v),
    median: median(v),
    stdev: stdev(v),
    variance: variance(v),
    min: v.length ? Math.min(...v) : NaN,
    max: v.length ? Math.max(...v) : NaN,
    iqr: v.length ? q3 - q1 : NaN,
    q1,
    q3,
    p50: quantile(v, 0.5),
    p90: quantile(v, 0.9),
    p95: quantile(v, 0.95),
    p99: quantile(v, 0.99),
  };
}

export function percentileRank(xs: readonly number[], value: number): number {
  const v = clean(xs);
  if (v.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const x of v) {
    if (x < value) below++;
    else if (x === value) equal++;
  }
  // mid-rank percentile (matches scipy percentileofscore kind="mean")
  return ((below + equal / 2) / v.length) * 100;
}

/** Freedman–Diaconis bin count; falls back to Sturges when IQR is 0. */
export function fdBinCount(xs: readonly number[]): number {
  const v = clean(xs);
  if (v.length < 2) return 1;
  const width = 2 * mad(v) * 0.6745; // 2 * IQR * n^-1/3
  const iqr = quantile(v, 0.75) - quantile(v, 0.25);
  const range = Math.max(...v) - Math.min(...v);
  if (range === 0) return 1;
  const h = iqr > 0 ? (2 * iqr) / Math.cbrt(v.length) : 0;
  if (h <= 0 || width === 0) {
    return Math.max(1, Math.ceil(Math.log2(v.length) + 1));
  }
  return Math.max(1, Math.min(60, Math.ceil(range / h)));
}

export function histogram(xs: readonly number[], binCount?: number): Histogram {
  const v = clean(xs);
  if (v.length === 0) return { bins: [], edges: [], counts: [], binWidth: 0, rule: "fixed" };
  const min = Math.min(...v);
  const max = Math.max(...v);
  const rule: Histogram["rule"] = binCount ? "fixed" : "freedman-diaconis";
  const k = Math.max(1, binCount ?? fdBinCount(v));
  const width = max === min ? 1 : (max - min) / k;
  const edges: number[] = [];
  for (let i = 0; i <= k; i++) edges.push(min + i * width);
  const counts = new Array(k).fill(0);
  for (const x of v) {
    let idx = Math.floor((x - min) / width);
    if (idx >= k) idx = k - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const bins = edges.slice(0, k).map((e, i) => e + width / 2);
  return { bins, edges, counts, binWidth: width, rule };
}

/** Gaussian kernel density estimate evaluated on `points` (or 128 points over range). */
export function kde(xs: readonly number[], bandwidth?: number, points = 128): { x: number[]; y: number[] } {
  const v = clean(xs);
  if (v.length < 2) return { x: [], y: [] };
  const s = stdev(v);
  // Silverman's rule of thumb
  const h = bandwidth ?? Math.max(1e-9, 1.06 * s * Math.pow(v.length, -0.2));
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pad = 3 * h;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < points; i++) {
    const xi = min - pad + ((max - min + 2 * pad) * i) / (points - 1);
    let acc = 0;
    for (const vj of v) {
      const z = (xi - vj) / h;
      acc += Math.exp(-0.5 * z * z);
    }
    x.push(xi);
    y.push(acc / (v.length * h * Math.sqrt(2 * Math.PI)));
  }
  return { x, y };
}

export function ecdf(xs: readonly number[]): ECDFPoint[] {
  const v = clean(xs).sort((a, b) => a - b);
  return v.map((x, i) => ({ x, p: (i + 1) / v.length }));
}

/**
 * Jensen–Shannon divergence between two empirical distributions over shared keys.
 * Returns sqrt(JSD) (a metric, in [0, ln2] -> normalised to [0,1]).
 * Zero-count bins are smoothed with `alpha` (default 0.5) so KL/JSD stay finite.
 */
export function jsDivergence(
  p: Record<string, number> | Map<string, number>,
  q: Record<string, number> | Map<string, number>,
  alpha = 0.5,
): number {
  const keys = new Set<string>();
  const get = (d: typeof p) => (d instanceof Map ? d : new Map(Object.entries(d)));
  const P = get(p);
  const Q = get(q);
  for (const k of P.keys()) keys.add(k);
  for (const k of Q.keys()) keys.add(k);
  if (keys.size === 0) return 0;
  const sumP = sum([...keys].map((k) => P.get(k) ?? 0)) || 1;
  const sumQ = sum([...keys].map((k) => Q.get(k) ?? 0)) || 1;
  let js = 0;
  for (const k of keys) {
    const pi = ((P.get(k) ?? 0) + alpha) / (sumP + alpha * keys.size);
    const qi = ((Q.get(k) ?? 0) + alpha) / (sumQ + alpha * keys.size);
    const mi = (pi + qi) / 2;
    js += 0.5 * pi * Math.log2(pi / mi) + 0.5 * qi * Math.log2(qi / mi);
  }
  return js; // base-2 JSD in [0,1]
}

/** KL divergence D(P||Q) in bits, smoothed. */
export function klDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
  alpha = 0.5,
): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  const sumP = sum([...keys].map((k) => p[k] ?? 0)) || 1;
  const sumQ = sum([...keys].map((k) => q[k] ?? 0)) || 1;
  let kl = 0;
  for (const k of keys) {
    const pi = ((p[k] ?? 0) + alpha) / (sumP + alpha * keys.size);
    const qi = ((q[k] ?? 0) + alpha) / (sumQ + alpha * keys.size);
    kl += pi * Math.log2(pi / qi);
  }
  return Math.max(0, kl);
}

/** 1-D Wasserstein distance (earth mover) between two samples. */
export function wasserstein(a: readonly number[], b: readonly number[]): number {
  const x = clean(a).sort((p, q) => p - q);
  const y = clean(b).sort((p, q) => p - q);
  if (x.length === 0 || y.length === 0) return NaN;
  const all = [...x.map((v) => ({ v, w: 1 / x.length })), ...y.map((v) => ({ v, w: -1 / y.length }))];
  all.sort((p, q) => p.v - q.v);
  let acc = 0;
  let w = 0;
  let prev = all[0].v;
  for (const point of all) {
    acc += Math.abs(w) * (point.v - prev);
    prev = point.v;
    w += point.w;
  }
  return acc;
}
