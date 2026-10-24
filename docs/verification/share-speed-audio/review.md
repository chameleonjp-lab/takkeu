# Independent review

Review performed read-only on frozen product/test diff from base `27ebee8fb5fa0d29f7f82e15244dd1fbd1a88de1`; same changes committed as `6615e88c1d1c4514536c518d652a0fcfaca80b01`.

Critical: none. Important: none. Minor: none confirmed. Reviewer made no edits, ran diff --check (exit0), and did not run browser tests.

Reviewed share validation/finalization/canonical/link safety, stroke-time count/simultaneous reward/loss/normal acceleration, copied ball contact facts, score-driven stages, voice/pending-source limits, partial construction cleanup, stale unlock/completion callbacks.

Not judged: subjective sound quality, physical-device performance, live X card/cache. Ruling: all remain explicitly unconfirmed, requiring human listening, actual device measurements, or post-publication external observation. Automatic tests/review do not certify them. No defect findings to defer.

Post-review integration fixes: test-only runtimeProbe now counts one WaveShaper per layered voice plus all oscillator/noise sources separately. The original voice limit1 after retry is unchanged; four-source opponent limit added. RED old oscillator count3>1, GREEN both engines retry/home20+20.

CI then found standalone warning RMS0.0098814<=0.01. Reproduced both engines, kept the assertion and all peaks/user gain, extended each rising note decay60→75ms (total159ms), and reran native/offline/warning8cases, unit477 and typecheck before committing9155b19. The author verified this small parameter change; no second independent review claimed. Full integration/real-time measurements use that tuned SHA.
