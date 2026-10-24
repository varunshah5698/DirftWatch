import { chi2PValue, clean, gammainc, ibeta, kolmogorovP, mean, median, normalQuantile, quantile, stdev, tTwoSidedP } from "./core";
import type { QualityMetrics, STLDecomposition, TestResult } from "./types";

export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  const x = a.slice(0, n);
  const y = b.slice(0, n);
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((x, i) => ({ x, i })).sort((p, q) => p.x - q.x);
  const r = new Array(xs.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].x === idx[i].x) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k].i] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  return pearson(ranks(a.slice(0, n)), ranks(b.slice(0, n)));
}

export function welchT(a: readonly number[], b: readonly number[]): TestResult {
  const x = clean(a);
  const y = clean(b);
  const nx = x.length;
  const ny = y.length;
  if (nx < 2 || ny < 2) {
    return { statistic: NaN, p: NaN, method: "Welch's t-test", significant: false, nA: nx, nB: ny };
  }
  const vx = stdev(x) ** 2;
  const vy = stdev(y) ** 2;
  const t = (mean(x) - mean(y)) / Math.sqrt(vx / nx + vy / ny);
  const dfNum = (vx / nx + vy / ny) ** 2;
  const dfDen = (vx / nx) ** 2 / (nx - 1) + (vy / ny) ** 2 / (ny - 1);
  const df = dfNum / dfDen;
  const p = tTwoSidedP(t, df);
  const sp = Math.sqrt(((nx - 1) * vx + (ny - 1) * vy) / (nx + ny - 2));
  const d = sp > 0 ? (mean(x) - mean(y)) / sp : 0;
  return {
    statistic: t,
    p,
    significant: p < 0.05,
    method: `Welch's t-test (Welch–Satterthwaite df=${df.toFixed(1)})`,
    effect: d,
    effectName: "Cohen's d",
    nA: nx,
    nB: ny,
  };
}

export function mannWhitneyU(a: readonly number[], b: readonly number[]): TestResult {
  const x = clean(a);
  const y = clean(b);
  const nx = x.length;
  const ny = y.length;
  if (nx === 0 || ny === 0) {
    return { statistic: NaN, p: NaN, method: "Mann-Whitney U test", significant: false, nA: nx, nB: ny };
  }
  const all = [...x.map((v) => ({ v, g: 0 })), ...y.map((v) => ({ v, g: 1 }))].sort((p, q) => p.v - q.v);
  const r = ranks(all.map((p) => p.v));
  let rx = 0;
  for (let i = 0; i < all.length; i++) if (all[i].g === 0) rx += r[i];
  const u1 = rx - (nx * (nx + 1)) / 2;
  const u = Math.min(u1, nx * ny - u1);
  const mu = (nx * ny) / 2;
  const sigma = Math.sqrt((nx * ny * (nx + ny + 1)) / 12);
  const z = sigma > 0 ? (u - mu + 0.5) / sigma : 0;
  const p = Math.min(1, 2 * (1 - normalCdf(z)));
  // rank-biserial correlation
  const rb = 1 - (2 * u) / (nx * ny);
  return {
    statistic: u,
    p,
    significant: p < 0.05,
    method: "Mann-Whitney U test (normal approximation with continuity correction)",
    effect: rb,
    effectName: "Rank-biserial r",
    nA: nx,
    nB: ny,
  };
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

export function ksTest(a: readonly number[], b: readonly number[]): TestResult {
  const x = clean(a).sort((p, q) => p - q);
  const y = clean(b).sort((p, q) => p - q);
  if (x.length === 0 || y.length === 0) {
    return { statistic: NaN, p: NaN, method: "Kolmogorov-Smirnov test", significant: false, nA: x.length, nB: y.length };
  }
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < x.length && j < y.length) {
    if (x[i] <= y[j]) i++;
    else j++;
    d = Math.max(d, Math.abs(i / x.length - j / y.length));
  }
  d = Math.max(d, Math.abs(1 - Math.min(i / x.length, j / y.length)));
  const ne = (x.length * y.length) / (x.length + y.length);
  const p = kolmogorovP(d, ne);
  return {
    statistic: d,
    p,
    significant: p < 0.05,
    method: "Two-sample Kolmogorov-Smirnov test (asymptotic)",
    nA: x.length,
    nB: y.length,
  };
}

/** Chi-square test of independence on a contingency table + Cramér's V. */
export function chiSquareIndependence(table: number[][]): TestResult & { cramersV: number; df: number } {
  const rows = table.filter((r) => r.length > 0);
  const nR = rows.length;
  const nC = rows[0]?.length ?? 0;
  if (nR < 2 || nC < 2) {
    return { statistic: NaN, p: NaN, method: "Chi-square test of independence", significant: false, nA: 0, nB: 0, cramersV: 0, df: 0 };
  }
  const rowSums = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: nC }, (_, c) => rows.reduce((a, r) => a + r[c], 0));
  const total = rowSums.reduce((a, b) => a + b, 0);
  let chi = 0;
  let minExpected = Infinity;
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      const e = (rowSums[r] * colSums[c]) / total;
      if (e > 0) minExpected = Math.min(minExpected, e);
      if (e > 0) chi += (rows[r][c] - e) ** 2 / e;
    }
  }
  const df = (nR - 1) * (nC - 1);
  const p = chi2PValue(chi, df);
  const v = Math.sqrt(chi / (total * Math.min(nR - 1, nC - 1)));
  return {
    statistic: chi,
    p,
    significant: p < 0.05,
    method: `Chi-square test of independence (df=${df})${minExpected < 5 ? ", expected counts <5 — interpret cautiously" : ""}`,
    effect: v,
    effectName: "Cramér's V",
    cramersV: v,
    df,
    nA: total,
    nB: 0,
  };
}

/** Two-proportion z-test (used by capsule compare bars). */
export function twoProportionZ(x1: number, n1: number, x2: number, n2: number): TestResult {
  if (n1 === 0 || n2 === 0) {
    return { statistic: NaN, p: NaN, method: "Two-proportion z-test", significant: false, nA: n1, nB: n2 };
  }
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  const z = se > 0 ? (p1 - p2) / se : 0;
  const pval = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  return {
    statistic: z,
    p: pval,
    significant: pval < 0.05,
    method: "Two-proportion z-test (pooled)",
    effect: p1 - p2,
    effectName: "Risk difference",
    nA: n1,
    nB: n2,
  };
}

/**
 * STL-style seasonal-trend decomposition (Loess is approximated with centred moving
 * averages, which is exact for integer periods and adequate for activity rhythms).
 */
export function stl(xs: readonly number[], period: number, iterations = 2): STLDecomposition {
  const v = clean(xs);
  const n = v.length;
  if (n < period * 2) {
    return { trend: v.slice(), seasonal: v.map(() => 0), residual: v.map(() => 0), period, seasonalStrength: 0, trendStrength: 0 };
  }
  let trend = movingAverage(v, period);
  let seasonal = new Array(n).fill(0);
  let residual = v.map((x, i) => x - trend[i]);
  for (let it = 0; it < iterations; it++) {
    const seasonalMeans = new Array(period).fill(0);
    const counts = new Array(period).fill(0);
    for (let i = 0; i < n; i++) {
      seasonalMeans[i % period] += v[i] - trend[i];
      counts[i % period]++;
    }
    const raw = seasonalMeans.map((s, k) => s / (counts[k] || 1));
    const offset = mean(raw);
    const pattern = raw.map((s) => s - offset);
    seasonal = Array.from({ length: n }, (_, i) => pattern[i % period]);
    trend = movingAverage(v.map((x, i) => x - seasonal[i]), period);
    residual = v.map((x, i) => x - trend[i] - seasonal[i]);
  }
  const varR = varianceSafe(residual);
  const varTR = varianceSafe(v.map((x, i) => x - trend[i]));
  return {
    trend,
    seasonal,
    residual,
    period,
    seasonalStrength: Math.max(0, 1 - varR / (varTR || 1)),
    trendStrength: Math.max(0, 1 - varR / (varianceSafe(seasonal) + varR || 1)),
  };
}

function varianceSafe(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

function movingAverage(xs: readonly number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return xs.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(xs.length - 1, i + half);
    let acc = 0;
    for (let k = lo; k <= hi; k++) acc += xs[k];
    return acc / (hi - lo + 1);
  });
}

/** Classification quality: confusion matrix, precision/recall/F1, ROC, PR, AUC. */
export function classificationQuality(labels: readonly number[], scores: readonly number[], threshold = 0.5): QualityMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < labels.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (labels[i] === 1 && pred === 1) tp++;
    else if (labels[i] === 1) fn++;
    else if (pred === 1) fp++;
    else tn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
  const thresholds = Array.from(new Set(scores)).sort((a, b) => b - a);
  const roc = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  const pr: { recall: number; precision: number; threshold: number }[] = [];
  const P = labels.filter((l) => l === 1).length;
  for (const t of thresholds) {
    let a = 0;
    let b = 0;
    let c = 0;
    for (let i = 0; i < labels.length; i++) {
      const pred = scores[i] >= t;
      if (labels[i] === 1 && pred) a++;
      else if (labels[i] === 1) b++;
      else if (pred) c++;
    }
    const tpr = P > 0 ? a / P : 0;
    const f = c + (labels.length - P - c) > 0 ? c / (labels.length - P) : 0;
    roc.push({ fpr: f, tpr, threshold: t });
    pr.push({ recall: tpr, precision: a + c > 0 ? a / (a + c) : 1, threshold: t });
  }
  roc.push({ fpr: 1, tpr: 1, threshold: -Infinity });
  const auc = trapezoidArea(roc.map((r) => r.fpr), roc.map((r) => r.tpr));
  const prAuc = trapezoidArea(
    pr.map((r) => r.recall).reverse(),
    pr.map((r) => r.precision).reverse(),
  );
  return { tp, fp, tn, fn, precision, recall, f1, fpr, roc, auc, pr, prAuc };
}

function trapezoidArea(x: readonly number[], y: readonly number[]): number {
  let area = 0;
  for (let i = 1; i < x.length; i++) area += ((x[i] - x[i - 1]) * (y[i] + y[i - 1])) / 2;
  return Math.abs(area);
}

export { median, quantile, stdev, gammainc, ibeta };
