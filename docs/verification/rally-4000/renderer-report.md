# Rally renderer implementation and verification

The new renderer is isolated in `src/render/rallyEffects.ts`. It adds overlays to a private table child and a world root. It does not mutate the court, camera, ball state, input mapping, progression, existing loss digits, or the table rig transform. `createView` owns integration and calls `prepare` before scene preparation, `clear` afterwards, and `dispose` before disposing the shared objects.

At the time of this report, geometry/unit verification and type checking have run. Browser captures and their image-content review are a separate workstream; this report does not treat projection tests as proof of rendered-image appearance, motion acceptance, accessibility compliance, or device performance.

## Ownership and data

`update(snapshot, state?, quality, reducedMotion)` uses drawing `simTime`. Omitted state enables only permanent score-based world stages. A snapshot score change cannot manufacture hit rings, arrival effects, losses, or best-record facts. Explicit state is accepted only when its run ID matches the snapshot. Every temporary effect checks its original absolute `at + duration` deadline, including game-over drawing frames. There is no event history inside the renderer.

Repeated draws and paused snapshots at the same time produce identical geometry. Visual hashes use fixed indices and trigonometric arithmetic. Rendering does not call a gameplay random generator or `Math.random`. No Three.js object is constructed in `update`.

When a newer major arrival starts, older arrivals fade over 0.35 seconds. Confirmed score prevents an older longer effect from returning after the newer shorter effect has been pruned, including reconstruction of the view. A final-loss cue has priority over major arrival geometry and cannot restore that geometry after its own cue is pruned. This changes drawing opacity only; the source events and their deadlines remain intact.

`presentationPriority(snapshot, state?)` exports the shared lower-tier opacity budget for the new renderer and the legacy celebration/firework consumers. It smooths from 1 to 0.45 over the first 0.2 seconds of a major arrival, restores over its final 0.3 seconds, and keeps the final-loss background at 0.45 through termination. Permanent bright geometry, hit rings, sparks, and impact clouds use that factor. The dark cosmic backing and dedicated major/final geometry bypass it. The hundredth spark keeps its exact coordinate, geometry and nonzero opacity; existing digits are owned by the legacy consumer and are not included in this budget. This implements the centralized presentation priority contract exposed by the combined-layer worst-case safety investigation, rather than changing the image-analysis threshold.

## Score conditions

| Score | Implemented geometry / owner | Substitution and duration |
| --- | --- | --- |
| 50 | Small racket-position ring from every confirmed hit | 0.3 seconds; precise event coordinate |
| 100 | Traveling light tail completes one full rectangular table-perimeter lap | 1.2 seconds; independent overlay, does not reveal court surfaces |
| 200 | Opposing animated net strands | 1.2 seconds |
| 300 | Gold rays behind HUD score | UI owner; no duplicate world rays |
| 400 | Thin moving background threads | Remain until star world at 2000 |
| 500 | Traveling green perimeter electricity | Integrated into tricolor table channels at 1500 |
| 600 | Green net strands | Integrated into tricolor net channels at 1500 |
| 700 | Large slow halo with ±8% radius breathing | Replaced by multiple halos at 2750 |
| 800 | Rainbow and green edge sparks | 1.5 seconds |
| 900 | Four corner collectors grow and brighten as score approaches 1000 | Stop at 1000 |
| 1000 | Rainbow shockwave, opposing green/blue arcs, permanent green/blue traveling world channels | Arrival 3.5 seconds; permanent channels integrate into tricolor at 1500 |
| 1250 | Horizontal electric meteor with a trailing decay | Four-second repeating motion; replaced at 3250 |
| 1500 | Green/blue/red traveling perimeter channels, intersecting net strands, and background crossings | Distinct widths 0.011/0.016/0.021, periods 3.7/4.9/6.1 seconds, and different tail lengths |
| 1750 | Floor-perimeter wave plus wavefront moving toward the far side | Four-second cycle; integrated into orbit band at 2500 |
| 2000 | Dark backdrop, small stars, large slow deep halo, retained tricolor channels | 2.5-second transition; replaces 400 threads, preserves existing court material |
| 2250 | Expanding side halos | Three-second cycle; replaced at 3500 |
| 2500 | Orbit band, traveling markers, jagged tricolor electricity propagating along the band | Replaces floor-wave layer |
| 2750 | Three breathing background halos with retained tricolor crossings | Replaces single 700 halo |
| 3000 | Electric opening ring, rainbow waves moving into the background, soft ring glow | 3.5 seconds; permanent star/multiple-halo/tricolor world retained |
| 3250 | Meteor swarm and genuine forks off the background tricolor channels | Replaces single meteor; fork-junction geometry tested |
| 3500 | Double table halos and two counter-wound, nonplanar electric strands | Replaces side halos; vertical strand range exceeds 0.24 world units |
| 3750 | Increasing number and opacity of inward background collector strokes | Progresses with score through 3999; stops at 4000 |
| 4000 | Outer tricolor convergence → rainbow ring assembly → rapid expansion → four overlapping fading rings | Four one-second phases; final permanent star, tricolor, halo and orbit world remains at 4001+ |

The dark backdrop is at z = -5.93, ahead of the opaque far wall. Its upper edge extends beyond the tall portrait frustum, and a short lower alpha gradient from y = -0.73 to -0.6 ends above the visible floor/wall seam. Half the stars occupy the landscape horizon at y = -0.45 to 0.3; half are stratified from y = 0.3 to 7 for the portrait upper background. All stars remain at z = -5.1 to -4.88. A large slow halo occupies the upper portrait background and becomes multiple upper halos at 2750, alongside the shallow landscape halos. Tested star rays either remain entirely above the table or cross its plane beyond the far edge. All owned materials retain depth testing and disable depth writes. Existing opaque gameplay objects therefore occlude background overlays.

The initial star-world implementation failed actual image review: its dark rectangle occupied only a 70-pixel horizon strip in the 390×844 capture. Earlier projection tests showed visible stars but did not require the whole upper background to become dark. The correction is recorded in `render-cosmic-coverage-{red,green,typecheck}.log`: 83 focused tests pass, including dark coverage of at least 18/20 sampled upper-background points in both portrait and landscape, stars in three portrait height bands, an upper halo, and unobscured far-floor samples. Fresh image acceptance remains a separate browser-review result.

## Loss conditions

| Condition | Implemented drawing |
| --- | --- |
| Every real loss | Up to 0.5 seconds of small sparks at that loss's copied world coordinate; world-space attachment avoids table-shake offsets |
| Rolling four losses within two seconds | Controller's impact cue adds a stronger local burst; existing celebration system remains the sole table-rig shake writer |
| 10 | Rectangular perimeter shockwave for 1.2 seconds |
| 20 | Rectangular perimeter shockwave for 1.2 seconds |
| 30 | Rectangular perimeter shockwave for 1.2 seconds |
| 40 | Rectangular perimeter shockwave for 1.2 seconds |
| 50 | Large branching bolts from both net ends for 1.2 seconds |
| 55 | Ring grows from the existing special number's grid cell for 0.8 seconds |
| 77 | Ring grows from the existing special number's grid cell for 0.8 seconds |
| 88 | Ring grows from the existing special number's grid cell for 0.8 seconds |
| 90–99 | Persistent warning light on both net posts, independent of the short arrival/audio cue |
| 99 | Gold net-end electricity for 1.2 seconds |
| 100 | Existing lightning spreads outward with an additional tricolor radial finish for two seconds; works in game-over drawing frames |

Number-ring placement reads `celebrationFrame` and derives the same cell width, row count, and centers used by the existing number renderer. It does not change the existing digit mesh, number notices, color schedule, or display duration. Tests cover simultaneous 55/77 placement and preservation of the source celebration data.

Actual worst-case image analysis exposed additive amplification when loss milestones 10/20/30/40 occurred at the same simulation time: four identical outlines each used alpha 0.45, creating total source alpha 1.8 at the same pixels. The renderer now draws a single outline for identical-time wave cues while retaining all four source facts. Different-time outlines share one continuous envelope-normalized opacity budget of at most 0.45. A final-loss cue fades these lower-priority waves over 0.35 seconds without extending their lifetimes. Tests in `render-loss-wave-budget-{red,green,typecheck}.log` show 86 passing focused tests and typecheck exit 0. This is an implementation/geometry result; the follow-up worst-case pixel analysis must determine the resulting safety verdict.

## Fixed resources

| Resource | New renderer bound |
| --- | --- |
| Groups / meshes | 2 / 4 |
| Buffer geometries / materials | 4 / 4 |
| Table core / glow capacity | 4096 / 1024 quads |
| World core / soft-background capacity | 4096 / 1024 quads |
| Total capacity | 10,240 quads, 61,440 vertices |
| Position and RGBA buffer storage | 1,720,320 bytes, excluding Three.js object overhead |
| Textures | 0 |
| Additional draw calls | At most 4 |

Position and color attributes use dynamic update ranges covering only the active vertices. All GPU buffers, materials and scene nodes are created once. `prepare()` places black degenerate triangles in all four batches so the real scene preparation render compiles the RGBA material variants and uploads the buffers without visible pixels. `clear()` removes those draw ranges without a synthetic snapshot. Disposal removes both roots and disposes each owned geometry/material once.

The four-draw bound applies after the measured single-pass optimization. The initial implementation counted four meshes but Three.js submitted eight draws because transparent double-sided materials default to two passes. The approved fix sets `forceSinglePass: true` on only these four unlit flat-batch materials. Controlled peak/middle standard/low comparisons showed zero changed image channels and four fewer actual draws, with unchanged uploads. See [renderer-performance-investigation.md](renderer-performance-investigation.md) for the measurements, caveats and remaining full-matrix/image-review gates.

Low quality reduces segment and point density and retains every effect condition and all three lightning colors. Standard star counts are 160, rising to 240 in the final world; low quality uses 80/120. Reduced motion freezes permanent positions and travel phases, uses static positions for short bursts/rings, and preserves original event deadlines. It does not alter physics or scoring.

## Verification evidence

- `tests/unit/rally-render.test.ts`: 93 focused tests pass after cosmic-background coverage, loss-wave compositing and shared presentation priority corrections. Tests inspect actual buffer positions/colors, full perimeter travel, ring breathing, corner brightness, expiry boundaries, immutable real loss positions, multiple-number layout, portrait/landscape coverage and camera projection, branch junctions, nonplanar strands, smooth movement, opacity priority and total wave budget, pause/reconstruction, quality, fixed buffers, disposal, and a thirty-loss final-world stress case. `render-priority-budget-{red,green,typecheck}.log` records the shared-factor cycle and typecheck result.
- Stage 1 logs: `logs/render-stage1-red.log`, `render-stage1-green.log`, and the review/exact/clear RED/GREEN logs.
- Stage 2 logs: `logs/render-stage2-red.log`, `render-stage2-shapes-{red,green}.log`, `render-stage2-priority-{red,green}.log`, `render-stage2-replay-{red,green}.log`, and `render-stage2-final-green.log` (60 tests at that gate).
- Stage 3 logs: `logs/render-stage3-{red,green}.log`, `render-stage3-priority-{red,green}.log` (80 tests at handoff), and `render-stage3-typecheck.log` (exit 0).
- Full-suite stage-2 run: 907 passing tests and one failing `release-revision.test.ts` environment fixture. The root agent is investigating that sandbox/network-dependent fixture independently.
- Full-suite stage-3 run, under the default restricted network sandbox: 937 passing tests and the same one failing `release-revision.test.ts` fixture; 68 test files passed and one failed. Full output is in `logs/render-stage3-suite.log`. This is a reported failure, not an all-green suite claim.

Observed image content, temporal capture review, dense flash analysis, performance, human audio listening, and physical-device checks must be read from their own evidence reports. They are not certified by the renderer unit tests.
