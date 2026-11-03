import type { BrowserContext, Route, WebSocketRoute } from '@playwright/test';
const localOrigins = new Set(['http://127.0.0.1:4173', 'http://127.0.0.1:4174', 'http://127.0.0.1:4175']);
export async function isolatedStaticRoute(route: Route, unexpected: string[]): Promise<void> {
  const request = route.request(), url = new URL(request.url());
  if (!localOrigins.has(url.origin) || url.username || url.password || !['GET', 'HEAD'].includes(request.method())) {
    unexpected.push('unmocked non-static request'); await route.abort('blockedbyclient'); return;
  }
  // Blob URLs resolve inside this browser context, not through HTTP route.fetch.
  // The same exact origin and read-only method checks above still apply.
  if (url.protocol === 'blob:') { await route.continue(); return; }
  // Fetch only the exact local URL. Never follow a redirect outside the routing boundary.
  const response = await route.fetch({ maxRedirects: 0 });
  if (response.status() >= 300 && response.status() < 400) {
    unexpected.push('local static redirect'); await route.abort('blockedbyclient'); return;
  }
  await route.fulfill({ response });
}
// Route interception itself opens a mocked socket. Never connect it upstream.
// Closing Vite's expected socket instead would create console errors and retries.
export function isolatedHmrSocket(socket: WebSocketRoute, unexpected: string[], origin = 'ws://127.0.0.1:4173'): void {
  const url = new URL(socket.url());
  if (url.origin === origin && url.pathname === '/' && !url.username && !url.password && socket.protocols().includes('vite-hmr')) return;
  unexpected.push('unmocked websocket');
  socket.close();
}
export async function installStaticNetworkBoundary(context: BrowserContext, unexpected: string[]): Promise<void> {
  await context.route('**/*', route => isolatedStaticRoute(route, unexpected));
  await context.routeWebSocket('**/*', socket => isolatedHmrSocket(socket, unexpected));
}
