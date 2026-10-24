/** Method labels are surfaced in the UI next to every interval / test result (spec 5A). */
export type MethodLabel = string;

export interface Interval {
  low: number;
  high: number;
  level: number; // e.g. 0.95
  method: MethodLabel;
  /** True when the sample was too small and the interval was widened by the small-sample rule. */
  widened?: boolean;
}

export interface SampleSummary {
  n: number;
  mean: number;
  median: number;
  stdev: number;
  variance: number;
  min: number;
  max: number;
  iqr: number;
  q1: number;
  q3: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface Histogram {
  bins: number[];
  edges: number[]; // length = bins.length + 1
  counts: number[];
  binWidth: number;
  rule: "freedman-diaconis" | "sturges" | "fixed";
}

export interface ECDFPoint {
  x: number;
  p: number;
}

export interface TrendResult {
  /** Slope of the fitted trend line, per unit of x. */
  slope: number;
  /** Mann-Kendall S statistic. */
  mkS: number;
  mkZ: number;
  mkP: number;
  /** Theil-Sen robust slope estimate (median of pairwise slopes). */
  theilSenSlope: number;
  direction: "up" | "down" | "flat";
  significant: boolean; // p < 0.05, two-sided
  method: MethodLabel;
}

export interface ChangePoint {
  index: number;
  score: number;
  /** Mean before / after the detected change point. */
  meanBefore: number;
  meanAfter: number;
}

export interface CusumResult {
  /** Upper control limit used for the decision interval (in sigma units). */
  h: number;
  k: number;
  sHigh: number[];
  sLow: number[];
  changePoints: ChangePoint[];
  limit: number[]; // +/- h * sigma adapted around 0
}

export interface TestResult {
  statistic: number;
  p: number;
  method: MethodLabel;
  /** Effect size, e.g. Cohen's d or rank-biserial r. */
  effect?: number;
  effectName?: string;
  significant: boolean;
  nA: number;
  nB: number;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
  /** Spearman rank correlation, useful for skewed fleet data. */
  spearman: number;
  n: number;
  // y = intercept + slope * x
}

export interface ControlChart {
  center: number;
  ucl: number;
  lcl: number;
  values: number[];
  outOfControl: number[];
  method: MethodLabel;
}

export interface STLDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  period: number;
  seasonalStrength: number;
  trendStrength: number;
}

export interface QualityMetrics {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  roc: { fpr: number; tpr: number; threshold: number }[];
  auc: number;
  pr: { recall: number; precision: number; threshold: number }[];
  prAuc: number;
}

export interface RankedNode {
  id: string;
  value: number;
  rank: number;
}
