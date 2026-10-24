/**
 * Shared statistics library — the single implementation used by the backend engine,
 * the seed/simulation pipeline and the UI panels. No chart libraries are used for
 * computation; every number rendered in the product comes from here.
 *
 * Reference: scipy.stats / statsmodels. Unit tests compare against values obtained
 * from those libraries (see analytics/stats/__tests__/reference.test.ts).
 *
 * Design rules:
 *  - Never throw on empty / tiny / non-finite input. Functions return NaN, null or
 *    empty arrays and let callers show a "low sample" state.
 *  - Every p-value and interval carries a `method` label (surfaced in the UI).
 *  - Deterministic: no implicit randomness except in explicitly seeded helpers.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function clean(xs: readonly number[]): number[] {
  return xs.filter((x) => Number.isFinite(x));
}

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function mean(xs: readonly number[]): number {
  const v = clean(xs);
  if (v.length === 0) return NaN;
  return sum(v) / v.length;
}

/** Sample variance (n-1 denominator), matching numpy/scipy default ddof=1. */
export function variance(xs: readonly number[]): number {
  const v = clean(xs);
  if (v.length < 2) return 0;
  const m = mean(v);
  let acc = 0;
  for (const x of v) acc += (x - m) * (x - m);
  return acc / (v.length - 1);
}

export function stdev(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

/** Linear-interpolation quantile (numpy default, "linear" method). */
export function quantile(xs: readonly number[], q: number): number {
  const v = clean(xs).slice().sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  if (v.length === 1) return v[0];
  const pos = (v.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return v[lo];
  return v[lo] + (pos - lo) * (v[hi] - v[lo]);
}

export function medianOfSorted(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median absolute deviation, scaled by 1.4826 so it estimates sigma for normal data
 * (R's `mad`, scipy's median_abs_deviation(scale="normal")).
 */
export function mad(xs: readonly number[]): number {
  const v = clean(xs);
  if (v.length === 0) return NaN;
  const m = median(v);
  return 1.4826 * median(v.map((x) => Math.abs(x - m)));
}

export function iqr(xs: readonly number[]): number {
  return quantile(xs, 0.75) - quantile(xs, 0.25);
}

// ---------------------------------------------------------------------------
// distributions needed internally
// ---------------------------------------------------------------------------

/** Lanczos approximation of ln Γ(x). */
export function lnGamma(x: number): number {
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += g[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

export function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Inverse standard normal CDF (Acklam's algorithm, |rel err| < 1.15e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  let z: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    z = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return z;
}

/** Regularized lower incomplete gamma P(a, x) (Numerical Recipes gammp). */
export function gammainc(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  if (x < a + 1) {
    // series
    let ap = a;
    let del = 1 / a;
    let s = del;
    for (let n = 0; n < 200; n++) {
      ap++;
      del *= x / ap;
      s += del;
      if (Math.abs(del) < Math.abs(s) * 1e-14) break;
    }
    return s * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // continued fraction for Q(a,x)
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Regularized upper incomplete gamma Q(a,x). */
export function gammaq(a: number, x: number): number {
  return 1 - gammainc(a, x);
}

/** Chi-square survival function (upper tail p-value). */
export function chi2Sf(x: number, df: number): number {
  if (df <= 0) return NaN;
  return gammaq(df / 2, x / 2);
}

/** Two-sided p-value for chi-square statistic. */
export function chi2PValue(stat: number, df: number): number {
  return Math.min(1, Math.max(0, chi2Sf(stat, df)));
}

/**
 * Student-t two-sided p-value via regularized incomplete beta.
 * Numerically stable enough for df in [1, 1e6] and t in [-1e3, 1e3].
 */
/** Regularized incomplete beta I_x(a,b). */
export function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta);
  const sym = x > (a + 1) / (a + b + 2);
  if (!sym) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function betacf(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  if (df <= 0) return NaN;
  const x = df / (df + t * t);
  return Math.min(1, ibeta(df / 2, 0.5, x));
}

/** Two-sided p-value for the Kolmogorov distribution. */
export function kolmogorovP(d: number, n: number): number {
  if (n <= 0) return NaN;
  const en = Math.sqrt(n);
  const lambda = (en + 0.12 + 0.11 / en) * d;
  if (lambda < 0.2) return 1;
  let s = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    s += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.min(1, Math.max(0, s));
}

// ---------------------------------------------------------------------------
// seeded RNG (used by bootstrap + seed data, so results are reproducible)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededNormal(rand: () => number) {
  return () => {
    // Box–Muller
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}
