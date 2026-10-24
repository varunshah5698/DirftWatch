import { clean, mean, median, normalQuantile, mad, quantile, stdev as stdevOf, mulberry32, seededNormal } from "./core";
import type { Interval } from "./types";

/** Standard z-score. */
export function zScore(x: number, xs: readonly number[]): number {
  const v = clean(xs);
  const s = stdevOf(v);
  if (!s) return 0;
  return (x - mean(v)) / s;
}

/** Robust z-score using median + MAD (Iglewicz & Hoaglin, 0.6745 scaling). */
export function robustZScore(x: number, xs: readonly number[]): number {
  const v = clean(xs);
  if (v.length < 3) return 0;
  const m = median(v);
  let dev = mad(v) / 1.4826;
  if (dev === 0) {
    // MAD collapses for discrete data; fall back to IQR
    dev = (quantile(v, 0.75) - quantile(v, 0.25)) / 1.349;
  }
  if (dev === 0) return 0;
  return (x - m) / dev;
}

/** Mahalanobis distance of a point from the sample mean with a diagonal covariance. */
export function mahalanobisDiagonal(point: readonly number[], matrix: readonly number[][]): number {
  const dims = point.length;
  const cols: number[][] = Array.from({ length: dims }, (_, j) => matrix.map((r) => r[j]));
  let d2 = 0;
  for (let j = 0; j < dims; j++) {
    const s = stdevOf(clean(cols[j])) || 1;
    const m = mean(cols[j]);
    d2 += Math.pow((point[j] - m) / s, 2);
  }
  return Math.sqrt(d2);
}

/**
 * Isolation-forest anomaly score (Liu et al. 2008), deterministic given `seed`.
 * Returns an anomaly score in [0,1]; >0.6 typically indicates an outlier.
 */
export function isolationForest(
  matrix: readonly number[][],
  point: readonly number[],
  opts: { trees?: number; sampleSize?: number; seed?: number } = {},
): number {
  const rows = matrix.length;
  if (rows < 4 || matrix[0].length !== point.length) return 0;
  const trees = opts.trees ?? 48;
  const size = Math.min(opts.sampleSize ?? 128, rows);
  const psi = size;
  const c = (n: number) =>
    n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  const rand = mulberry32(opts.seed ?? 7);
  const depths: number[] = [];
  for (let t = 0; t < trees; t++) {
    const sample: number[][] = [];
    for (let i = 0; i < size; i++) sample.push(matrix[Math.floor(rand() * rows)]);
    depths.push(pathLength(sample, point, 0, c(size), rand));
  }
  const e = mean(depths);
  return Math.pow(2, -e / (c(psi) || 1));
}

function pathLength(data: number[][], x: readonly number[], depth: number, limit: number, rand: () => number): number {
  if (data.length <= 1 || depth >= 12) return depth + limit;
  const dim = x.length;
  let bestDim = 0;
  let bestVar = -1;
  for (let d = 0; d < dim; d++) {
    const vals = data.map((r) => r[d]);
    const v = stdevOf(vals);
    if (v > bestVar) {
      bestVar = v;
      bestDim = d;
    }
  }
  const vals = data.map((r) => r[bestDim]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (hi === lo) return depth + limit;
  const split = lo + rand() * (hi - lo);
  const left = data.filter((r) => r[bestDim] < split);
  const right = data.filter((r) => r[bestDim] >= split);
  if (left.length === 0 || right.length === 0) return depth + limit;
  return x[bestDim] < split
    ? pathLength(left, x, depth + 1, limit, rand)
    : pathLength(right, x, depth + 1, limit, rand);
}

// ---------------------------------------------------------------------------
// confidence intervals
// ---------------------------------------------------------------------------

/** Percentile bootstrap CI of the mean, deterministic seed. */
export function bootstrapCI(
  xs: readonly number[],
  opts: { iterations?: number; level?: number; seed?: number; stat?: (s: readonly number[]) => number } = {},
): Interval {
  const v = clean(xs);
  const level = opts.level ?? 0.95;
  const iterations = opts.iterations ?? 2000;
  if (v.length === 0) return { low: NaN, high: NaN, level, method: "Percentile bootstrap (n=0)" };
  const stat = opts.stat ?? mean;
  const rand = mulberry32(opts.seed ?? 42);
  const boots: number[] = [];
  for (let b = 0; b < iterations; b++) {
    const s: number[] = [];
    for (let i = 0; i < v.length; i++) s.push(v[Math.floor(rand() * v.length)]);
    boots.push(stat(s));
  }
  boots.sort((a, b) => a - b);
  let low = quantile(boots, (1 - level) / 2);
  let high = quantile(boots, 1 - (1 - level) / 2);
  let widened = false;
  if (v.length < 10) {
    // Small samples: widen by half the estimated width (spec 5A: "widens intervals").
    const m = median(v);
    const pad = (high - low) / 2 + (Math.abs(m) * 0.1 || 0.1);
    low -= pad;
    high += pad;
    widened = true;
  }
  return {
    low,
    high,
    level,
    method: `Percentile bootstrap (${iterations} resamples)${widened ? " · widened for n<10" : ""}`,
    widened,
  };
}

/** Wilson score interval for a binomial proportion. */
export function wilsonInterval(successes: number, n: number, level = 0.95): Interval {
  if (n <= 0) return { low: 0, high: 1, level, method: "Wilson score interval (n=0)" };
  const z = normalQuantile(1 - (1 - level) / 2);
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const widened = n < 10;
  const pad = widened ? (half + 0.05) * 1.5 : half;
  return {
    low: Math.max(0, centre - pad),
    high: Math.min(1, centre + pad),
    level,
    method: `Wilson score interval${widened ? " · widened for n<10" : ""}`,
    widened,
  };
}

/** Approximate Poisson rate interval (Garwood exact via chi-square quantile approximation). */
export function poissonRateInterval(count: number, exposure: number, level = 0.95): Interval {
  const alpha = 1 - level;
  const z = normalQuantile(1 - alpha / 2);
  const rate = exposure > 0 ? count / exposure : 0;
  const se = exposure > 0 ? Math.sqrt(count) / exposure : 0;
  return {
    low: Math.max(0, rate - z * se),
    high: rate + z * se,
    level,
    method: "Normal approximation to the Poisson rate (sqrt transform)",
  };
}

export { seededNormal };
