import {
  CHARACTERS,
  MAX_HEALTH,
  ROUND_SECONDS,
} from './config.js';

export const ROUND_MODES = Object.freeze({
  NORMAL: 'normal',
  GOLDEN: 'golden',
});

export const SCORE_GRADES = Object.freeze([
  Object.freeze({ id: 'S', label: '王牌特攻', minimum: 55 }),
  Object.freeze({ id: 'A', label: '精英射手', minimum: 40 }),
  Object.freeze({ id: 'B', label: '優秀隊員', minimum: 25 }),
  Object.freeze({ id: 'C', label: '合格新兵', minimum: 10 }),
  Object.freeze({
    id: 'D',
    label: '再接再厲',
    minimum: Number.NEGATIVE_INFINITY,
  }),
]);

export const GRADE_REWARDS = Object.freeze({
  D: Object.freeze({
    gradeId: 'D',
    amount: 10,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=NVPF9V7Q',
  }),
  C: Object.freeze({
    gradeId: 'C',
    amount: 20,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=U7V5XBWU',
  }),
  B: Object.freeze({
    gradeId: 'B',
    amount: 50,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=CGWDFXPW',
  }),
  A: Object.freeze({
    gradeId: 'A',
    amount: 100,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=9FYCZR38',
  }),
  S: Object.freeze({
    gradeId: 'S',
    amount: 300,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=SVHCDEKK',
  }),
});

export function getScoreGrade(score) {
  return SCORE_GRADES.find((grade) => score >= grade.minimum);
}

export function getScoreProgress(score) {
  const currentGrade = getScoreGrade(score);
  const currentIndex = SCORE_GRADES.indexOf(currentGrade);
  const nextGrade = currentIndex === 0
    ? null
    : SCORE_GRADES[currentIndex - 1];

  return {
    currentGrade,
    nextGrade,
    pointsToNext: nextGrade === null ? 0 : nextGrade.minimum - score,
    isTopGrade: nextGrade === null,
  };
}

export function getGradeReward(gradeId) {
  return GRADE_REWARDS[gradeId] ?? null;
}

export function createRoundState(
  characterId,
  mode = ROUND_MODES.NORMAL,
) {
  return {
    characterId,
    mode,
    score: 0,
    health: MAX_HEALTH,
    remainingSeconds: ROUND_SECONDS,
    correctHits: 0,
    wrongHits: 0,
    balloons: [],
    darts: [],
    effects: [],
  };
}

export function tickRound(state, deltaSeconds) {
  return {
    ...state,
    remainingSeconds: Math.max(0, state.remainingSeconds - deltaSeconds),
    balloons: state.balloons.filter((balloon) => !balloon.escaped),
  };
}

export function shouldEndRound(state) {
  return state.remainingSeconds <= 0 || state.health <= 0;
}

export function getTargetLetters(characterId) {
  return CHARACTERS[characterId].team === 'dk' ? ['e', 'c'] : ['d', 'k'];
}

export function resolveBalloonHit(state, letter) {
  const correct = state.mode === ROUND_MODES.GOLDEN
    || getTargetLetters(state.characterId).includes(letter);

  return {
    score: state.score + (correct ? 1 : -1),
    health: correct ? state.health : Math.max(0, state.health - 1),
    correct,
  };
}

export function resolveHeartHit(state) {
  const healed = state.health < MAX_HEALTH;

  return {
    score: state.score + (healed ? 0 : 1),
    health: healed ? state.health + 1 : MAX_HEALTH,
    healed,
  };
}

export function getDifficulty(elapsedSeconds) {
  if (elapsedSeconds >= 45) {
    return { targetCount: 12, speedMultiplier: 1.3 };
  }

  if (elapsedSeconds >= 20) {
    return { targetCount: 9, speedMultiplier: 1.15 };
  }

  return { targetCount: 6, speedMultiplier: 1 };
}

export function getBalloonSpawnPlan({
  elapsedSeconds,
  remainingSeconds,
  score,
}) {
  const difficulty = getDifficulty(elapsedSeconds);

  if (remainingSeconds > 10) {
    return {
      ...difficulty,
      preferredTargetRatio: 0.5,
      assistGoal: null,
    };
  }

  if (score >= 55) {
    return {
      targetCount: 14,
      speedMultiplier: difficulty.speedMultiplier,
      preferredTargetRatio: 0.5,
      assistGoal: null,
    };
  }

  const assistGoal = score < 40 ? 40 : 55;
  const gap = assistGoal - score;

  return {
    targetCount: Math.min(20, Math.max(14, 14 + Math.ceil(gap / 4))),
    speedMultiplier: difficulty.speedMultiplier,
    preferredTargetRatio: 0.8,
    assistGoal,
  };
}
