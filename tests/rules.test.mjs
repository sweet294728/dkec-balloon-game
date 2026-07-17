import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS, MAX_HEALTH, ROUND_SECONDS } from '../src/game/config.js';
import * as engine from '../src/game/engine.js';
import {
  advanceHeartPickup,
  createHeartPickup,
  getHeartSpawnDelay,
} from '../src/game/engine.js';
import {
  createRoundState,
  getBalloonSpawnPlan,
  getDifficulty,
  getGradeReward,
  getScoreGrade,
  getScoreProgress,
  getTargetLetters,
  resolveBalloonHit,
  resolveHeartHit,
  shouldEndRound,
  tickRound,
} from '../src/game/rules.js';

test('score grades use the approved exact boundaries', () => {
  assert.equal(getScoreGrade(55).id, 'S');
  assert.equal(getScoreGrade(54).id, 'A');
  assert.equal(getScoreGrade(40).id, 'A');
  assert.equal(getScoreGrade(39).id, 'B');
  assert.equal(getScoreGrade(25).id, 'B');
  assert.equal(getScoreGrade(24).id, 'C');
  assert.equal(getScoreGrade(10).id, 'C');
  assert.equal(getScoreGrade(9).id, 'D');
  assert.equal(getScoreGrade(0).id, 'D');
  assert.equal(getScoreGrade(-8).id, 'D');
});

test('score progress reports the adjacent grade and exact points remaining', () => {
  const examples = [
    { score: -2, current: 'D', next: 'C', pointsToNext: 12 },
    { score: 9, current: 'D', next: 'C', pointsToNext: 1 },
    { score: 10, current: 'C', next: 'B', pointsToNext: 15 },
    { score: 25, current: 'B', next: 'A', pointsToNext: 15 },
    { score: 40, current: 'A', next: 'S', pointsToNext: 15 },
  ];

  for (const example of examples) {
    const progress = getScoreProgress(example.score);

    assert.equal(progress.currentGrade.id, example.current);
    assert.equal(progress.nextGrade.id, example.next);
    assert.equal(progress.pointsToNext, example.pointsToNext);
    assert.equal(progress.isTopGrade, false);
  }
});

test('score progress marks S as the top grade with no next target', () => {
  assert.deepEqual(getScoreProgress(55), {
    currentGrade: getScoreGrade(55),
    nextGrade: null,
    pointsToNext: 0,
    isTopGrade: true,
  });
});

test('each grade maps to the exact approved shopping-credit reward', () => {
  assert.deepEqual(getGradeReward('D'), {
    gradeId: 'D',
    amount: 10,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=NVPF9V7Q',
  });
  assert.deepEqual(getGradeReward('C'), {
    gradeId: 'C',
    amount: 20,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=U7V5XBWU',
  });
  assert.deepEqual(getGradeReward('B'), {
    gradeId: 'B',
    amount: 50,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=CGWDFXPW',
  });
  assert.deepEqual(getGradeReward('A'), {
    gradeId: 'A',
    amount: 100,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=9FYCZR38',
  });
  assert.deepEqual(getGradeReward('S'), {
    gradeId: 'S',
    amount: 300,
    url: 'https://www.dk-shoes.com.tw/V2/ECoupon/MyECoupon?source=linksetmembercoupon&ecouponCode=SVHCDEKK',
  });
  assert.equal(getGradeReward('unknown'), null);
});

test('defines four playable characters and the round constants', () => {
  assert.deepEqual(Object.keys(CHARACTERS), ['d', 'k', 'e', 'c']);

  for (const character of Object.values(CHARACTERS)) {
    assert.equal(typeof character.displayName, 'string');
    assert.ok(character.displayName.length > 0);
    assert.equal(typeof character.color, 'string');
    assert.ok(character.color.length > 0);
    assert.ok(['dk', 'ec'].includes(character.team));
  }

  assert.equal(ROUND_SECONDS, 60);
  assert.equal(MAX_HEALTH, 5);
});

test('D and K target E and C', () => {
  assert.deepEqual(getTargetLetters('d'), ['e', 'c']);
  assert.deepEqual(getTargetLetters('k'), ['e', 'c']);
});

test('E and C target D and K', () => {
  assert.deepEqual(getTargetLetters('e'), ['d', 'k']);
  assert.deepEqual(getTargetLetters('c'), ['d', 'k']);
});

test('a correct balloon hit adds one score without changing health', () => {
  const state = { score: 0, health: 5, characterId: 'd' };

  assert.deepEqual(resolveBalloonHit(state, 'e'), {
    score: 1,
    health: 5,
    correct: true,
  });
  assert.deepEqual(state, { score: 0, health: 5, characterId: 'd' });
});

test('a wrong balloon hit subtracts score and health', () => {
  const state = { score: 0, health: 5, characterId: 'd' };

  assert.deepEqual(resolveBalloonHit(state, 'k'), {
    score: -1,
    health: 4,
    correct: false,
  });
  assert.deepEqual(state, { score: 0, health: 5, characterId: 'd' });
});

test('a heart heals one when health is below the cap', () => {
  const state = { score: 3, health: 4 };

  assert.deepEqual(resolveHeartHit(state), {
    score: 3,
    health: 5,
    healed: true,
  });
  assert.deepEqual(state, { score: 3, health: 4 });
});

test('a heart adds one score when health is full', () => {
  const state = { score: 3, health: 5 };

  assert.deepEqual(resolveHeartHit(state), {
    score: 4,
    health: 5,
    healed: false,
  });
  assert.deepEqual(state, { score: 3, health: 5 });
});

test('difficulty progresses at the specified elapsed-time boundaries', () => {
  assert.deepEqual(getDifficulty(0), { targetCount: 6, speedMultiplier: 1 });
  assert.deepEqual(getDifficulty(19), { targetCount: 6, speedMultiplier: 1 });
  assert.deepEqual(getDifficulty(20), { targetCount: 9, speedMultiplier: 1.15 });
  assert.deepEqual(getDifficulty(44), { targetCount: 9, speedMultiplier: 1.15 });
  assert.deepEqual(getDifficulty(45), { targetCount: 12, speedMultiplier: 1.3 });
  assert.deepEqual(getDifficulty(60), { targetCount: 12, speedMultiplier: 1.3 });
});

test('spawn plan preserves existing difficulty before the final ten seconds', () => {
  assert.deepEqual(getBalloonSpawnPlan({
    elapsedSeconds: 20,
    remainingSeconds: 11,
    score: 0,
  }), {
    targetCount: 9,
    speedMultiplier: 1.15,
    preferredTargetRatio: 0.5,
    assistGoal: null,
  });
});

test('final-ten-second spawn plan assists toward A and S without adding speed', () => {
  const examples = [
    { score: 0, targetCount: 20, preferredTargetRatio: 0.8, assistGoal: 40 },
    { score: 25, targetCount: 18, preferredTargetRatio: 0.8, assistGoal: 40 },
    { score: 39, targetCount: 15, preferredTargetRatio: 0.8, assistGoal: 40 },
    { score: 40, targetCount: 18, preferredTargetRatio: 0.8, assistGoal: 55 },
    { score: 54, targetCount: 15, preferredTargetRatio: 0.8, assistGoal: 55 },
    { score: 55, targetCount: 14, preferredTargetRatio: 0.5, assistGoal: null },
  ];

  for (const example of examples) {
    assert.deepEqual(getBalloonSpawnPlan({
      elapsedSeconds: 50,
      remainingSeconds: 10,
      score: example.score,
    }), {
      targetCount: example.targetCount,
      speedMultiplier: 1.3,
      preferredTargetRatio: example.preferredTargetRatio,
      assistGoal: example.assistGoal,
    });
  }
});

test('a new round starts with the selected character and empty gameplay state', () => {
  const state = createRoundState('k');

  assert.equal(state.characterId, 'k');
  assert.equal(state.score, 0);
  assert.equal(state.health, 5);
  assert.equal(state.remainingSeconds, 60);
  assert.equal(state.correctHits, 0);
  assert.equal(state.wrongHits, 0);
  assert.deepEqual(state.balloons, []);
  assert.deepEqual(state.darts, []);
  assert.deepEqual(state.effects, []);
});

test('ticking a round clamps remaining time at zero', () => {
  const state = {
    ...createRoundState('d'),
    remainingSeconds: 0.25,
  };

  const ticked = tickRound(state, 1);

  assert.equal(ticked.remainingSeconds, 0);
  assert.equal(state.remainingSeconds, 0.25);
});

test('a round ends when its time reaches zero', () => {
  assert.equal(shouldEndRound({
    ...createRoundState('e'),
    remainingSeconds: 0,
  }), true);
});

test('a round ends when health reaches zero', () => {
  assert.equal(shouldEndRound({
    ...createRoundState('c'),
    health: 0,
  }), true);
});

test('escaped balloons are removed without changing score or health', () => {
  const state = {
    ...createRoundState('d'),
    score: 7,
    health: 3,
    balloons: [
      { id: 'escaped', escaped: true },
      { id: 'active', escaped: false },
    ],
  };

  const ticked = tickRound(state, 0);

  assert.deepEqual(ticked.balloons, [{ id: 'active', escaped: false }]);
  assert.equal(ticked.score, 7);
  assert.equal(ticked.health, 3);
});

test('new round state never retains arrays or scores from an earlier round', () => {
  const earlier = createRoundState('d');
  earlier.score = 9;
  earlier.balloons.push({ id: 'old-balloon' });
  earlier.darts.push({ id: 'old-dart' });
  earlier.effects.push({ id: 'old-effect' });

  const next = createRoundState('d');

  assert.equal(next.score, 0);
  assert.deepEqual(next.balloons, []);
  assert.deepEqual(next.darts, []);
  assert.deepEqual(next.effects, []);
  assert.notEqual(next.balloons, earlier.balloons);
  assert.notEqual(next.darts, earlier.darts);
  assert.notEqual(next.effects, earlier.effects);
});

test('heart spawn delays stay within the inclusive 10-to-16-second window', () => {
  assert.equal(getHeartSpawnDelay(() => 0), 10);
  assert.equal(getHeartSpawnDelay(() => 1), 16);
});

test('heart pickups spawn within the playfield and escape without a penalty flag', () => {
  const pickup = createHeartPickup(
    { width: 320, height: 480 },
    () => 0.5,
  );

  assert.equal(pickup.x, 160);
  assert.equal(pickup.y, 506);
  assert.equal(pickup.radius, 26);
  assert.equal(pickup.speed, 64);
  assert.equal(pickup.escaped, false);

  const escaped = advanceHeartPickup(
    { ...pickup, y: -25 },
    0.1,
    { width: 320, height: 480 },
  );

  assert.equal(escaped.escaped, true);
});

test('spawn line gates hits and later entities keep their original speed', () => {
  const spawnLineY = 650;
  const randomValues = [0, 0.5, 0, 0.5];
  let randomIndex = 0;
  const balloon = engine.createBalloon(
    { width: 800, height: 900 },
    0,
    () => randomValues[randomIndex++],
    spawnLineY,
  );

  assert.equal(engine.isEntityHittable({ y: 700, radius: 28 }, spawnLineY), false);
  assert.equal(engine.isEntityHittable({ y: 622, radius: 28 }, spawnLineY), true);
  assert.equal(balloon.y - balloon.radius, spawnLineY);
  assert.equal(balloon.speed, 55 + 25 * 0.5);
  assert.equal('entrySpeedMultiplier' in balloon, false);
});

test('a new round seeds six staggered visible balloons above the wall line', () => {
  const initial = engine.createInitialBalloons({
    bounds: { width: 800, height: 900 },
    count: 6,
    elapsedSeconds: 0,
    random: () => 0.5,
    spawnLineY: 650,
  });

  assert.equal(initial.length, 6);
  assert.ok(initial.every((balloon) => balloon.y + balloon.radius <= 650));
  assert.ok(new Set(initial.map(({ y }) => y)).size >= 2);
  assert.ok(initial.every((balloon) => balloon.speed === 67.5));
});

test('dart and burst source rectangles match the generated sprite boundaries', () => {
  assert.equal(typeof engine.getDartBurstSourceRect, 'function');

  const imageBounds = { width: 2172, height: 724 };
  const rectangles = [
    engine.getDartBurstSourceRect('dart'),
    ...Array.from(
      { length: 4 },
      (_, frame) => engine.getDartBurstSourceRect('burst', frame),
    ),
  ];

  assert.deepEqual(rectangles, [
    { x: 72, y: 222, width: 333, height: 315 },
    { x: 524, y: 263, width: 197, height: 198 },
    { x: 840, y: 224, width: 287, height: 296 },
    { x: 1210, y: 159, width: 378, height: 395 },
    { x: 1648, y: 112, width: 478, height: 477 },
  ]);

  for (const rectangle of rectangles) {
    assert.ok(rectangle.x >= 0);
    assert.ok(rectangle.y >= 0);
    assert.ok(rectangle.x + rectangle.width <= imageBounds.width);
    assert.ok(rectangle.y + rectangle.height <= imageBounds.height);
  }

  for (let left = 0; left < rectangles.length; left += 1) {
    for (let right = left + 1; right < rectangles.length; right += 1) {
      const first = rectangles[left];
      const second = rectangles[right];
      const overlaps = (
        first.x < second.x + second.width
        && first.x + first.width > second.x
        && first.y < second.y + second.height
        && first.y + first.height > second.y
      );

      assert.equal(overlaps, false);
    }
  }
});

test('background draw plan keeps the complete generated wall visible', () => {
  assert.equal(typeof engine.getBackgroundDrawPlan, 'function');

  for (const destination of [
    { width: 1200, height: 600 },
    { width: 800, height: 800 },
  ]) {
    const plan = engine.getBackgroundDrawPlan(
      { width: 941, height: 1672 },
      destination,
    );

    assert.deepEqual(plan.upper.destination, {
      x: 0,
      y: 0,
      ...destination,
    });
    assert.equal(plan.wall.source.x, 0);
    assert.equal(plan.wall.source.width, 941);
    assert.equal(
      plan.wall.source.y + plan.wall.source.height,
      1672,
    );
    assert.equal(
      plan.wall.destination.y + plan.wall.destination.height,
      destination.height,
    );
    assert.ok(plan.wall.destination.x >= 0);
    assert.ok(
      plan.wall.destination.x + plan.wall.destination.width
      <= destination.width,
    );
    assert.ok(plan.wall.destination.y >= 0);
    assert.ok(plan.wall.destination.x < destination.width / 2);
    assert.ok(
      plan.wall.destination.x + plan.wall.destination.width
      > destination.width / 2,
    );
  }
});

test('character draw plan centers the character over the visible wall', () => {
  const destination = { width: 480, height: 847 };
  const wallTop = 661;
  const plan = engine.getCharacterDrawPlan(
    { width: 1256, height: 1256 },
    destination,
    wallTop,
  );

  assert.equal(plan.x + plan.width / 2, destination.width / 2);
  assert.equal(
    plan.y + plan.height / 2,
    wallTop + (destination.height - wallTop) / 2,
  );
  assert.ok(plan.y >= wallTop - plan.height / 2);
  assert.ok(plan.y + plan.height <= destination.height + plan.height / 2);
});

test('dart origin follows the repositioned character hand', () => {
  const plan = { x: 110, y: 600, width: 260, height: 260 };

  assert.deepEqual(engine.getCharacterDartOrigin(plan), {
    x: 281.6,
    y: 688.4,
  });
});

test('target indicator stays left of the character on mobile playfields', () => {
  for (const width of [390, 480]) {
    const bounds = { width, height: 844 };
    const characterPlan = {
      x: width / 2 - 110,
      y: 650,
      width: 220,
      height: 220,
    };
    const indicator = engine.getTargetIndicatorDrawPlan(
      characterPlan,
      bounds,
    );

    assert.ok(indicator.x >= 0);
    assert.ok(indicator.y >= 0);
    assert.ok(indicator.x + indicator.width <= bounds.width);
    assert.ok(indicator.y + indicator.height <= bounds.height);
    assert.ok(
      indicator.x + indicator.width
      < characterPlan.x + characterPlan.width / 2,
    );
  }
});

test('resize reprojects and clamps every high-frequency entity collection', () => {
  assert.equal(typeof engine.reprojectEntitiesForResize, 'function');

  const entities = {
    balloons: [{
      id: 'balloon',
      x: 950,
      baseX: 960,
      y: 490,
      radius: 28,
    }],
    heartPickups: [{
      id: 'heart',
      x: -40,
      y: 600,
      radius: 26,
    }],
    darts: [{
      id: 'dart',
      x: 1200,
      y: -20,
      previousX: 800,
      previousY: 250,
    }],
    effects: [{
      id: 'effect',
      x: 500,
      y: 250,
    }],
  };

  const resized = engine.reprojectEntitiesForResize(
    entities,
    { width: 1000, height: 500 },
    { width: 200, height: 100 },
  );

  assert.deepEqual(resized.balloons, [{
    id: 'balloon',
    x: 172,
    baseX: 172,
    y: 72,
    radius: 28,
  }]);
  assert.deepEqual(resized.heartPickups, [{
    id: 'heart',
    x: 26,
    y: 74,
    radius: 26,
  }]);
  assert.deepEqual(resized.darts, [{
    id: 'dart',
    x: 200,
    y: 0,
    previousX: 160,
    previousY: 50,
  }]);
  assert.deepEqual(resized.effects, [{
    id: 'effect',
    x: 100,
    y: 50,
  }]);
  assert.equal(entities.balloons[0].x, 950);
  assert.notEqual(resized.balloons, entities.balloons);
});

test('pointer conversion rejects zero-sized CSS boxes before division', () => {
  assert.equal(typeof engine.getLogicalPointerPosition, 'function');
  assert.equal(engine.getLogicalPointerPosition(
    { x: 20, y: 30 },
    { left: 10, top: 10, width: 0, height: 100 },
    { width: 400, height: 200 },
  ), null);
  assert.equal(engine.getLogicalPointerPosition(
    { x: 20, y: 30 },
    { left: 10, top: 10, width: 100, height: 0 },
    { width: 400, height: 200 },
  ), null);
  assert.deepEqual(engine.getLogicalPointerPosition(
    { x: 60, y: 35 },
    { left: 10, top: 10, width: 100, height: 50 },
    { width: 400, height: 200 },
  ), { x: 200, y: 100 });
});

test('zero-sized resize produces no update and preserves state and bounds', () => {
  assert.equal(typeof engine.getResizeUpdate, 'function');

  const bounds = { width: 800, height: 600 };
  const entities = {
    balloons: [{ id: 'balloon', x: 700, y: 500, radius: 28 }],
    heartPickups: [{ id: 'heart', x: 400, y: 300, radius: 26 }],
    darts: [],
    effects: [],
  };

  assert.equal(engine.getResizeUpdate(
    { width: 0, height: 400 },
    bounds,
    entities,
  ), null);
  assert.equal(engine.getResizeUpdate(
    { width: 400, height: 0 },
    bounds,
    entities,
  ), null);
  assert.deepEqual(bounds, { width: 800, height: 600 });
  assert.deepEqual(entities.balloons, [{
    id: 'balloon',
    x: 700,
    y: 500,
    radius: 28,
  }]);
});

test('non-uniform resize transforms and renormalizes dart direction', () => {
  const direction = { x: 0.6, y: 0.8 };
  const oldBounds = { width: 300, height: 600 };
  const newBounds = { width: 900, height: 300 };
  const transformedLength = Math.hypot(
    direction.x * (newBounds.width / oldBounds.width),
    direction.y * (newBounds.height / oldBounds.height),
  );
  const resized = engine.reprojectEntitiesForResize(
    {
      balloons: [],
      heartPickups: [],
      darts: [{
        id: 'dart',
        x: 150,
        y: 300,
        previousX: 120,
        previousY: 240,
        direction,
      }],
      effects: [],
    },
    oldBounds,
    newBounds,
  );

  assert.ok(Math.abs(
    resized.darts[0].direction.x
    - (
      direction.x * (newBounds.width / oldBounds.width)
    ) / transformedLength,
  ) < 1e-12);
  assert.ok(Math.abs(
    resized.darts[0].direction.y
    - (
      direction.y * (newBounds.height / oldBounds.height)
    ) / transformedLength,
  ) < 1e-12);
  assert.ok(Math.abs(Math.hypot(
    resized.darts[0].direction.x,
    resized.darts[0].direction.y,
  ) - 1) < 1e-12);
  assert.deepEqual(direction, { x: 0.6, y: 0.8 });
});

test('ten-FPS active frames consume exactly sixty seconds of round time', () => {
  assert.equal(typeof engine.getFrameStepPlan, 'function');

  let state = createRoundState('d');

  for (let frame = 0; frame < 600; frame += 1) {
    const plan = engine.getFrameStepPlan(0.1, true);

    assert.equal(plan.roundDeltaSeconds, 0.1);
    assert.ok(plan.physicsSteps.length >= 2);
    assert.ok(plan.physicsSteps.every((step) => step <= 0.05));
    state = tickRound(state, plan.roundDeltaSeconds);
  }

  assert.equal(state.remainingSeconds, 0);
  assert.equal(shouldEndRound(state), true);
});

test('long frames preserve clock time while physics catch-up stays bounded', () => {
  assert.equal(typeof engine.getFrameStepPlan, 'function');

  const plan = engine.getFrameStepPlan(2, true);
  const physicsElapsed = plan.physicsSteps.reduce(
    (total, step) => total + step,
    0,
  );

  assert.equal(plan.roundDeltaSeconds, 2);
  assert.ok(plan.physicsSteps.every((step) => step <= 0.05));
  assert.ok(physicsElapsed <= 0.25 + Number.EPSILON);
});

test('paused frames do not consume round time or run physics', () => {
  assert.equal(typeof engine.getFrameStepPlan, 'function');

  const state = createRoundState('k');
  const plan = engine.getFrameStepPlan(10, false);
  const paused = tickRound(state, plan.roundDeltaSeconds);

  assert.equal(plan.roundDeltaSeconds, 0);
  assert.deepEqual(plan.physicsSteps, []);
  assert.equal(paused.remainingSeconds, 60);
});

function assertSeparatedBalloonSpawnCount(count) {
  const balloons = [];

  while (balloons.length < count) {
    balloons.push(engine.createBalloonAvoiding(
      { width: 320, height: 480 },
      0,
      balloons,
      () => 0.5,
    ));
  }

  const centers = new Set(
    balloons.map((balloon) => `${balloon.x},${balloon.y}`),
  );

  assert.equal(centers.size, count);

  for (let left = 0; left < balloons.length; left += 1) {
    for (let right = left + 1; right < balloons.length; right += 1) {
      const first = balloons[left];
      const second = balloons[right];

      assert.ok(
        Math.hypot(first.x - second.x, first.y - second.y)
        >= first.radius + second.radius + 4 - 1e-9,
      );
    }
  }
}

test('deterministic ordinary spawn separates the initial six balloons', () => {
  assert.equal(typeof engine.createBalloonAvoiding, 'function');
  assertSeparatedBalloonSpawnCount(6);
});

test('deterministic dense spawn separates all twelve late-round balloons', () => {
  assert.equal(typeof engine.createBalloonAvoiding, 'function');
  assertSeparatedBalloonSpawnCount(12);
});

test('heart spawn avoids completely covering an existing balloon', () => {
  assert.equal(typeof engine.createHeartPickupAvoiding, 'function');

  const balloon = {
    x: 160,
    y: 506,
    radius: 28,
  };
  const heart = engine.createHeartPickupAvoiding(
    { width: 320, height: 480 },
    [balloon],
    () => 0.5,
  );

  assert.notDeepEqual(
    { x: heart.x, y: heart.y },
    { x: balloon.x, y: balloon.y },
  );
  assert.ok(
    Math.hypot(heart.x - balloon.x, heart.y - balloon.y)
    >= heart.radius + balloon.radius + 4 - 1e-9,
  );
});

test('feedback effects float upward and fade without mutating input', () => {
  assert.equal(typeof engine.createHitFeedback, 'function');
  assert.equal(typeof engine.advanceFeedbackEffect, 'function');

  const effect = engine.createHitFeedback(
    'balloon',
    { correct: true },
    { x: 40, y: 80 },
  );
  const advanced = engine.advanceFeedbackEffect(effect, 0.25);

  assert.equal(effect.type, 'feedback');
  assert.equal(effect.text, '+1');
  assert.equal(effect.age, 0);
  assert.equal(advanced.age, 0.25);
  assert.ok(advanced.y < effect.y);
  assert.ok(advanced.opacity < effect.opacity);
  assert.equal(effect.y, 80);
});

test('rule resolutions map to the four required scene feedback messages', () => {
  assert.equal(typeof engine.createHitFeedback, 'function');

  const position = { x: 100, y: 120 };
  const correct = resolveBalloonHit(
    { characterId: 'd', score: 0, health: 5 },
    'e',
  );
  const wrong = resolveBalloonHit(
    { characterId: 'd', score: 0, health: 5 },
    'd',
  );
  const fullHeart = resolveHeartHit({ score: 2, health: 5 });
  const damagedHeart = resolveHeartHit({ score: 2, health: 4 });

  assert.equal(
    engine.createHitFeedback('balloon', correct, position).text,
    '+1',
  );
  assert.equal(
    engine.createHitFeedback('balloon', wrong, position).text,
    '-1',
  );
  assert.equal(
    engine.createHitFeedback('heart', fullHeart, position).text,
    '+1',
  );
  assert.equal(
    engine.createHitFeedback('heart', damagedHeart, position).text,
    '+♥',
  );
});
