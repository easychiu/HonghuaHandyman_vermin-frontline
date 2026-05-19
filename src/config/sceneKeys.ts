export const SCENE_KEYS = {
  boot: 'BootScene',
  ready: 'ReadyScene',
  mainGame: 'MainGameScene',
  ui: 'UIScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
