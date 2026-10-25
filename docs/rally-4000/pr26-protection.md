# PR26 preservation audit

Baseline: `chameleonjp-lab/takkeu` merge commit `aff31169fd6feaad7bad35f22fe3de26429296cf`. Inspected files directly through the connected GitHub tools; no production files changed.

## Exact comment API for in-play reuse

```ts
import { resultComment } from './resultComments';
const text = resultComment(snapshot.score);
```

`resultComment(score: number): string` is a pure function. It floors finite values and clamps them to zero; non-finite values become zero. It selects the existing 44 Japanese comments by these exact bands:

- 0–49: one comment every 5 rallies.
- 50–199: one comment every 10 rallies.
- 200–1999: one comment every 100 rallies.
- 2000 and above: always `ラリーの神、降臨。` (including 3000 and 4000).

Reuse this function unchanged for an in-play comment. The requested 2000–4000 visual extension must not add or replace result comments. Update a distinct game HUD node through `textContent`, ideally only when the returned text changes. Keep it outside the result section. Do not turn each score/comment change into an assistive-technology announcement.

## Protection checklist

- Preserve `src/ui/resultComments.ts`, `src/ui/resultEffects.ts`, `src/ui/result.css`, `src/ranking/resultPosition.ts` byte-for-byte where possible. Changes in `screens.ts` should be confined to game-only markup, nodes, and rendering calls.
- Keep result DOM/reading order: final score → comment → global registered position → local best → retry/share/home actions → TOP30 table.
- Preserve `screens.render()` result integration: result color/tier datasets, long-number sizing at more than 5 digits, final score text, `resultComment(snapshot.score)` only for the result heading on game over, finalized share URL, phase announcements, focus movement, and `showingFinalEffects` visibility gating.
- Preserve `resultEffectLevel()` thresholds exactly: numeric gold ≥300; rainbow ≥800; green electricity ≥500; blue joins ≥1000; red joins ≥1500. Title tiers remain rising ≥100, gold ≥300, electric ≥500, legend ≥1000, divine ≥2000.
- Preserve result electricity behavior: only visible results own its RAF; maximum 5 bolts, 30fps geometry updates, independent back/front SVG layers, no WebGL. Stop and clear on result hide, preparation, hidden tab, reduced motion, and disposal. Keep result CSS reduced-motion and forced-colors handling.
- Keep all new game styles scoped to game-specific classes/data attributes. Do not broaden selectors or redefine `.result-*`, `result-spectrum`, `result-score-enter`, or `result-title-enter`.
- Keep ranking request/acknowledgement order in `src/app/createApp.ts`: on the first gameover frame, `resultPosition.show(activePlay)` precedes `ranking.finish(..., 'game_over')`. Then clear `activePlay` and refresh TOP30. New in-play visuals must perform no ranking calls.
- Preserve ranking position gating: only the matching play ID and its bound submission ID can unlock a position request after `submitted`; retries without acknowledgement must not read position. Preserve request epochs, stale-response rejection, hidden guest state, excluded/error states, best-score-based position, TOP100 badge, and queue-first retry.
- Preserve `resultPosition.clear()` during start/home and `dispose()` cleanup. Do not derive global rank from TOP30 or pending queue state.

## Risks for the new in-play work

- `createResultEffects` is deliberately result-specific. Reusing its instance or broadening its show condition would animate the protected result subsystem during play. Prefer an independent in-play implementation and separate animation identifiers.
- `screens.render()` runs every application frame. Any new HUD effect should cache unchanged score/band state, cap retained effect geometry, and avoid unconditional DOM creation or layout measurements.
- Result effects and rendering both consume the same snapshot score. Keep any new 0–4000 visual clamping in presentation helpers only; do not clamp/mutate score, snapshots, gameplay progression, ranking submissions, or share URLs.
- Gameover final celebration continues before results appear. New play visuals must honor phase and presentation lifecycle so they clear/freeze correctly through pause, final celebration, retry, home, preparation, hidden tab, and disposal.
- The existing result score animation measures score bounds through `ResizeObserver`; result CSS or DOM changes can alter its appearance even if thresholds remain untouched.

## Existing regression coverage to preserve

`tests/unit/result-comments.test.ts` with `tests/helpers/resultCases.ts` checks both ends of all 44 bands. `result-effects.test.ts` checks threshold colors, bounded geometry, independent layers, a single RAF, hidden/preparing/reduced-motion stopping, and cleanup. `result-layout.test.ts` checks result reading order, rank announcements, TOP100, retry, and guests. `result-position.test.ts` checks acknowledgement gating, submission identity, stale responses, retries, exclusions, and best-based rank; `ranking-position-sql.test.ts` covers aggregate ranking semantics.

Suggested focused regression command once implementation is ready:

```sh
npm run test:unit -- tests/unit/result-comments.test.ts tests/unit/result-effects.test.ts tests/unit/result-layout.test.ts tests/unit/result-position.test.ts tests/unit/ranking-position-sql.test.ts tests/unit/ranking-screens.test.ts
```

No tests were executed for this read-only audit.
