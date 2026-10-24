import type { InputSample, PaddlePoint } from '../game/types';
import type { InputMapping } from './mapping';
export type { InputMapping } from './mapping';

export type SwipeOptions = {
  mapping: InputMapping;
  onTarget(sample: InputSample): void;
  toSimTime(eventTimestamp: number): number;
  onInterruption(): void;
  canStart?(): boolean;
  beforeInput?(eventTimestamp: number): void;
  onPauseGesture?: (() => void) | undefined;
};
export interface SwipeController { updateMapping(mapping: InputMapping, preserveContact?: boolean): void; cancel(): void; dispose(): void }
type Contact = { id: number; type: string; x: number; y: number; downAt: number; releasedAt: number | null };
type Owner = { contact: Contact; target: PaddlePoint };
type Tap = { first: Contact; second: Contact | null };

export function createSwipeController(element: HTMLElement, options: SwipeOptions): SwipeController {
  const doc = element.ownerDocument;
  let mapping = options.mapping;
  let owner: Owner | null = null;
  let tap: Tap | null = null;
  let revision = 0;
  const contacts = new Map<number, Contact>();
  const finiteEvent = (event: PointerEvent): boolean => Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && Number.isFinite(event.timeStamp);
  const finiteTarget = (target: PaddlePoint | null): target is PaddlePoint => target !== null && Number.isFinite(target.x) && Number.isFinite(target.y);
  const withinCanvas = (event: PointerEvent): boolean => {
    const { left, top, width, height } = mapping.screen;
    return [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0
      && event.clientX >= left && event.clientX <= left + width && event.clientY >= top && event.clientY <= top + height;
  };
  const onSurface = (event: PointerEvent): boolean => event.target instanceof Node && element.contains(event.target)
    && !(event.target instanceof Element && event.target.closest('button, input, select, textarea, a, summary, [role="button"], [contenteditable="true"]'));
  const releaseCapture = (id: number): void => {
    if (element.hasPointerCapture?.(id)) {
      try { element.releasePointerCapture(id); } catch { /* The document listeners also observe release. */ }
    }
  };
  const clear = (): void => {
    const id = owner?.contact.id;
    owner = null; tap = null; contacts.clear(); revision++;
    if (id !== undefined) releaseCapture(id);
  };
  const ready = (): boolean => options.canStart?.() !== false && mapping.isCurrent?.() !== false;
  const prepare = (timestamp: number): boolean => {
    if (!Number.isFinite(timestamp)) return false;
    if (!ready()) { clear(); return false; }
    const before = revision;
    options.beforeInput?.(timestamp);
    // Flushing can pause, replace the mapping, or cancel even before the first down.
    if (before !== revision) return false;
    if (!ready()) { clear(); return false; }
    return true;
  };
  const sample = (target: PaddlePoint, timestamp: number, kind: NonNullable<InputSample['kind']>): boolean => {
    const at = options.toSimTime(timestamp);
    if (!Number.isFinite(at)) return false;
    options.onTarget({ target: { ...target }, at, kind });
    return true;
  };
  const trackDisplacement = (contact: Contact, event: PointerEvent): void => {
    if (tap && Math.hypot(event.clientX - contact.x, event.clientY - contact.y) > 10) tap = null;
  };
  const down = (event: PointerEvent): void => {
    if (contacts.has(event.pointerId) || event.button !== 0 || !finiteEvent(event)) return;
    const type = event.pointerType || 'mouse';
    if (type !== 'mouse' && type !== 'touch' && type !== 'pen') return;
    const contact: Contact = { id: event.pointerId, type, x: event.clientX, y: event.clientY, downAt: event.timeStamp, releasedAt: null };
    if (contacts.size) {
      contacts.set(contact.id, contact);
      if (tap && !tap.second && contacts.size === 2 && type === 'touch' && onSurface(event) && withinCanvas(event)
        && event.timeStamp >= tap.first.downAt && event.timeStamp - tap.first.downAt <= 100) tap.second = contact;
      else tap = null;
      return;
    }
    if (event.isPrimary === false || !onSurface(event) || !withinCanvas(event) || !prepare(event.timeStamp)) return;
    const target = mapping.toWorld(event.clientX, event.clientY);
    if (!finiteTarget(target)) return;
    const next: Owner = { contact, target: { ...target } };
    owner = next; contacts.set(contact.id, contact); tap = type === 'touch' ? { first: contact, second: null } : null;
    if (!sample(next.target, event.timeStamp, 'place')) { clear(); return; }
    if (owner === next) {
      try { element.setPointerCapture(event.pointerId); } catch { /* Continue through document listeners without capture. */ }
    }
    event.preventDefault();
  };
  const move = (event: PointerEvent): void => {
    const contact = contacts.get(event.pointerId);
    if (!contact || !finiteEvent(event)) return;
    if (contact.type !== 'touch' && (event.buttons & 1) === 0) return;
    trackDisplacement(contact, event);
    const active = owner;
    if (!active || active.contact !== contact || !prepare(event.timeStamp) || owner !== active) return;
    const target = mapping.toWorld(event.clientX, event.clientY);
    if (!finiteTarget(target)) return;
    if (sample(target, event.timeStamp, 'move') && owner === active) active.target = { ...target };
    event.preventDefault();
  };
  const up = (event: PointerEvent): void => {
    const contact = contacts.get(event.pointerId);
    if (!contact) return;
    // A malformed release still ends ownership, but cannot add input or trigger pause.
    if (!finiteEvent(event)) { clear(); return; }
    trackDisplacement(contact, event);
    if (!prepare(event.timeStamp) || !contacts.has(contact.id)) return;
    contact.releasedAt = event.timeStamp;
    contacts.delete(contact.id);
    if (owner?.contact === contact) {
      const target = owner.target;
      owner = null; // A normal lostpointercapture must not become an interruption.
      sample(target, event.timeStamp, 'release');
      releaseCapture(contact.id);
    }
    if (!contacts.size) {
      const candidate = tap;
      tap = null;
      if (candidate?.second && candidate.first.releasedAt !== null && candidate.second.releasedAt !== null
        && candidate.first.releasedAt >= candidate.first.downAt && candidate.second.releasedAt >= candidate.second.downAt
        && Math.max(candidate.first.releasedAt, candidate.second.releasedAt) - candidate.first.downAt <= 250 && ready()) options.onPauseGesture?.();
    }
  };
  const interrupted = (event: PointerEvent): void => {
    if (!contacts.has(event.pointerId)) return;
    clear(); options.onInterruption();
  };
  // Document down also tracks extra contacts outside the canvas; they cannot take over.
  doc.addEventListener('pointerdown', down, { passive: false });
  doc.addEventListener('pointermove', move, { passive: false });
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', interrupted);
  element.addEventListener('lostpointercapture', interrupted);
  const contextMenu = (event: Event): void => event.preventDefault();
  element.addEventListener('contextmenu', contextMenu);
  return {
    updateMapping(next, preserveContact = false) {
      if (preserveContact) { tap = null; revision++; }
      else clear();
      mapping = next;
    },
    cancel: clear,
    dispose() {
      clear();
      doc.removeEventListener('pointerdown', down);
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', interrupted);
      element.removeEventListener('lostpointercapture', interrupted);
      element.removeEventListener('contextmenu', contextMenu);
    },
  };
}
