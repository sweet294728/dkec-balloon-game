import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceBalloon,
  advanceDart,
  createBalloon,
  createDart,
} from '../src/game/engine.js';
import { firstSegmentCircleHit } from '../src/game/geometry.js';

test('returns null when a segment misses every circle', () => {
  const hit = firstSegmentCircleHit(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    [{ id: 'miss', x: 50, y: 30, radius: 10 }],
  );

  assert.equal(hit, null);
});

test('detects tangent contact with a circle', () => {
  const hit = firstSegmentCircleHit(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    [{ id: 'tangent', x: 50, y: 10, radius: 10 }],
  );

  assert.equal(hit.id, 'tangent');
  assert.equal(hit.t, 0.5);
});

test('a zero-length segment hits the nearest containing circle deterministically', () => {
  const hit = firstSegmentCircleHit(
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    [
      { id: 'farther', x: 14, y: 10, radius: 5 },
      { id: 'nearest', x: 11, y: 10, radius: 5 },
      { id: 'outside', x: 30, y: 10, radius: 5 },
    ],
  );

  assert.equal(hit.id, 'nearest');
  assert.equal(hit.t, 0);
});

test('does not hit a balloon behind the segment origin', () => {
  const hit = firstSegmentCircleHit(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    [{ id: 'behind', x: -20, y: 0, radius: 10 }],
  );

  assert.equal(hit, null);
});

test('returns only the first hit so a dart cannot pierce a farther balloon', () => {
  const hit = firstSegmentCircleHit(
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    [{ id: 'near', x: 60, y: 0, radius: 20 }, { id: 'far', x: 140, y: 0, radius: 20 }],
  );

  assert.equal(hit.id, 'near');
});

test('creates a dart with normalized direction and fixed initial state', () => {
  const dart = createDart({ x: 3, y: 4 }, { x: 6, y: 8 });

  assert.deepEqual(dart.direction, { x: 0.6, y: 0.8 });
  assert.equal(dart.x, 3);
  assert.equal(dart.y, 4);
  assert.equal(dart.previousX, 3);
  assert.equal(dart.previousY, 4);
  assert.equal(dart.speed, 900);
  assert.equal(dart.active, true);
});

test('advances a dart without mutating its previous state', () => {
  const dart = createDart({ x: 10, y: 20 }, { x: 10, y: 30 });
  const advanced = advanceDart(dart, 0.25);

  assert.equal(advanced.previousX, 10);
  assert.equal(advanced.previousY, 20);
  assert.equal(advanced.x, 10);
  assert.equal(advanced.y, 245);
  assert.equal(advanced.active, true);
  assert.equal(dart.y, 20);
});

test('creates a deterministic balloon from four random values and current difficulty', () => {
  const values = [0.6, 0.25, 0.5, 0.75];
  let calls = 0;
  const balloon = createBalloon(
    { width: 300, height: 500 },
    45,
    () => values[calls++],
  );

  assert.equal(calls, 4);
  assert.deepEqual(balloon, {
    letter: 'e',
    x: 89,
    baseX: 89,
    y: 528,
    radius: 28,
    speed: 95.875,
    swayPhase: Math.PI,
    swayAmplitude: 18,
    escaped: false,
  });
});

test('balloon speed uses the difficulty for its elapsed time', () => {
  const randomValues = () => {
    const values = [0, 0.5, 0, 0.5];
    let index = 0;
    return () => values[index++];
  };

  const early = createBalloon({ width: 300, height: 500 }, 0, randomValues());
  const late = createBalloon({ width: 300, height: 500 }, 45, randomValues());

  assert.equal(late.speed, early.speed * 1.3);
});

test('advances a balloon upward with bounded sinusoidal sway', () => {
  const balloon = {
    letter: 'd',
    x: 185,
    baseX: 185,
    y: 60,
    radius: 10,
    speed: 40,
    swayPhase: 0,
    swayAmplitude: 30,
    escaped: false,
  };
  const advanced = advanceBalloon(
    balloon,
    Math.PI / 4,
    { width: 200, height: 100 },
  );

  assert.equal(advanced.y, 60 - 40 * Math.PI / 4);
  assert.equal(advanced.swayPhase, Math.PI / 2);
  assert.equal(advanced.x, 190);
  assert.equal(advanced.escaped, false);
  assert.equal(balloon.y, 60);
});

test('marks a balloon escaped only after its lower edge passes the top boundary', () => {
  const balloon = {
    letter: 'd',
    x: 100,
    baseX: 100,
    y: 0,
    radius: 10,
    speed: 20,
    swayPhase: 0,
    swayAmplitude: 18,
    escaped: false,
  };

  const touching = advanceBalloon(balloon, 0.5, { width: 200, height: 100 });
  const past = advanceBalloon(touching, 0.001, { width: 200, height: 100 });

  assert.equal(touching.y + touching.radius, 0);
  assert.equal(touching.escaped, false);
  assert.ok(past.y + past.radius < 0);
  assert.equal(past.escaped, true);
});
