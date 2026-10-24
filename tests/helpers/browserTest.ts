import { test as base, expect } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';
export type RpcCall = { rpc: string; body: Record<string, unknown> };

// Browser gameplay must never write to the live ranking database. Page-level
// routes in ranking.spec.ts take precedence when testing specific API behavior.
export const test = base.extend<{ rankingTraffic: RpcCall[] }>({
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
      } else if (rpc === 'get_best_score_ranking') {
        await route.fulfill({ json: [] });
      } else {
        unexpected.push(rpc); await route.abort();
      }
    });
    await use(calls);
    expect(unexpected, 'Explicitly mock any additional ranking API behavior at page level').toEqual([]);
  }, { auto: true }],
});
