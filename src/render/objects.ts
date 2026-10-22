import { BufferGeometry, CylinderGeometry, Group, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { GameConfig } from '../game/types';

export function createObjects(config: GameConfig) {
  const root = new Group();
  const courtMaterial = new MeshStandardMaterial({ color: 0x145c66, roughness: 0.9 });
  const edgeMaterial = new LineBasicMaterial({ color: 0x90d7d6 });
  const netMaterial = new LineBasicMaterial({ color: 0x94c4ca, transparent: true, opacity: 0.55 });
  const ballMaterial = new MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffefd0, emissiveIntensity: 0.35, roughness: 0.6 });
  const paddleMaterial = new MeshStandardMaterial({ color: 0xff775c, roughness: 0.8 });
  const rimMaterial = new MeshStandardMaterial({ color: 0xffc2a4, emissive: 0xff775c, emissiveIntensity: 0.15 });
  const handleMaterial = new MeshStandardMaterial({ color: 0xd8a46a, roughness: 0.9 });
  const lines = (points: readonly number[][], material: LineBasicMaterial): LineSegments => {
    const geometry = new BufferGeometry().setFromPoints(points.map(p => new Vector3(p[0]!, p[1]!, p[2]!)));
    return new LineSegments(geometry, material);
  };
  const court = (sign: number): Group => {
    const group = new Group();
    for (const half of [-1, 1]) {
      const face = new Mesh(new PlaneGeometry(config.tableHalfWidth, config.tableHalfLength), courtMaterial);
      face.name = half < 0 ? 'left-face' : 'right-face';
      face.rotation.x = -Math.PI / 2;
      face.position.set(half * config.tableHalfWidth / 2, config.tableY, sign * config.tableHalfLength / 2);
      group.add(face);
    }
    return group;
  };
  const edges = (sign: number): Group => {
    const x = config.tableHalfWidth;
    const z = sign * config.tableHalfLength;
    const y = config.tableY + 0.004;
    const group = new Group();
    group.add(lines([[-x, y, 0], [-x, y, z], [x, y, 0], [x, y, z], [-x, y, z], [x, y, z], [-x, y, 0], [x, y, 0], [0, y, 0], [0, y, z]], edgeMaterial));
    return group;
  };
  const paddle = (): Group => {
    const group = new Group();
    const face = new Mesh(new CylinderGeometry(config.paddleRadius, config.paddleRadius, 0.025, 48), paddleMaterial);
    face.rotation.x = Math.PI / 2;
    const rim = new Mesh(new TorusGeometry(config.paddleRadius - 0.005, 0.005, 6, 48), rimMaterial);
    const handle = new Mesh(new CylinderGeometry(0.035, 0.03, 0.20, 12), handleMaterial);
    handle.position.y = -config.paddleRadius - 0.08;
    group.add(face, rim, handle);
    return group;
  };
  const playerCourt = court(1);
  const opponentCourt = court(-1);
  const playerEdges = edges(1);
  const opponentEdges = edges(-1);
  const playerPaddle = paddle();
  playerPaddle.position.z = config.paddleZ;
  const opponentPaddle = paddle();
  opponentPaddle.position.set(0, 0.5, -config.paddleZ);
  const opponentBody = new Group();
  const head = new Mesh(new SphereGeometry(0.12, 12, 8), courtMaterial);
  head.position.set(0, 0.9, -2.2);
  opponentBody.add(head);
  const netPoints: number[][] = [];
  for (let x = -1.08; x <= 1.09; x += 0.12) netPoints.push([x, 0, 0], [x, 0.18, 0]);
  for (const y of [0.06, 0.12, 0.18]) netPoints.push([-1.08, y, 0], [1.08, y, 0]);
  const net = lines(netPoints, netMaterial);
  const ball = new Mesh(new SphereGeometry(config.ballRadius, 20, 12), ballMaterial);
  root.add(playerCourt, playerEdges, opponentCourt, opponentEdges, playerPaddle, opponentPaddle, opponentBody, net, ball);
  return {
    root, playerCourt, playerEdges, opponentCourt, opponentEdges, playerPaddle, opponentPaddle, opponentBody, net, ball, rimMaterial,
    dispose() {
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<MeshStandardMaterial | LineBasicMaterial>();
      root.traverse(object => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          geometries.add(object.geometry);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) materials.add(material as MeshStandardMaterial | LineBasicMaterial);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}
