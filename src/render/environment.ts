import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { GameConfig } from '../game/types';
import { shadowTexture, standard, woodTexture } from './materials';

export function createEnvironment(config: GameConfig) {
  const root = new Group(), floorY = config.tableY - 0.8;
  const wood = woodTexture();
  const floor = (sign: number) => {
    const material = standard(0xe2d3c0, 0.65); material.map = wood;
    const mesh = new Mesh(new PlaneGeometry(18, 9, 32, 24), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, floorY, sign * 4.5);
    return mesh;
  };
  const selfFloor = floor(1), opponentFloor = floor(-1), opponentWall = new Group();
  const wallWood = wood.clone(); wallWood.repeat.set(4, 1.2); wallWood.needsUpdate = true;
  const wallMaterial = standard(0xffffff, 0.8, 0x6b4b27, 0.15); wallMaterial.map = wallWood;
  const wall = new Mesh(new BoxGeometry(18, 3.5, 0.1, 48, 24), wallMaterial);
  wall.position.set(0, floorY + 1.75, -6.2);
  const skirting = new Mesh(new BoxGeometry(18, 0.09, 0.05, 48), standard(0x81522e));
  skirting.position.set(0, floorY + 0.045, -6.12); opponentWall.add(wall, skirting);
  // Only the player's half has ordinary underside/legs/shadow. No unlit
  // opponent structure or reflection may reveal the hidden side of the room.
  const shadow = new Mesh(new PlaneGeometry(3.8, 3), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.12, floorY + 0.003, 1.5);
  const base = new Mesh(new BoxGeometry(config.tableHalfWidth * 2 + 0.018, 0.075, config.tableHalfLength), standard(0x173b31, 0.48));
  base.position.set(0, config.tableY - 0.043, config.tableHalfLength / 2);
  root.add(selfFloor, opponentFloor, opponentWall, shadow, base);
  for (const x of [-0.81, 0.81]) {
    const leg = new Mesh(new BoxGeometry(0.075, 0.70, 0.075), standard(0x24332e, 0.42));
    leg.position.set(x, floorY + 0.35, 1.36); root.add(leg);
  }
  const brace = new Mesh(new BoxGeometry(1.68, 0.045, 0.045), standard(0x2b3b35, 0.48));
  brace.position.set(0, floorY + 0.35, 1.36); root.add(brace);
  return { root, selfFloor, opponentFloor, opponentWall };
}
