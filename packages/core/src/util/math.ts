/** Small numeric helpers shared by the scoring and simulation engines. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Softmax over raw evidence scores. `temperature` controls how decisive the
 * segmenter is: lower values sharpen the winner, higher values keep the
 * distribution honest when evidence is thin.
 */
export function softmax(scores: number[], temperature = 1): number[] {
  if (scores.length === 0) return [];
  const t = temperature <= 0 ? 1e-6 : temperature;
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (sum === 0 ? 1 / scores.length : e / sum));
}

/** Shannon entropy in bits of a probability distribution. */
export function entropyBits(probabilities: number[]): number {
  let h = 0;
  for (const p of probabilities) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/** Linear interpolation used by the projection models. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Present value of `amount` received `years` from now. */
export function discount(amount: number, rate: number, years: number): number {
  return amount / (1 + rate) ** years;
}
