import { BoxGeometry, BufferGeometry, CylinderGeometry, Group, LineSegments, Mesh, PlaneGeometry, SphereGeometry, Texture } from 'three';
import type { GameConfig } from '../game/types';
import { createBallPool } from './balls';
import { lineMaterial, lines, standard, tableTexture } from './materials';
import { createPaddle, RUBBER_FACE_DEPTH } from './paddle';
import { createEnvironment } from './environment';
import { createOpponentField } from './field';
import type { Material } from 'three';

export function createObjects(config: GameConfig) {
  const root = new Group();
  const surface = tableTexture();
  const court = (sign: number) => {
    const group = new Group();
    const face = (half: number) => {
      const geometry = new PlaneGeometry(config.tableHalfWidth, config.tableHalfLength, 16, 24);
      const uv = geometry.attributes.uv!;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2 + (half + 1) / 4, -uv.getY(i) / 2 + (sign + 3) / 4);
      const material = standard(0x008a34, 0.38); material.map = surface;
      const mesh = new Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(half * config.tableHalfWidth / 2, config.tableY, sign * config.tableHalfLength / 2);
      group.add(mesh); return mesh;
    };
    const left = face(-1), right = face(1);
    return { group, left, right };
  };
  const edges = (sign: number) => {
    const x = config.tableHalfWidth, z = sign * config.tableHalfLength, y = config.tableY + 0.004;
    const group = new Group();
    for (const [width, depth, px, pz] of [[0.025, Math.abs(z), -x, z / 2], [0.025, Math.abs(z), x, z / 2], [2 * x, 0.025, 0, z], [0.015, Math.abs(z), 0, z / 2]]) {
      const stripe = new Mesh(new PlaneGeometry(width, depth, 8, 16), standard(0xf4f5e8));
      stripe.rotation.x = -Math.PI / 2; stripe.position.set(px!, y, pz!); group.add(stripe);
    }
    return group;
  };
  const self = court(1), opponent = court(-1);
  const playerEdges = edges(1), opponentEdges = edges(-1);
  const courtEdges = new Group(); courtEdges.add(playerEdges, opponentEdges);
  const player = createPaddle(config, 0xef252e, -0.56), other = createPaddle(config, 0x285be4, -0.22);
  player.group.position.z = config.paddleZ;
  // The flight endpoint is the ball's centre; put the rubber behind its
  // surface so the returning/waiting ball never sits inside the blade.
  other.group.position.set(0, 0.5, -config.paddleZ - config.ballRadius - RUBBER_FACE_DEPTH);
  const opponentBody = new Group(); opponentBody.position.z = -2.22; opponentBody.scale.setScalar(0.6);
  const head = new Mesh(new SphereGeometry(0.12, 12, 8), standard(0x145c66)); head.position.y = 1.02;
  const torso = new Mesh(new CylinderGeometry(0.16, 0.12, 0.40, 12), standard(0x145c66)); torso.position.y = 0.65;
  const opponentArm = new Group(); opponentArm.position.set(0.13, 0.83, 0);
  const arm = new Mesh(new CylinderGeometry(0.045, 0.04, 0.42, 8), standard(0x145c66)); arm.position.set(0.04, -0.17, 0.04); arm.rotation.z = 0.3;
  opponentArm.add(arm); opponentBody.add(head, torso, opponentArm);
  const netPoints: number[][] = [];
  for (let x = -1.08; x <= 1.09; x += 0.045) netPoints.push([x, 0, 0], [x, 0.18, 0]);
  for (const y of [0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175]) netPoints.push([-1.08, y, 0], [1.08, y, 0]);
  const net = lines(netPoints, lineMaterial(0x242c28, 0.7));
  const netTape = lines([[-1.08, 0.18, 0], [1.08, 0.18, 0]], lineMaterial(0xf1efe3));
  net.add(netTape);
  for (const x of [-1.09, 1.09]) {
    const post = new Mesh(new CylinderGeometry(0.011, 0.014, 0.21, 8), standard(0x3b3a31, 0.4));
    post.position.set(x, 0.085, 0); net.add(post);
    const clamp = new Mesh(new BoxGeometry(0.07, 0.04, 0.08), standard(0x4a4b42, 0.4));
    clamp.position.set(x, -0.012, 0); net.add(clamp);
  }
  const environment = createEnvironment(config); root.add(environment.root);
  const opponentField=createOpponentField(config);root.add(opponentField.root);
  const parts = {
    selfCourtRight: self.right, selfCourtLeft: self.left,
    opponentCourtRight: opponent.right, opponentCourtLeft: opponent.left,
    selfFloor: environment.selfFloor, opponentFloor: environment.opponentFloor, opponentWall: environment.opponentWall, structure:environment.structure,
    courtEdges, net, playerRacketBody: player.body, playerRacketEdge: player.rim,
    opponentRacketBody: other.body, opponentRacketEdge: other.rim, opponentBody,
  };
  const pool = createBallPool(config); root.add(pool.root);
  root.add(self.group, opponent.group, courtEdges, player.group, other.group, opponentBody, net);
  return {
    root, parts, opponentField, balls: pool.balls, syncBalls: pool.sync, commitBalls:pool.commit, tableY: config.tableY, tableHalfLength: config.tableHalfLength, tableHalfWidth: config.tableHalfWidth,
    playerCourt: self.group, opponentCourt: opponent.group, playerEdges, opponentEdges,
    playerPaddle: player.group, opponentPaddle: other.group, opponentBody, opponentArm, net, rimMaterial: player.rim.material,
    dispose() {
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      const textures = new Set<Texture>();
      root.traverse(object => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
          }
        }
      });
      for (const texture of textures) texture.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      pool.clear(); root.clear();
    },
  };
}
