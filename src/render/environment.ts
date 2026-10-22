import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { GameConfig } from '../game/types';
import { shadowTexture, standard, woodTexture } from './materials';

export function createEnvironment(config: GameConfig): Group {
  const group = new Group(), floorY = config.tableY - 0.8;
  const wood = woodTexture();
  const floorMaterial = standard(0xe2d3c0, 0.65); floorMaterial.map = wood;
  const floor = new Mesh(new PlaneGeometry(18, 18), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY;
  const wallWood = wood.clone(); wallWood.repeat.set(4, 1.2); wallWood.needsUpdate = true;
  const wallMaterial = standard(0xffffff, 0.8, 0x6b4b27, 0.15); wallMaterial.map = wallWood;
  const wall = new Mesh(new BoxGeometry(18, 3.5, 0.1), wallMaterial);
  wall.position.set(0, floorY + 1.75, -6.2);
  const skirting = new Mesh(new BoxGeometry(18, 0.09, 0.05), standard(0x81522e));
  skirting.position.set(0, floorY + 0.045, -6.12);
  const shadow = new Mesh(new PlaneGeometry(3.8, 5.7), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.12, floorY + 0.003, 0.1);
  group.add(floor, wall, skirting, shadow);
  const base = new Mesh(new BoxGeometry(config.tableHalfWidth * 2 + 0.018, 0.075, config.tableHalfLength * 2 + 0.018), standard(0x173b31, 0.48));
  base.position.y = config.tableY - 0.043; group.add(base);
  for (const x of [-0.81, 0.81]) for (const z of [-1.36, 1.36]) {
    const leg = new Mesh(new BoxGeometry(0.075, 0.70, 0.075), standard(0x24332e, 0.42));
    leg.position.set(x, floorY + 0.35, z); group.add(leg);
  }
  for (const z of [-1.36, 1.36]) {
    const brace = new Mesh(new BoxGeometry(1.68, 0.045, 0.045), standard(0x2b3b35, 0.48));
    brace.position.set(0, floorY + 0.35, z); group.add(brace);
  }
  return group;
}
