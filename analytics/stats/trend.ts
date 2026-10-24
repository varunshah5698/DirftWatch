import type { ChangePoint, ControlChart, CusumResult, TrendResult } from "./types";
import { clean, mean, normalPdf, stdev } from "./core";

export function rollingMean(xs: readonly number[], window: number): (number | null)[] {
  const v = clean(xs);
  const out: (number | null)[] = [];
  let acc = 0;
  for (let i = 0; i < v.length; i++) {
    acc += v[i];
    if (i >= window) acc -= v[i - window];
    out.push(i < window - 1 ? null : acc / window);
  }
  return out;
}

export function rollingStdev(xs: readonly number[], window: number): (number | null)[] {
  const v = clean(xs);
  const out: (number | null)[] = [];
  for (let i = 0; i < v.length; i++) {
    if (i < window - 1) {
      out.push(null);
      continue;
    }
    out.push(stdev(v.slice(i - window + 1, i + 1)));
  }
  return out;
}

/** Exponentially weighted moving average (pandas ewm span = 2/alpha - 1). */
export function ewma(xs: readonly number[], alpha = 0.3): number[] {
  const v = clean(xs);
  const out: number[] = [];
  let prev = v.length ? v[0] : NaN;
  for (const x of v) {
    prev = alpha * x + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

/** Mann-Kendall trend test (no ties correction beyond exact tie handling). */
export function mannKendall(xs: readonly number[]): TrendResult {
  const v = clean(xs);
  const n = v.length;
  let s = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += Math.sign(v[j] - v[i]);
  let varS = (n * (n - 1) * (2 * n + 5)) / 18;
  // tie correction
  const counts = new Map<number, number>();
  for (const x of v) counts.set(x, (counts.get(x) ?? 0) + 1);
  for (const t of counts.values()) varS -= (t * (t - 1) * (2 * t + 5)) / 18;
  const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  const p = Number.isFinite(z) ? 2 * (1 - normalCdfAbs(z)) : 1;
  const slope = theilSen(xs);
  return {
    slope,
    mkS: s,
    mkZ: Number.isFinite(z) ? z : 0,
    mkP: p,
    theilSenSlope: slope,
    direction: slope > 0.005 ? "up" : slope < -0.005 ? "down" : "flat",
    significant: p < 0.05,
    method: "Mann-Kendall trend test (two-sided, tie-corrected)",
  };
}

function normalCdfAbs(z: number): number {
  // Abramowitz–Stegun erf approximation (|err| < 1.5e-7)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - normalPdf(z) * poly;
}

/** Theil–Sen robust slope: median of pairwise slopes, using evenly-thinned pairs for speed. */
export function theilSen(xs: readonly number[]): number {
  const v = clean(xs);
  const n = v.length;
  if (n < 2) return 0;
  const slopes: number[] = [];
  const step = n > 400 ? Math.ceil(n / 400) : 1;
  for (let i = 0; i < n; i += step) for (let j = i + 1; j < n; j += step) slopes.push((v[j] - v[i]) / (j - i));
  if (n % 2 === 0) slopes.push(v[n - 1] - v[n - 2]);
  slopes.sort((a, b) => a - b);
  return slopes.length ? slopes[Math.floor(slopes.length / 2)] : 0;
}

/**
 * One-sided CUSUM over a target (mean-centred). Detects sustained upward or downward
 * shifts; the decision interval h is expressed in standard deviations of the input.
 */
export function cusum(xs: readonly number[], opts: { k?: number; h?: number } = {}): CusumResult {
  const v = clean(xs);
  const target = mean(v);
  const sigma = stdev(v) || 1;
  const k = (opts.k ?? 0.5) * sigma;
  const h = (opts.h ?? 4) * sigma;
  const sHigh: number[] = [];
  const sLow: number[] = [];
  const limit: number[] = [];
  const changePoints: ChangePoint[] = [];
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < v.length; i++) {
    hi = Math.max(0, hi + (v[i] - target) - k);
    lo = Math.max(0, lo + (target - v[i]) - k);
    sHigh.push(hi);
    sLow.push(-lo);
    limit.push((hi > -lo ? 1 : -1) * h);
    if ((hi > h || lo > h) && (!changePoints.length || i - changePoints[changePoints.length - 1].index > 2)) {
      const before = v.slice(0, i);
      const after = v.slice(i);
      changePoints.push({
        index: i,
        score: Math.max(hi, lo) / (h || 1),
        meanBefore: mean(before),
        meanAfter: mean(after),
      });
    }
  }
  return { h, k, sHigh, sLow, changePoints, limit };
}

/**
 * Bayesian online change-point detection (Adams & MacKay, hazard 1/lambda).
 * Returns the most probable change-point runs; used to separate legitimate shifts
 * (matching a change event) from unexplained drift.
 */
export function bocpd(xs: readonly number[], opts: { hazard?: number; maxRun?: number } = {}): ChangePoint[] {
  const v = clean(xs);
  const hazard = opts.hazard ?? 1 / 100;
  const maxRun = Math.min(opts.maxRun ?? 120, v.length);
  if (v.length < 5) return [];
  // Normal-Gamma posterior with vague prior; only the most recent maxRun runs are kept.
  let mus = [0];
  let kappas = [0.01];
  let alphas = [0.01];
  let betas = [0.01];
  const runs: number[] = [0];
  const out: ChangePoint[] = [];
  let lastChange = -5;
  for (let t = 0; t < v.length; t++) {
    const preds = mus.map((mu, i) => predictiveStudentT(v[t], mu, kappas[i], alphas[i], betas[i]));
    const growth = preds.map((p, i) => p * (1 - hazard));
    const cpProb = preds.reduce((acc, p) => acc + p, 0) * hazard;
    const total = cpProb + growth.reduce((a, b) => a + b, 0);
    const probs = [(cpProb || 1e-12) / total, ...growth.map((g) => g / total)];
    if (probs.slice(1).reduce((a, b) => a + b, 0) > 0.85 && runs[runs.length - 1] > 8 && t - lastChange > 6) {
      out.push({
        index: t,
        score: probs.slice(1).reduce((a, b) => a + b, 0),
        meanBefore: mean(v.slice(Math.max(0, t - runs[runs.length - 1]), t)),
        meanAfter: mean(v.slice(t, Math.min(v.length, t + 5))),
      });
      lastChange = t;
    }
    // update run lengths / sufficient stats
    const newMus: number[] = [0];
    const newK: number[] = [0.01];
    const newA: number[] = [0.01];
    const newB: number[] = [0.01];
    const newRuns: number[] = [0];
    for (let i = 0; i < mus.length; i++) {
      const w = probs[i + 1];
      if (w < 1e-10) continue;
      const k = kappas[i] + 1;
      const m = (kappas[i] * mus[i] + v[t]) / k;
      const a = alphas[i] + 0.5;
      const b = betas[i] + (kappas[i] * Math.pow(v[t] - mus[i], 2)) / (2 * k);
      newMus.push(m);
      newK.push(k);
      newA.push(a);
      newB.push(b);
      newRuns.push((runs[i] || 0) + 1);
    }
    mus = newMus.slice(-maxRun);
    kappas = newK.slice(-maxRun);
    alphas = newA.slice(-maxRun);
    betas = newB.slice(-maxRun);
    newRuns.slice(-maxRun).forEach((r, i) => (runs[i] = r));
    runs.length = Math.min(runs.length, maxRun);
  }
  return out;
}

function predictiveStudentT(x: number, mu: number, kappa: number, alpha: number, beta: number): number {
  const df = 2 * alpha;
  const scale = Math.sqrt((beta * (kappa + 1)) / (alpha * kappa));
  const z = (x - mu) / scale;
  // unnormalised log density, normalisation constant cancels across runs
  const logpdf = -((df + 1) / 2) * Math.log(1 + (z * z) / df);
  return Math.exp(logpdf);
}

/** Poisson control chart: UCL/LCL from expected λ with a 3-sigma band. */
export function poissonControl(series: readonly number[]): ControlChart {
  const v = clean(series);
  const lambda = mean(v);
  const sd = Math.sqrt(lambda);
  const ucl = lambda + 3 * sd;
  const lcl = Math.max(0, lambda - 3 * sd);
  return {
    center: lambda,
    ucl,
    lcl,
    method: "3-sigma Poisson control chart",
    outOfControl: v.map((x, i) => (x > ucl || x < lcl ? i : -1)).filter((i) => i >= 0),
    values: v,
  };
}
