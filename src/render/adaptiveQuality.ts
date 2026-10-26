/** Active-render-time policy only. It never reads score, physics, input or audio. */
export const ADAPTIVE_QUALITY = Object.freeze({
  evaluationMs: 3000, downP95Ms: 25, downWindows: 2,
  upP95Ms: 18, stableMs: 20000, cooldownMs: 10000, warmupMs: 1000,
  pressureSpanMs: 3000, recentPressureMs: 1000, maxSampleGapMs: 1500,
  maxLevel: 2, sampleCapacity: 4096,
});

export function createAdaptiveQuality() {
  const policy = ADAPTIVE_QUALITY;
  const samples = new Float64Array(policy.sampleCapacity);
  let level = 0, last: number | null = null, activeMs = 0;
  let warmUntil = policy.warmupMs, lastChange = -Infinity;
  let windowMs = 0, count = 0, badWindows = 0, stableMs = 0;
  let pressureStart: number | null = null, pressureEnd = -Infinity;
  const clearHistory = (): void => {
    windowMs = 0; count = 0; badWindows = 0; stableMs = 0;
    pressureStart = null; pressureEnd = -Infinity; warmUntil = activeMs + policy.warmupMs;
  };
  const suspend = (): void => { last = null; clearHistory(); };
  return {
    level: () => level,
    suspend,
    reset(): void { level = 0; activeMs = 0; lastChange = -Infinity; suspend(); },
    sample(now: number): number | null {
      if (!Number.isFinite(now)) { suspend(); return null; }
      if (last === null) { last = now; return null; }
      const interval = now - last; last = now;
      if (interval <= 0 || interval > policy.maxSampleGapMs) { suspend(); return null; }
      activeMs += interval;
      if (activeMs - interval < warmUntil) return null;
      // A fixed bounded array: only the three-second evaluation sorts it.
      samples[count % samples.length] = interval; count++;
      windowMs += interval;
      if (interval > policy.downP95Ms) {
        pressureStart ??= activeMs; pressureEnd = activeMs;
      }
      if (windowMs < policy.evaluationMs) return null;
      const size = Math.min(count, samples.length);
      const p95 = samples.subarray(0, size).sort()[Math.ceil(size * .95) - 1]!;
      badWindows = p95 > policy.downP95Ms ? badWindows + 1 : 0;
      stableMs = p95 <= policy.upP95Ms ? stableMs + windowMs : 0;
      if (!badWindows) { pressureStart = null; pressureEnd = -Infinity; }
      windowMs = 0; count = 0;
      if (activeMs - lastChange < policy.cooldownMs) return null;
      const sustained = pressureStart !== null && pressureEnd - pressureStart >= policy.pressureSpanMs
        && activeMs - pressureEnd <= policy.recentPressureMs;
      const next = badWindows >= policy.downWindows && sustained ? Math.min(policy.maxLevel, level + 1)
        : stableMs >= policy.stableMs ? Math.max(0, level - 1) : level;
      if (next === level) return null;
      level = next; lastChange = activeMs; clearHistory();
      return level;
    },
  };
}
