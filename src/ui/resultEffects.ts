type Color = 'green' | 'blue' | 'red';
type Point = Readonly<{ x: number; y: number }>;
type Bolt = { node: SVGGElement; paths: SVGPathElement[]; points: Point[][]; born: number; life: number };
const ns = 'http://www.w3.org/2000/svg';
const profiles = {
  green: { color: '#6dff98', length: 27, width: 1.2, life: 210, interval: 140, jitter: 5 },
  blue: { color: '#82cfff', length: 45, width: 1.6, life: 300, interval: 240, jitter: 8 },
  red: { color: '#ff667d', length: 38, width: 2.2, life: 340, interval: 330, jitter: 10 },
} as const;

export function resultEffectLevel(score: number) {
  return {
    color: score >= 800 ? 'rainbow' : score >= 300 ? 'gold' : 'normal',
    colors: (score >= 1500 ? ['green', 'blue', 'red'] : score >= 1000 ? ['green', 'blue'] : score >= 500 ? ['green'] : []) as Color[],
    tier: score >= 2000 ? 'divine' : score >= 1000 ? 'legend' : score >= 500 ? 'electric' : score >= 300 ? 'gold' : score >= 100 ? 'rising' : 'normal',
  };
}

/** Two small SVG layers, no WebGL work. Only the visible result owns a RAF. */
export function createResultEffects(host: HTMLElement, scoreNode: HTMLElement) {
  const doc = host.ownerDocument;
  const media = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const layers = (['back', 'front'] as const).map(name => {
    const svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    svg.setAttribute('data-lightning-layer', name); svg.classList.add('result-lightning', `result-lightning-${name}`);
    host.append(svg); return svg;
  });
  let visible = false, disposed = false, score = -1, frame = 0, lastDraw = -Infinity;
  let colors: Color[] = [], bolts: Bolt[] = [], serial = 0;
  let next: Partial<Record<Color, number>> = {};
  let bounds = { width: 320, height: 180, left: 80, top: 35, textWidth: 160, textHeight: 110 };
  const random = (low: number, high: number) => low + Math.random() * (high - low);
  function measure(): void {
    const box = host.getBoundingClientRect(), text = scoreNode.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) bounds = {
      width: box.width, height: box.height, left: text.left - box.left, top: text.top - box.top,
      textWidth: text.width, textHeight: text.height,
    };
    for (const svg of layers) svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  }
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  resize?.observe(host); resize?.observe(scoreNode);
  function stop(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastDraw = -Infinity; next = {};
    bolts = []; layers.forEach(layer => layer.replaceChildren());
  }
  function emit(color: Color, now: number): void {
    if (bolts.length >= 5) return;
    const profile = profiles[color], front = ++serial % 4 === 0;
    // Start near the top/bottom of a digit or the two outside edges. Avoid
    // long foreground strokes across the center of the numeral.
    const { left, top, textWidth: w, textHeight: h } = bounds;
    const edge = Math.floor(random(0, 4));
    const origin = edge < 2 ? { x: left + random(.08, .92) * w, y: top + (edge === 0 ? .14 : .86) * h }
      : { x: left + (edge === 2 ? .03 : .97) * w, y: top + random(.2, .8) * h };
    const angle = (edge === 0 ? -Math.PI / 2 : edge === 1 ? Math.PI / 2 : edge === 2 ? Math.PI : 0) + random(-.55, .55);
    const length = random(.65, 1.15) * profile.length * (front ? .5 : 1);
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const points: Point[] = [origin];
    for (let i = 1; i <= 6; i++) {
      const offset = random(-1, 1) * profile.jitter * (front ? .45 : 1);
      points.push({ x: Math.max(2, Math.min(bounds.width - 2, origin.x + direction.x * length * i / 6 - direction.y * offset)),
        y: Math.max(2, Math.min(bounds.height - 2, origin.y + direction.y * length * i / 6 + direction.x * offset)) });
    }
    const paths = [points];
    if (!front && (color === 'red' || Math.random() < .55)) {
      const joint = points[3]!;
      paths.push([joint, { x: joint.x + direction.x * 6 - direction.y * 8, y: joint.y + direction.y * 6 + direction.x * 8 },
        { x: joint.x + direction.x * length * .5 - direction.y * 12, y: joint.y + direction.y * length * .5 + direction.x * 12 }]);
    }
    const node = doc.createElementNS(ns, 'g');
    node.id = `result-bolt-${serial}`; node.setAttribute('data-bolt', color);
    node.style.color = profile.color;
    const elements = paths.map(() => {
      const path = doc.createElementNS(ns, 'path');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(profile.width * (front ? .55 : 1)));
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
      node.append(path); return path;
    });
    layers[front ? 1 : 0]!.append(node);
    bolts.push({ node, paths: elements, points: paths, born: now, life: profile.life * random(.8, 1.2) });
  }
  function draw(now: number): void {
    frame = 0;
    if (disposed || !visible || doc.hidden || media?.matches || !colors.length) return;
    if (now - lastDraw >= 1000 / 30) {
      lastDraw = now;
      bolts = bolts.filter(bolt => {
        const age = (now - bolt.born) / bolt.life;
        if (age >= 1) { bolt.node.remove(); return false; }
        bolt.node.style.opacity = String(Math.min(1, (1 - age) * 2));
        bolt.points.forEach((points, pathIndex) => {
          const growth = Math.min(1, age / .32), end = growth * (points.length - 1);
          const shape: Point[] = points.slice(0, Math.floor(end) + 1);
          if (end < points.length - 1) {
            const a = points[Math.floor(end)]!, b = points[Math.floor(end) + 1]!, t = end % 1;
            shape.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
          bolt.paths[pathIndex]!.setAttribute('d', shape.map((p, i) => `${i ? 'L' : 'M'}${(p.x + (i ? random(-1.2, 1.2) : 0)).toFixed(1)},${p.y.toFixed(1)}`).join(' '));
        });
        return true;
      });
      for (const color of colors) {
        if (next[color] === undefined) next[color] = now + colors.indexOf(color) * 35;
        if (now >= next[color]!) { emit(color, now); next[color] = now + profiles[color].interval * random(.8, 1.25); }
      }
    }
    frame = requestAnimationFrame(draw);
  }
  function sync(): void {
    stop();
    if (!disposed && visible && !doc.hidden && !media?.matches && colors.length) { measure(); frame = requestAnimationFrame(draw); }
  }
  const preferenceChanged = () => sync();
  media?.addEventListener('change', preferenceChanged);
  doc.addEventListener('visibilitychange', preferenceChanged);
  return {
    update(show: boolean, value: number): void {
      if (disposed || (show === visible && value === score)) return;
      visible = show; score = value; colors = resultEffectLevel(value).colors; sync();
    },
    dispose(): void {
      disposed = true; stop(); resize?.disconnect(); layers.forEach(layer => layer.remove());
      media?.removeEventListener('change', preferenceChanged); doc.removeEventListener('visibilitychange', preferenceChanged);
    },
  };
}
