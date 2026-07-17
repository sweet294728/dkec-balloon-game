export const CHARACTERS = {
  d: { displayName: 'D寶', color: '#60a5fa', team: 'dk' },
  k: { displayName: 'K寶', color: '#86efac', team: 'dk' },
  e: { displayName: 'E寶', color: '#facc15', team: 'ec' },
  c: { displayName: 'C寶', color: '#fb7185', team: 'ec' },
};

export const GAME_ASSETS = {
  background: '/assets/game/training-camp-background.png',
  characters: {
    d: {
      select: '/assets/game/character-d-camo-front.png',
      gameplay: '/assets/game/character-d-camo-back.png',
    },
    k: {
      select: '/assets/game/character-k-camo-front.png',
      gameplay: '/assets/game/character-k-camo-back.png',
    },
    e: {
      select: '/assets/game/character-e-camo-front.png',
      gameplay: '/assets/game/character-e-camo-back.png',
    },
    c: {
      select: '/assets/game/character-c-camo-front.png',
      gameplay: '/assets/game/character-c-camo-back.png',
    },
  },
  balloons: '/assets/game/balloon-sprites.png',
  heart: '/assets/game/heart-pickup.png',
  dartBurst: '/assets/game/dart-and-burst-sprites.png',
};

export const ROUND_SECONDS = 60;
export const MAX_HEALTH = 5;
