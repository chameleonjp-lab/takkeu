import { BoxGeometry, BufferGeometry, CircleGeometry, CylinderGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { GameConfig } from '../game/types';
import { sampleRainbow } from './rainbow';

export function createObjects(config: GameConfig) {
  const root = new Group();
  const standard = (color: number, emissive = 0, intensity = 0) => {
    const material = new MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.85 });
    material.userData.baseColor = material.color.clone();
    material.userData.baseEmissive = material.emissive.clone();
    material.userData.baseIntensity = intensity;
    return material;
  };
  const lineMaterial = (color: number, opacity = 1) => {
    const material = new LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    material.userData.baseColor = material.color.clone(); material.userData.baseOpacity = opacity;
    return material;
  };
  const lines = (points: readonly number[][], material: LineBasicMaterial): LineSegments => {
    const vertices: Vector3[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const a = new Vector3(...points[i]! as [number, number, number]);
      const b = new Vector3(...points[i + 1]! as [number, number, number]);
      for (let j = 0; j < 16; j++) vertices.push(a.clone().lerp(b, j / 16), a.clone().lerp(b, (j + 1) / 16));
    }
    return new LineSegments(new BufferGeometry().setFromPoints(vertices), material);
  };
  const court = (sign: number) => {
    const group = new Group();
    const face = (half: number) => {
      const mesh = new Mesh(new PlaneGeometry(config.tableHalfWidth, config.tableHalfLength, 16, 24), standard(0x087b45));
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
  const paddle = (color: number) => {
    const group = new Group(), body = new Group();
    const face = new Mesh(new CylinderGeometry(config.paddleRadius, config.paddleRadius, 0.025, 48), standard(color));
    face.rotation.x = Math.PI / 2;
    const rim = new Mesh(new TorusGeometry(config.paddleRadius - 0.005, 0.005, 6, 48), standard(0xffc2a4, 0xff775c, 0.15));
    const handle = new Mesh(new CylinderGeometry(0.035, 0.03, 0.20, 12), standard(0xd8a46a));
    handle.position.y = -config.paddleRadius - 0.08;
    body.add(face, handle); group.add(body, rim);
    return { group, body, rim };
  };
  const self = court(1), opponent = court(-1);
  const playerEdges = edges(1), opponentEdges = edges(-1);
  const courtEdges = new Group(); courtEdges.add(playerEdges, opponentEdges);
  const player = paddle(0xe92e35), other = paddle(0x255bd5);
  player.group.position.z = config.paddleZ;
  other.group.position.set(0, 0.5, -config.paddleZ);
  const opponentBody = new Group(); opponentBody.position.z = -2.22;
  const head = new Mesh(new SphereGeometry(0.12, 12, 8), standard(0x145c66)); head.position.y = 1.02;
  const torso = new Mesh(new CylinderGeometry(0.16, 0.12, 0.40, 12), standard(0x145c66)); torso.position.y = 0.65;
  const opponentArm = new Group(); opponentArm.position.set(0.13, 0.83, 0);
  const arm = new Mesh(new CylinderGeometry(0.045, 0.04, 0.42, 8), standard(0x145c66)); arm.position.set(0.04, -0.17, 0.04); arm.rotation.z = 0.3;
  opponentArm.add(arm); opponentBody.add(head, torso, opponentArm);
  const netPoints: number[][] = [];
  for (let x = -1.08; x <= 1.09; x += 0.12) netPoints.push([x, 0, 0], [x, 0.18, 0]);
  for (const y of [0.06, 0.12, 0.18]) netPoints.push([-1.08, y, 0], [1.08, y, 0]);
  const net = lines(netPoints, lineMaterial(0x263b31, 0.75));
  const netTape = lines([[-1.08, 0.18, 0], [1.08, 0.18, 0]], lineMaterial(0xf1efe3));
  net.add(netTape);
  const base = new Mesh(new BoxGeometry(config.tableHalfWidth * 2 + 0.025, 0.085, config.tableHalfLength * 2 + 0.025), standard(0x26382f));
  base.position.y = config.tableY - 0.05;
  const floor = new Mesh(new PlaneGeometry(24, 24), standard(0xb58b59));
  floor.rotation.x = -Math.PI / 2; floor.position.y = config.tableY - 0.8;
  root.add(base, floor);
  const planks: number[][] = [];
  for (let x = -12; x <= 12; x += 0.6) planks.push([x, config.tableY - 0.797, -12], [x, config.tableY - 0.797, 12]);
  root.add(lines(planks, lineMaterial(0x9a734b, 0.28)));
  for (const x of [-0.8, 0.8]) for (const z of [-1.4, 1.4]) {
    const leg = new Mesh(new BoxGeometry(0.09, 0.7, 0.09), standard(0x26382f));
    leg.position.set(x, config.tableY - 0.44, z); root.add(leg);
  }
  const parts = {
    selfCourtRight: self.right, selfCourtLeft: self.left,
    opponentCourtRight: opponent.right, opponentCourtLeft: opponent.left,
    courtEdges, net, playerRacketBody: player.body, playerRacketEdge: player.rim,
    opponentRacketBody: other.body, opponentRacketEdge: other.rim, opponentBody,
  };
  const balls = new Map<number, { root: Group; core: Mesh<SphereGeometry, MeshStandardMaterial>; glow: Mesh<SphereGeometry, MeshBasicMaterial>; shadow: Mesh<CircleGeometry, MeshBasicMaterial> }>();
  for (let id = 1; id <= config.maxBalls; id++) {
    const group = new Group();
    const core = new Mesh(new SphereGeometry(config.ballRadius, 20, 12), standard(0xfff5a3, 0xffefd0, 0.35));
    // Keep the playable ball readable even when it overlaps the paddle before
    // the bounce. The whole subtree still obeys the ball visibility rules.
    core.material.transparent = true; core.material.depthTest = false; core.material.depthWrite = false; core.renderOrder = 20;
    const geometry = new SphereGeometry(config.ballRadius, 24, 16);
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 3), 3));
    const glow = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.48, depthWrite: false, depthTest: false }));
    glow.renderOrder = 21;
    const shadow = new Mesh(new CircleGeometry(config.ballRadius * 1.2, 20), new MeshBasicMaterial({ color: 0x153827, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    group.add(core, glow, shadow); group.visible = false; root.add(group); balls.set(id, { root: group, core, glow, shadow });
  }
  root.add(self.group, opponent.group, courtEdges, player.group, other.group, opponentBody, net);
  return {
    root, parts, balls, tableY: config.tableY, tableHalfLength: config.tableHalfLength, tableHalfWidth: config.tableHalfWidth,
    playerCourt: self.group, opponentCourt: opponent.group, playerEdges, opponentEdges,
    playerPaddle: player.group, opponentPaddle: other.group, opponentBody, opponentArm, net, rimMaterial: player.rim.material,
    dispose() {
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<MeshStandardMaterial | MeshBasicMaterial | LineBasicMaterial>();
      root.traverse(object => {
        if (object instanceof Mesh || object instanceof LineSegments) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.clear();
    },
  };
}

export function colorBall(glow: Mesh<SphereGeometry, MeshBasicMaterial>, simTime: number): void {
  const colors = glow.geometry.attributes.color!;
  const positions = glow.geometry.attributes.position!;
  for (let i = 0; i < colors.count; i++) {
    const rgb = sampleRainbow(simTime, (positions.getY(i) / glow.geometry.parameters.radius + 1) / 2);
    colors.setXYZ(i, rgb.r, rgb.g, rgb.b);
  }
  colors.needsUpdate = true;
}
