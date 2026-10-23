// Acceptance data transcribed from the user's progression list, independent of
// the game's milestone registry and presentation resolver.
export const GLOW_SCHEDULE = [
  [70, 'courtEdges'], [100, 'playerRacketEdge'], [130, 'net'],
  [160, 'selfCourtRight'], [190, 'opponentCourtRight'],
  [210, 'selfCourtLeft'], [240, 'opponentCourtLeft'],
  [270, 'playerRacketBody'], [300, 'opponentRacketEdge'],
  [330, 'opponentRacketBody'], [360, 'opponentBody'],
  [380, 'opponentFloor'], [390, 'playerRacketBody'],
  [410, 'selfFloor'], [420, 'opponentWall'], [460, 'structure'],
] as const;
