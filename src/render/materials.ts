import { BufferGeometry, DataTexture, LinearFilter, LineBasicMaterial, LineSegments, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, Vector3 } from 'three';

export function standard(color: number, roughness = 0.65, emissive = 0, intensity = 0): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: intensity });
  // Match self-emitted light to the spatial rainbow, instead of applying one
  // uniform hue to every vertex or relying on scene illumination.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_COLOR
  totalEmissiveRadiance *= vColor.rgb;
#endif`);
  };
  material.customProgramCacheKey = () => 'takkeu-vertex-emission-v1';
  material.userData.baseColor = material.color.clone();
  material.userData.baseEmissive = material.emissive.clone();
  material.userData.baseIntensity = intensity;
  return material;
}

export function lineMaterial(color: number, opacity = 1): LineBasicMaterial {
  const material = new LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  material.userData.baseColor = material.color.clone(); material.userData.baseOpacity = opacity;
  return material;
}

export function lines(points: readonly number[][], material: LineBasicMaterial): LineSegments {
  const vertices: Vector3[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const a = new Vector3(...points[i]! as [number, number, number]);
    const b = new Vector3(...points[i + 1]! as [number, number, number]);
    // Keep each straight strand as one line; extra segments only served the
    // animated color decoration and multiplied CPU updates/GPU transfers.
    vertices.push(a, b);
  }
  return new LineSegments(new BufferGeometry().setFromPoints(vertices), material);
}

/** Deterministic wood planks: no image downloads or per-frame texture work. */
export function woodTexture(): DataTexture {
  const size = 256, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const board = Math.floor(y / 32), row = y % 32;
    const grain = 3 * Math.sin(y * 2.8 + 1.4 * Math.sin(x / 33 + board)) + 1.8 * Math.sin(x * 0.21 + y * 8);
    const tone = 5 * Math.sin(board * 12.3) + grain;
    const seam = row === 0 || (x + board * 71) % 256 < 1 ? 0.72 : 1;
    const i = (y * size + x) * 4;
    data[i] = (193 + tone) * seam; data[i + 1] = (137 + tone) * seam; data[i + 2] = (77 + tone) * seam; data[i + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = texture.minFilter = LinearFilter; texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(6, 6); texture.needsUpdate = true;
  return texture;
}

export function shadowTexture(): DataTexture {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = ((x - 31.5) / 29) ** 2 + ((y - 31.5) / 29) ** 2;
    data[(y * size + x) * 4 + 3] = Math.round(150 * Math.exp(-radius * 2.6));
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter; texture.needsUpdate = true;
  return texture;
}

/** One continuous, subtle surface sheen across all four court quadrants. */
export function tableTexture(): DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const sheen = Math.exp(-((u - 0.36) ** 2 / 0.07 + (v - 0.65) ** 2 / 0.16));
    const value = Math.round(163 + 49 * v + 28 * sheen), i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter; texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true; return texture;
}
