import { expect, it } from 'vitest';
import { Material, Mesh, Texture } from 'three';
import { DEFAULT_CONFIG } from '../../src/game/config';
import { createObjects } from '../../src/render/objects';

it('木目と影の描画資源を所有し、全テクスチャを一度ずつ解放する', () => {
  const objects = createObjects(DEFAULT_CONFIG);
  const textures = new Set<Texture>();
  objects.root.traverse(child => {
    if (!(child instanceof Mesh)) return;
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      for (const value of Object.values(material as Material)) if (value instanceof Texture) textures.add(value);
    }
  });
  expect(textures.size).toBeGreaterThanOrEqual(2);
  const disposed = new Map<Texture, number>();
  for (const texture of textures) texture.addEventListener('dispose', () => disposed.set(texture, (disposed.get(texture) ?? 0) + 1));
  objects.dispose();
  expect([...textures].every(texture => disposed.get(texture) === 1)).toBe(true);
  expect(objects.root.children).toHaveLength(0);
});
