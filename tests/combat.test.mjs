import assert from 'node:assert/strict';
import test from 'node:test';

import { CHARACTERS } from '../src/game/config.js';
import * as engine from '../src/game/engine.js';
import { createRoundState } from '../src/game/rules.js';

const bounds = { width: 320, height: 240 };

function createRound(overrides = {}) {
  return {
    ...createRoundState('d'),
    ...overrides,
  };
}

function createTestDart(overrides = {}) {
  return {
    id: 10,
    x: 0,
    y: 50,
    previousX: 0,
    previousY: 50,
    direction: { x: 1, y: 0 },
    speed: 200,
    age: 0,
    active: true,
    ...overrides,
  };
}

function createBalloon(id, letter, x, y = 50) {
  return {
    id,
    letter,
    x,
    y,
    radius: 10,
  };
}

test('weighted balloon selection divides target and non-target ranges evenly', () => {
  assert.equal(engine.selectBalloonLetter(0, ['e', 'c'], 0.8), 'e');
  assert.equal(engine.selectBalloonLetter(0.79, ['e', 'c'], 0.8), 'c');
  assert.equal(engine.selectBalloonLetter(0.8, ['e', 'c'], 0.8), 'd');
  assert.equal(engine.selectBalloonLetter(0.999, ['e', 'c'], 0.8), 'k');
});

test('balloon selection preserves the legacy uniform letter mapping without a plan', () => {
  const randomValues = [0, 0.25, 0.5, 0.75];

  assert.deepEqual(
    randomValues.map((randomValue) => engine.selectBalloonLetter(randomValue)),
    ['d', 'k', 'e', 'c'],
  );
});

test('character card accents use the four approved character colors', () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(CHARACTERS).map(([id, character]) => [id, character.color]),
    ),
    {
      d: '#60a5fa',
      k: '#86efac',
      e: '#facc15',
      c: '#fb7185',
    },
  );
});

test('correct hit consumes one dart and removes only the nearest balloon', () => {
  assert.equal(typeof engine.advanceCombatState, 'function');

  const result = engine.advanceCombatState({
    round: createRound(),
    balloons: [
      createBalloon(1, 'e', 60),
      createBalloon(2, 'c', 130),
      createBalloon(3, 'e', 250),
    ],
    heartPickups: [{ id: 7, x: 100, y: 50, radius: 10 }],
    darts: [createTestDart()],
    effects: [],
    bounds,
    deltaSeconds: 1,
    nextEntityId: 100,
  });

  assert.deepEqual(result.balloons.map(({ id }) => id), [2, 3]);
  assert.deepEqual(result.heartPickups.map(({ id }) => id), [7]);
  assert.deepEqual(result.darts, []);
  assert.equal(result.round.score, 1);
  assert.equal(result.round.health, 5);
  assert.equal(result.round.correctHits, 1);
  assert.equal(result.round.wrongHits, 0);
  assert.deepEqual(result.effects.map(({ id, type }) => ({ id, type })), [
    { id: 100, type: 'burst' },
    { id: 101, type: 'feedback' },
  ]);
  assert.equal(result.nextEntityId, 102);
});

test('wrong hit reaches zero health and prevents a second dart resolution', () => {
  assert.equal(typeof engine.advanceCombatState, 'function');

  const result = engine.advanceCombatState({
    round: createRound({ health: 1 }),
    balloons: [
      createBalloon(1, 'd', 60, 50),
      createBalloon(2, 'e', 60, 120),
    ],
    heartPickups: [],
    darts: [
      createTestDart(),
      createTestDart({ id: 11, y: 120, previousY: 120 }),
    ],
    effects: [],
    bounds,
    deltaSeconds: 1,
    nextEntityId: 200,
  });

  assert.deepEqual(result.balloons.map(({ id }) => id), [2]);
  assert.equal(result.round.score, -1);
  assert.equal(result.round.health, 0);
  assert.equal(result.round.correctHits, 0);
  assert.equal(result.round.wrongHits, 1);
  assert.deepEqual(result.effects.map(({ id }) => id), [200, 201]);
  assert.equal(result.nextEntityId, 202);
});

test('heart hit removes the pickup and heals below the cap', () => {
  assert.equal(typeof engine.advanceCombatState, 'function');

  const result = engine.advanceCombatState({
    round: createRound({ score: 3, health: 3 }),
    balloons: [],
    heartPickups: [{ id: 7, x: 60, y: 50, radius: 10 }],
    darts: [createTestDart()],
    effects: [],
    bounds,
    deltaSeconds: 1,
    nextEntityId: 300,
  });

  assert.deepEqual(result.heartPickups, []);
  assert.deepEqual(result.darts, []);
  assert.equal(result.round.score, 3);
  assert.equal(result.round.health, 4);
  assert.equal(result.effects[1].text, '+♥');
  assert.equal(result.nextEntityId, 302);

  const fullHealthResult = engine.advanceCombatState({
    round: createRound({ score: 3, health: 5 }),
    balloons: [],
    heartPickups: [{ id: 8, x: 60, y: 50, radius: 10 }],
    darts: [createTestDart()],
    effects: [],
    bounds,
    deltaSeconds: 1,
    nextEntityId: 310,
  });

  assert.equal(fullHealthResult.round.score, 4);
  assert.equal(fullHealthResult.round.health, 5);
  assert.equal(fullHealthResult.effects[1].text, '+1');
  assert.equal(fullHealthResult.nextEntityId, 312);
});

test('missed in-bounds dart advances and survives below its lifetime', () => {
  assert.equal(typeof engine.advanceCombatState, 'function');

  const dart = createTestDart({ speed: 20 });
  const result = engine.advanceCombatState({
    round: createRound(),
    balloons: [],
    heartPickups: [],
    darts: [dart],
    effects: [],
    bounds,
    deltaSeconds: 0.5,
    nextEntityId: 400,
  });

  assert.equal(result.darts.length, 1);
  assert.equal(result.darts[0].previousX, 0);
  assert.equal(result.darts[0].x, 10);
  assert.equal(result.darts[0].age, 0.5);
  assert.deepEqual(result.effects, []);
  assert.equal(result.nextEntityId, 400);
  assert.deepEqual(dart, createTestDart({ speed: 20 }));
});

test('a hidden balloon cannot shield a fully visible target', () => {
  const result = engine.advanceCombatState({
    round: createRound(),
    balloons: [
      createBalloon(1, 'd', 60, 50),
      createBalloon(2, 'e', 130, 45),
    ],
    heartPickups: [],
    darts: [createTestDart()],
    effects: [],
    bounds,
    deltaSeconds: 1,
    nextEntityId: 500,
    spawnLineY: 55,
  });

  assert.deepEqual(result.balloons.map(({ id }) => id), [1]);
  assert.equal(result.round.score, 1);
  assert.equal(result.round.health, 5);
});

test('a heart remains untouchable until it fully clears the wall line', () => {
  const result = engine.advanceCombatState({
    round: createRound({ health: 4 }),
    balloons: [],
    heartPickups: [{ id: 7, x: 60, y: 50, radius: 10 }],
    darts: [createTestDart()],
    effects: [],
    bounds,
    deltaSeconds: 0.25,
    nextEntityId: 600,
    spawnLineY: 55,
  });

  assert.deepEqual(result.heartPickups.map(({ id }) => id), [7]);
  assert.equal(result.round.health, 4);
  assert.equal(result.round.score, 0);
});
