import { SkillType } from '../systems/SkillSystem';

export interface HudState {
  timeLeft: number;
  score: number;
  kills: number;
  scaredHumans: number;
  bossActive: boolean;
  playerHp: number;
  playerMaxHp: number;
  skillUses: Record<SkillType, number>;
}

export const defaultHudState: HudState = {
  timeLeft: 0,
  score: 0,
  kills: 0,
  scaredHumans: 0,
  bossActive: false,
  playerHp: 10,
  playerMaxHp: 10,
  skillUses: { qingZai: 3, shuangZi: 2, hongHui: 1, shiHui: 1, baoYe: 1, anzo: 2 },
};
