/** Ordinary sharing remains one native-looking activation; failed popups alone expose copy text. */
export function activateShareLink(event: MouseEvent, link: HTMLAnchorElement, host: Window, copyTitle: string): boolean {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  if (!link.hasAttribute('href') || link.getAttribute('aria-disabled') === 'true' || link.closest('[hidden], [inert]')) return false;
  const intent = new URL(link.href);
  if (intent.origin !== 'https://twitter.com' || intent.pathname !== '/intent/tweet') return false;
  const text = intent.searchParams.get('text') ?? '';
  const separateUrl = intent.searchParams.get('url');
  const copyText = separateUrl ? `${text}\n${separateUrl}` : text;
  event.preventDefault();
  let popup: Window | null = null;
  try {
    // noopener window.open may return null even on success. Obtain only a blank
    // same-origin window reference, then sever the opener before external navigation.
    popup = host.open('about:blank', '_blank');
    if (!popup) throw new Error('Popup unavailable');
    popup.opener = null;
    if (popup.opener !== null) throw new Error('Popup opener not detached');
    const navigation = popup.document.createElement('a');
    navigation.target = '_self';
    navigation.rel = 'noreferrer';
    navigation.referrerPolicy = 'no-referrer';
    navigation.href = intent.href;
    popup.document.body.append(navigation);
    navigation.click();
    navigation.remove();
  } catch {
    try { popup?.close(); } catch { /* Still offer the exact text if closing is unavailable. */ }
    host.prompt(copyTitle, copyText);
  }
  return true;
}
