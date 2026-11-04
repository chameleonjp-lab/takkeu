# Browser verification follow-up

Baseline: main `f02db46c83b7d7e5196279d3668cc23218e8cc07`, after PR #37.
The existing [CI run 41629313815](https://github.com/chameleonjp-lab/takkeu/actions/runs/41629313815) passed its core job but failed all four browser jobs. This candidate has not been run in CI or a browser.

## Evidence and bounded changes

- Both interaction projects reported 18 white-text assertions: the share anchors inherited the higher-specificity `.home-footer a` color. The explicit anchor selectors now tie that specificity and win by later source order. Black background and all layout declarations are unchanged. This is a product CSS correction, not a relaxed test expectation.
- Both interaction projects reported 14 non-Japanese share-text assertions. The localized prose was followed by the required fixed `#タッケウ #ゲーム制作` suffix. The test now requires that exact suffix and checks the remaining prose for untranslated kana. Production share text is unchanged.
- WebKit reported seven certificate-related `route.fetch(blob:)` errors. Already-validated loopback blob reads now continue inside the browser instead of passing through the HTTP request client. Unknown origins, writes and HTTP redirects remain rejected.
- The simulated insecure LAN test reported one additional blocked blob read. Its page-local handler permits only read-only `blob:http://device-lan.invalid/...`; the existing HTTP fixture still rewrites requests to loopback and rejects redirects.
- Both interaction projects reported two Vite socket console failures, and both load projects reported one. The expected exact-origin, root-path `vite-hmr` socket is now fully mocked without an upstream connection. Unknown sockets are still reported and closed. The simulated LAN test uses the same helper with its explicit fake origin. Ordinary Vite and Playwright server configuration remains unchanged.

The socket approach follows [Playwright's documented mocked WebSocket behavior](https://playwright.dev/docs/api/class-websocketroute): without `connectToServer()`, routing opens a mocked socket in the page. The installed Vite 8.3.5 client was inspected as text; setting `hmr:false` alone does not prevent its transport initialization, so that approach was not retained. No console-error assertion was removed or filtered.

## Local verification and limits

`node tests/offline/browser-boundary-regression.cjs`

Nine focused builtin-Node checks cover the actual routing helpers with inert routes/sockets, denied origins and writes, redirects, the fixture-local LAN handlers, the exact share-text assertion block, and static CSS selector requirements. The script strips TypeScript with Node's builtin API; it does not import Playwright, Vite or the application. It emits Node's experimental API warning. The CSS, loopback blob, LAN blob and share-prose cases were observed failing before their respective changes. A discarded HMR configuration-value check also failed initially, but its later pass was not evidence of transport behavior; independent source review rejected that approach. The two replacement socket checks independently failed before the retained socket fix. The final nine checks also passed an independent execution after full closure review.

These checks do not establish real browser routing, computed CSS, popup/layout behavior, GPU performance, or a green CI run. The previous certificate `[0,0]` and test-ended errors occurred alongside routing exceptions; no separate certificate application fix is claimed. Image-load timing may still need investigation after a permitted browser rerun. No game, scoring, ranking, storage, localization catalog, workflow, package, build or deployment logic is changed. The new offline script is not automatically added to CI by this candidate.
