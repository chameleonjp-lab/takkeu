import type { BallSnapshot, GameSnapshot } from '../game/types';
import type { createObjects } from './objects';
export function isBallVisible(ball: BallSnapshot): boolean {
  return ball.phase !== 'lost' && ball.phase !== 'queued' && ball.position.z >= 0;
}
export function applyPresentation(objects: ReturnType<typeof createObjects>, snapshot: GameSnapshot): void {
  objects.opponentCourt.visible = false;
  objects.opponentEdges.visible = false;
  objects.opponentPaddle.visible = false;
  objects.opponentBody.visible = false;
  objects.playerPaddle.position.x = snapshot.paddle.x;
  objects.playerPaddle.position.y = snapshot.paddle.y;
  const ball = snapshot.balls[0];
  objects.ball.visible = !!ball && isBallVisible(ball);
  if (ball) objects.ball.position.set(ball.position.x, ball.position.y, ball.position.z);
}
