import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';
export type RpcCall = { rpc: string; body: Record<string, unknown> };
const virtualClocks=new WeakSet<Page>();

/** Real startup includes asynchronous GPU work. Advance only installed test
 * clocks while waiting, so gameplay timing still begins after readiness. */
export async function waitForStart(page:Page):Promise<void>{
  await expect.poll(async()=>{
    const screen=page.locator('[data-loading-screen]');
    const ready=async()=>!await screen.isVisible()&&await page.locator('[data-action="start"]').getAttribute('aria-busy')!=='true';
    if(await ready())return true;
    const error=screen.locator('[role="alert"]');
    if(await error.isVisible())throw new Error(await error.innerText());
    // Stay below the next animation frame: readiness itself must not consume
    // the first opponent stroke before a test can send input or inject a fault.
    if(virtualClocks.has(page))await page.clock.runFor(5);
    return ready();
  },{timeout:30000,intervals:[1,5,10]}).toBe(true);
}

// Browser gameplay must never write to the live ranking database. Page-level
// routes in ranking.spec.ts take precedence when testing specific API behavior.
export const test = base.extend<{ rankingTraffic: RpcCall[] }>({
  page:async({page},use)=>{
    const install=page.clock.install.bind(page.clock);
    page.clock.install=async options=>{await install(options);virtualClocks.add(page);};
    await use(page);
  },
  rankingTraffic: [async ({ context }, use) => {
    const calls: RpcCall[] = [];
    const unexpected: string[] = [];
    await context.route('https://*.supabase.co/**', async route => {
      const request = route.request(), rpc = request.url().split('/').at(-1)!;
      if (request.method() !== 'POST' || !request.url().includes('/rest/v1/rpc/')) {
        unexpected.push(request.url()); await route.abort(); return;
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.push({ rpc, body });
      if (rpc === 'start_takkeu_guest_play_v1') {
        await route.fulfill({ json: { accepted: true, start_id: body.p_start_id,
          play_id: '22222222-2222-4222-8222-222222222222',
          game_slug: body.p_game_slug, client_version: body.p_client_version } });
      } else if (rpc === 'get_best_score_ranking' || rpc === 'get_takkeu_hall_v1') {
        await route.fulfill({ json: [] });
      } else {
        unexpected.push(rpc); await route.abort();
      }
    });
    await use(calls);
    expect(unexpected, 'Explicitly mock any additional ranking API behavior at page level').toEqual([]);
  }, { auto: true }],
});
