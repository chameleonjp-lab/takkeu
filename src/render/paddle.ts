import { CircleGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three';
import type { GameConfig } from '../game/types';
import { standard } from './materials';

export function createPaddle(config: GameConfig, color: number, angle: number) {
  const group = new Group(), body = new Group();
  const wood = new Mesh(new CylinderGeometry(config.paddleRadius, config.paddleRadius, 0.034, 48), standard(0xcba374, 0.58));
  wood.rotation.x = Math.PI / 2;
  const front = new Mesh(new CircleGeometry(config.paddleRadius - 0.004, 48), standard(color, 0.48));
  front.position.z = 0.018;
  const back = new Mesh(new CircleGeometry(config.paddleRadius - 0.004, 48), standard(0x26282a));
  back.rotation.y = Math.PI; back.position.z = -0.018;
  const handle = new Mesh(new CylinderGeometry(0.031, 0.036, 0.22, 12), standard(0xd1a36e, 0.58));
  handle.position.y = -config.paddleRadius - 0.075;
  // The joint lies inside the wooden blade. Keep both sides below the rubber
  // at z=±.018; a round cylinder protruded through the striking surfaces.
  handle.scale.z = 0.45;
  const grip = new Mesh(new CylinderGeometry(0.032, 0.036, 0.12, 12), standard(0xb88951, 0.65));
  grip.position.y = -config.paddleRadius - 0.12;
  grip.scale.z = 0.45;
  body.add(wood, front, back, handle, grip);
  // Rotate within the contact plane. The circular rubber face keeps the same
  // physical contact area while its wooden handle leans like the reference.
  body.rotation.z = angle;
  const rim = new Mesh(new TorusGeometry(config.paddleRadius - 0.001, 0.004, 6, 48), standard(0xe0bc88, 0.55, 0xffa277, 0.06));
  group.add(body, rim);
  return { group, body, rim };
}
