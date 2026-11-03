import type { BrowserContext, Route } from '@playwright/test';
const localOrigins = new Set(['http://127.0.0.1:4173', 'http://127.0.0.1:4174', 'http://127.0.0.1:4175']);
export async function isolatedStaticRoute(route: Route, unexpected: string[]): Promise<void> {
  const request = route.request(), url = new URL(request.url());
  if (!localOrigins.has(url.origin) || url.username || url.password || !['GET', 'HEAD'].includes(request.method())) {
    unexpected.push('unmocked non-static request'); await route.abort('blockedbyclient'); return;
  }
  // Fetch only the exact local URL. Never follow a redirect outside the routing boundary.
  const response = await route.fetch({ maxRedirects: 0 });
  if (response.status() >= 300 && response.status() < 400) {
    unexpected.push('local static redirect'); await route.abort('blockedbyclient'); return;
  }
  await route.fulfill({ response });
}
export async function installStaticNetworkBoundary(context: BrowserContext, unexpected: string[]): Promise<void> {
  await context.route('**/*', route => isolatedStaticRoute(route, unexpected));
  await context.routeWebSocket('**/*', socket => {
    // Vite HMR is not needed for verification. Close even its local socket.
    const url = new URL(socket.url());
    if (!(url.protocol === 'ws:' && url.hostname === '127.0.0.1' && url.port === '4173')) unexpected.push('unmocked websocket');
    socket.close();
  });
}
