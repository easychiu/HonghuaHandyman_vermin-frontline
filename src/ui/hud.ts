export interface HudState {
  timeLeft: number;
  score: number;
  kills: number;
  bossActive: boolean;
}

export const defaultHudState: HudState = {
  timeLeft: 0,
  score: 0,
  kills: 0,
  bossActive: false,
};
