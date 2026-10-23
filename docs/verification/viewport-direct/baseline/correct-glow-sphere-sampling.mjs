// The initial capture used the core sphere's tessellation at the outer radius
// for all trajectories. For score555, reproject the actual glow mesh (24x16)
// using the saved world positions and saved camera matrices. No image or world
// sample is changed. The correction log retains old/new minimum margins.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { SphereGeometry, PerspectiveCamera, Vector3 } from 'three';
const directory = new URL('./', import.meta.url);
const changes = [];
for (const name of (await readdir(directory)).filter(name => name.endsWith('.json.gz'))) {
  const url = new URL(name, directory);
  const raw = JSON.parse(gunzipSync(await readFile(url)));
  if (raw.snapshot.score !== 555) continue;
  const camera = new PerspectiveCamera();
  camera.matrixWorld.fromArray(raw.camera.matrixWorld);
  camera.matrixWorldInverse.fromArray(raw.camera.matrixWorldInverse);
  camera.projectionMatrix.fromArray(raw.camera.projectionMatrix);
  const geometry = new SphereGeometry(raw.config.ballRadius, 24, 16);
  const attribute = geometry.attributes.position;
  const points = Array.from({ length: attribute.count }, (_, i) => new Vector3().fromBufferAttribute(attribute, i));
  const vector = new Vector3(), rect = raw.canvas.rect;
  const bounds = position => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, clippedVertexCount = 0;
    const clippedWitnesses = [];
    for (const point of points) {
      vector.copy(point).add(position).project(camera);
      const x = (vector.x + 1) * rect.width / 2, y = (1 - vector.y) * rect.height / 2;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      if (x < -1e-6 || x > rect.width + 1e-6 || y < -1e-6 || y > rect.height + 1e-6 || vector.z < -1 || vector.z > 1) {
        clippedVertexCount++;
        if (clippedWitnesses.length < 12) clippedWitnesses.push({ x, y, viewportX: rect.left + x, viewportY: rect.top + y, ndcZ: vector.z });
      }
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top,
      minimumCanvasMargin: Math.min(left, rect.width - right, top, rect.height - bottom), clippedVertexCount,
      vertexCount: points.length, clippedWitnesses };
  };
  const oldMinimum = raw.trajectorySummary.minimumSphereMargin;
  for (const path of raw.trajectories) {
    path.sphereClipped = 0; path.worstMargin = Infinity;
    for (const sample of path.visibleSamples) {
      const sphere = bounds(sample.position);
      sample.minimumSphereMargin = sphere.minimumCanvasMargin;
      if (sphere.minimumCanvasMargin < 0) path.sphereClipped++;
      if (sphere.minimumCanvasMargin < path.worstMargin) {
        path.worstMargin = sphere.minimumCanvasMargin;
        path.worst = { u: sample.u, position: sample.position, center: sample.center, sphere };
      }
    }
  }
  raw.trajectorySummary.sphereClippedSamples = raw.trajectories.reduce((sum, path) => sum + path.sphereClipped, 0);
  raw.trajectorySummary.minimumSphereMargin = Math.min(...raw.trajectories.map(path => path.worstMargin));
  raw.trajectorySphereMesh = 'glow SphereGeometry(24,16)';
  await writeFile(url, gzipSync(JSON.stringify(raw)));
  changes.push({ id: raw.id, oldMinimum, correctedMinimum: raw.trajectorySummary.minimumSphereMargin, correctedClippedSamples: raw.trajectorySummary.sphereClippedSamples });
  geometry.dispose();
}
const manifestUrl = new URL('manifest.json', directory);
const manifest = JSON.parse(await readFile(manifestUrl));
for (const item of manifest.records) {
  const change = changes.find(change => change.id === item.id);
  if (change) {
    item.trajectorySummary.minimumSphereMargin = change.correctedMinimum;
    item.trajectorySummary.sphereClippedSamples = change.correctedClippedSamples;
  }
}
manifest.metricCorrection = 'Score555 trajectory silhouettes reprojected from original world samples/camera using actual glow mesh tessellation; see correction log and source. Screenshots unchanged.';
await writeFile(manifestUrl, JSON.stringify(manifest, null, 2));
await writeFile(new URL('glow-sphere-sampling-correction.json', directory), JSON.stringify(changes, null, 2));
console.log(JSON.stringify(changes, null, 2));
