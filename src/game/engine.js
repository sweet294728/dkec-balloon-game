import { firstSegmentCircleHit } from './geometry.js';
import {
  getDifficulty,
  resolveBalloonHit,
  resolveHeartHit,
  shouldEndRound,
} from './rules.js';

const DART_SPEED = 900;
const BALLOON_RADIUS = 28;
const BALLOON_MIN_SPEED = 55;
const BALLOON_SPEED_RANGE = 25;
const BALLOON_SWAY_AMPLITUDE = 18;
const BALLOON_SWAY_RADIANS_PER_SECOND = 2;
const BALLOON_LETTERS = ['d', 'k', 'e', 'c'];
const HEART_RADIUS = 26;
const HEART_SPEED = 64;
const BACKGROUND_WALL_TOP_RATIO = 1300 / 1672;
const BACKGROUND_WALL_MAX_HEIGHT_RATIO = 0.22;
const MAX_PHYSICS_STEP_SECONDS = 0.05;
const MAX_PHYSICS_CATCH_UP_SECONDS = 0.25;
const SPAWN_GAP = 4;
const SPAWN_CANDIDATE_COUNT = 24;
const FEEDBACK_DURATION_SECONDS = 0.8;
const FEEDBACK_RISE_SPEED = 48;
const HIT_EFFECT_SECONDS = 0.36;
const DART_LIFETIME_SECONDS = 2;

const DART_BURST_SOURCE_RECTS = Object.freeze({
  dart: Object.freeze({ x: 72, y: 222, width: 333, height: 315 }),
  bursts: Object.freeze([
    Object.freeze({ x: 524, y: 263, width: 197, height: 198 }),
    Object.freeze({ x: 840, y: 224, width: 287, height: 296 }),
    Object.freeze({ x: 1210, y: 159, width: 378, height: 395 }),
    Object.freeze({ x: 1648, y: 112, width: 478, height: 477 }),
  ]),
});

function getEdges(bounds) {
  const left = bounds.left ?? 0;
  const top = bounds.top ?? 0;

  return {
    left,
    top,
    right: bounds.right ?? left + bounds.width,
    bottom: bounds.bottom ?? top + bounds.height,
  };
}

function clampBalloonX(x, radius, edges) {
  const minimum = edges.left + radius;
  const maximum = edges.right - radius;

  if (minimum > maximum) {
    return (edges.left + edges.right) / 2;
  }

  return Math.max(minimum, Math.min(maximum, x));
}

function clamp(value, minimum, maximum) {
  if (minimum > maximum) {
    return (minimum + maximum) / 2;
  }

  return Math.max(minimum, Math.min(maximum, value));
}

function project(value, oldSize, newSize) {
  return oldSize > 0 ? value * (newSize / oldSize) : value;
}

function reprojectDirection(direction, oldBounds, newBounds) {
  const xScale = oldBounds.width > 0
    ? newBounds.width / oldBounds.width
    : 1;
  const yScale = oldBounds.height > 0
    ? newBounds.height / oldBounds.height
    : 1;
  const x = direction.x * xScale;
  const y = direction.y * yScale;
  const length = Math.hypot(x, y);

  return length === 0
    ? { x: 0, y: 0 }
    : { x: x / length, y: y / length };
}

function reprojectCircle(entity, oldBounds, newBounds) {
  const radius = entity.radius ?? 0;

  return {
    ...entity,
    x: clamp(
      project(entity.x, oldBounds.width, newBounds.width),
      radius,
      newBounds.width - radius,
    ),
    y: clamp(
      project(entity.y, oldBounds.height, newBounds.height),
      radius,
      newBounds.height - radius,
    ),
  };
}

function getSpawnClearance(candidate, existingEntities) {
  if (existingEntities.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...existingEntities.map((entity) => (
    Math.hypot(candidate.x - entity.x, candidate.y - entity.y)
    - candidate.radius
    - (entity.radius ?? 0)
    - SPAWN_GAP
  )));
}

function findAvoidingSpawnPosition(
  bounds,
  radius,
  existingEntities,
  random,
  spawnLineY,
) {
  const edges = getEdges(bounds);
  const minimumX = edges.left + radius;
  const maximumX = edges.right - radius;
  const usableWidth = Math.max(0, maximumX - minimumX);
  const spacing = radius * 2 + SPAWN_GAP;
  const laneCount = Math.max(1, Math.floor(usableWidth / spacing) + 1);
  const start = Math.min(
    SPAWN_CANDIDATE_COUNT - 1,
    Math.floor(random() * SPAWN_CANDIDATE_COUNT),
  );
  let best = null;

  for (let offset = 0; offset < SPAWN_CANDIDATE_COUNT; offset += 1) {
    const candidateIndex = (start + offset) % SPAWN_CANDIDATE_COUNT;
    const lane = candidateIndex % laneCount;
    const row = Math.floor(candidateIndex / laneCount);
    const candidate = {
      x: laneCount === 1
        ? (edges.left + edges.right) / 2
        : minimumX + usableWidth * (lane / (laneCount - 1)),
      y: (spawnLineY ?? edges.bottom) + radius + row * spacing,
      radius,
    };
    const clearance = getSpawnClearance(candidate, existingEntities);

    if (clearance >= 0) {
      return candidate;
    }

    if (best === null || clearance > best.clearance) {
      best = { ...candidate, clearance };
    }
  }

  return {
    x: best.x,
    y: best.y,
    radius,
  };
}

export function getFrameStepPlan(elapsedSeconds, active) {
  if (!active || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return {
      roundDeltaSeconds: 0,
      physicsSteps: [],
    };
  }

  const physicsElapsed = Math.min(
    elapsedSeconds,
    MAX_PHYSICS_CATCH_UP_SECONDS,
  );
  const stepCount = Math.ceil(
    physicsElapsed / MAX_PHYSICS_STEP_SECONDS,
  );
  const physicsStep = physicsElapsed / stepCount;

  return {
    roundDeltaSeconds: elapsedSeconds,
    physicsSteps: Array.from(
      { length: stepCount },
      () => physicsStep,
    ),
  };
}

export function getDartBurstSourceRect(kind, frame = 0) {
  const rectangle = kind === 'dart'
    ? DART_BURST_SOURCE_RECTS.dart
    : DART_BURST_SOURCE_RECTS.bursts[frame];

  if (rectangle === undefined || !['dart', 'burst'].includes(kind)) {
    throw new RangeError(`Unknown dart/burst sprite: ${kind} ${frame}`);
  }

  return { ...rectangle };
}

export function getBackgroundDrawPlan(sourceBounds, destinationBounds) {
  const wallSourceY = sourceBounds.height * BACKGROUND_WALL_TOP_RATIO;
  const wallSource = {
    x: 0,
    y: wallSourceY,
    width: sourceBounds.width,
    height: sourceBounds.height - wallSourceY,
  };
  const wallScale = Math.min(
    destinationBounds.width / wallSource.width,
    (
      destinationBounds.height * BACKGROUND_WALL_MAX_HEIGHT_RATIO
    ) / wallSource.height,
  );
  const wallWidth = wallSource.width * wallScale;
  const wallHeight = wallSource.height * wallScale;

  return {
    upper: {
      source: {
        x: 0,
        y: 0,
        width: sourceBounds.width,
        height: wallSourceY,
      },
      destination: {
        x: 0,
        y: 0,
        width: destinationBounds.width,
        height: destinationBounds.height,
      },
    },
    wall: {
      source: wallSource,
      destination: {
        x: (destinationBounds.width - wallWidth) / 2,
        y: destinationBounds.height - wallHeight,
        width: wallWidth,
        height: wallHeight,
      },
    },
  };
}

export function getCharacterDrawPlan(
  imageBounds,
  destinationBounds,
  wallTop,
) {
  const height = Math.min(260, destinationBounds.height * 0.38);
  const width = height * (imageBounds.width / imageBounds.height);
  const wallCenterY = wallTop + (destinationBounds.height - wallTop) / 2;

  return {
    x: (destinationBounds.width - width) / 2,
    y: wallCenterY - height / 2,
    width,
    height,
  };
}

export function getCharacterDartOrigin(characterPlan) {
  return {
    x: characterPlan.x + characterPlan.width * 0.66,
    y: characterPlan.y + characterPlan.height * 0.34,
  };
}

export function getTargetIndicatorDrawPlan(characterPlan, bounds) {
  const width = Math.min(104, Math.max(82, bounds.width * 0.24));
  const height = 88;
  const characterCenterX = characterPlan.x + characterPlan.width / 2;
  const maximumX = Math.max(8, characterCenterX - width - 8);

  return {
    x: clamp(characterPlan.x - width - 10, 8, maximumX),
    y: clamp(
      characterPlan.y + characterPlan.height * 0.14,
      8,
      Math.max(8, bounds.height - height - 8),
    ),
    width,
    height,
  };
}

export function reprojectEntitiesForResize(
  entities,
  oldBounds,
  newBounds,
) {
  return {
    balloons: entities.balloons.map((balloon) => {
      const reprojected = reprojectCircle(balloon, oldBounds, newBounds);

      return {
        ...reprojected,
        baseX: clamp(
          project(balloon.baseX, oldBounds.width, newBounds.width),
          balloon.radius,
          newBounds.width - balloon.radius,
        ),
      };
    }),
    heartPickups: entities.heartPickups.map(
      (pickup) => reprojectCircle(pickup, oldBounds, newBounds),
    ),
    darts: entities.darts.map((dart) => {
      const reprojected = {
        ...dart,
        x: clamp(
          project(dart.x, oldBounds.width, newBounds.width),
          0,
          newBounds.width,
        ),
        y: clamp(
          project(dart.y, oldBounds.height, newBounds.height),
          0,
          newBounds.height,
        ),
        previousX: clamp(
          project(dart.previousX, oldBounds.width, newBounds.width),
          0,
          newBounds.width,
        ),
        previousY: clamp(
          project(dart.previousY, oldBounds.height, newBounds.height),
          0,
          newBounds.height,
        ),
      };

      return dart.direction === undefined
        ? reprojected
        : {
          ...reprojected,
          direction: reprojectDirection(
            dart.direction,
            oldBounds,
            newBounds,
          ),
        };
    }),
    effects: entities.effects.map((effect) => ({
      ...effect,
      x: clamp(
        project(effect.x, oldBounds.width, newBounds.width),
        0,
        newBounds.width,
      ),
      y: clamp(
        project(effect.y, oldBounds.height, newBounds.height),
        0,
        newBounds.height,
      ),
    })),
  };
}

export function getResizeUpdate(rectangle, oldBounds, entities) {
  if (rectangle.width <= 0 || rectangle.height <= 0) {
    return null;
  }

  const bounds = {
    width: rectangle.width,
    height: rectangle.height,
  };
  const changed = (
    oldBounds.width > 0
    && oldBounds.height > 0
    && (
      oldBounds.width !== bounds.width
      || oldBounds.height !== bounds.height
    )
  );

  return {
    bounds,
    entities: changed
      ? reprojectEntitiesForResize(entities, oldBounds, bounds)
      : entities,
  };
}

export function getLogicalPointerPosition(pointer, rectangle, bounds) {
  if (rectangle.width <= 0 || rectangle.height <= 0) {
    return null;
  }

  return {
    x: (pointer.x - rectangle.left) * (bounds.width / rectangle.width),
    y: (pointer.y - rectangle.top) * (bounds.height / rectangle.height),
  };
}

export function createDart(origin, target) {
  const offsetX = target.x - origin.x;
  const offsetY = target.y - origin.y;
  const distance = Math.hypot(offsetX, offsetY);
  const direction = distance === 0
    ? { x: 0, y: 0 }
    : { x: offsetX / distance, y: offsetY / distance };

  return {
    x: origin.x,
    y: origin.y,
    previousX: origin.x,
    previousY: origin.y,
    direction,
    speed: DART_SPEED,
    active: true,
  };
}

export function advanceDart(dart, deltaSeconds) {
  return {
    ...dart,
    previousX: dart.x,
    previousY: dart.y,
    x: dart.x + dart.direction.x * dart.speed * deltaSeconds,
    y: dart.y + dart.direction.y * dart.speed * deltaSeconds,
  };
}

export function advanceCombatState({
  round,
  balloons: startingBalloons,
  heartPickups: startingHeartPickups,
  darts,
  effects: startingEffects,
  bounds,
  deltaSeconds,
  nextEntityId: startingEntityId,
  spawnLineY,
}) {
  let currentRound = round;
  let balloons = startingBalloons;
  let heartPickups = startingHeartPickups;
  let nextEntityId = startingEntityId;
  const effects = [...startingEffects];
  const survivingDarts = [];

  for (const dart of darts) {
    const advanced = {
      ...advanceDart(dart, deltaSeconds),
      age: dart.age + deltaSeconds,
    };
    const circles = [
      ...balloons
        .filter((balloon) => isEntityHittable(balloon, spawnLineY))
        .map((balloon) => ({ ...balloon, kind: 'balloon' })),
      ...heartPickups
        .filter((pickup) => isEntityHittable(pickup, spawnLineY))
        .map((pickup) => ({ ...pickup, kind: 'heart' })),
    ];
    const hit = firstSegmentCircleHit(
      { x: advanced.previousX, y: advanced.previousY },
      { x: advanced.x, y: advanced.y },
      circles,
    );

    if (hit !== null) {
      const hitPosition = {
        x: advanced.previousX
          + (advanced.x - advanced.previousX) * hit.t,
        y: advanced.previousY
          + (advanced.y - advanced.previousY) * hit.t,
      };

      effects.push({
        id: nextEntityId++,
        type: 'burst',
        ...hitPosition,
        age: 0,
        duration: HIT_EFFECT_SECONDS,
      });

      if (hit.kind === 'balloon') {
        balloons = balloons.filter((balloon) => balloon.id !== hit.id);
        const resolution = resolveBalloonHit(currentRound, hit.letter);

        effects.push({
          ...createHitFeedback('balloon', resolution, hitPosition),
          id: nextEntityId++,
        });
        currentRound = {
          ...currentRound,
          score: resolution.score,
          health: resolution.health,
          correctHits: (
            currentRound.correctHits + (resolution.correct ? 1 : 0)
          ),
          wrongHits: (
            currentRound.wrongHits + (resolution.correct ? 0 : 1)
          ),
        };

        if (shouldEndRound(currentRound)) {
          break;
        }
      } else {
        heartPickups = heartPickups.filter((pickup) => pickup.id !== hit.id);
        const resolution = resolveHeartHit(currentRound);

        effects.push({
          ...createHitFeedback('heart', resolution, hitPosition),
          id: nextEntityId++,
        });
        currentRound = {
          ...currentRound,
          score: resolution.score,
          health: resolution.health,
        };
      }

      continue;
    }

    const outside = (
      advanced.x < -60
      || advanced.x > bounds.width + 60
      || advanced.y < -60
      || advanced.y > bounds.height + 60
    );

    if (!outside && advanced.age < DART_LIFETIME_SECONDS) {
      survivingDarts.push(advanced);
    }
  }

  const resolvedRound = {
    ...currentRound,
    balloons,
    darts: survivingDarts,
    effects,
  };

  return {
    round: resolvedRound,
    balloons,
    heartPickups,
    darts: survivingDarts,
    effects,
    nextEntityId,
  };
}

export function isEntityHittable(entity, spawnLineY) {
  return !Number.isFinite(spawnLineY)
    || entity.y + entity.radius <= spawnLineY;
}

export function selectBalloonLetter(
  randomValue,
  targetLetters,
  preferredTargetRatio,
) {
  if (
    !Array.isArray(targetLetters)
    || targetLetters.length !== 2
    || new Set(targetLetters).size !== 2
    || !targetLetters.every((letter) => BALLOON_LETTERS.includes(letter))
    || !Number.isFinite(preferredTargetRatio)
  ) {
    const letterIndex = Math.min(
      BALLOON_LETTERS.length - 1,
      Math.floor(randomValue * BALLOON_LETTERS.length),
    );

    return BALLOON_LETTERS[letterIndex];
  }

  const ratio = clamp(preferredTargetRatio, 0, 1);
  const preferred = randomValue < ratio;
  const letters = preferred
    ? targetLetters
    : BALLOON_LETTERS.filter((letter) => !targetLetters.includes(letter));
  const rangeStart = preferred ? 0 : ratio;
  const rangeSize = preferred ? ratio : 1 - ratio;
  const normalizedValue = rangeSize === 0
    ? 0
    : (randomValue - rangeStart) / rangeSize;
  const letterIndex = Math.min(
    letters.length - 1,
    Math.floor(normalizedValue * letters.length),
  );

  return letters[letterIndex];
}

export function createBalloon(
  bounds,
  elapsedSeconds,
  random,
  spawnLineY,
  letterPlan,
) {
  const letterRandom = random();
  const xRandom = random();
  const phaseRandom = random();
  const speedRandom = random();
  const edges = getEdges(bounds);
  const difficulty = getDifficulty(elapsedSeconds);
  const minimumX = edges.left + BALLOON_RADIUS;
  const maximumX = edges.right - BALLOON_RADIUS;
  const x = clampBalloonX(
    minimumX + (maximumX - minimumX) * xRandom,
    BALLOON_RADIUS,
    edges,
  );

  return {
    letter: selectBalloonLetter(
      letterRandom,
      letterPlan?.targetLetters,
      letterPlan?.preferredTargetRatio,
    ),
    x,
    baseX: x,
    y: (spawnLineY ?? edges.bottom) + BALLOON_RADIUS,
    radius: BALLOON_RADIUS,
    speed: (
      BALLOON_MIN_SPEED + BALLOON_SPEED_RANGE * speedRandom
    ) * difficulty.speedMultiplier,
    swayPhase: phaseRandom * Math.PI * 2,
    swayAmplitude: BALLOON_SWAY_AMPLITUDE,
    escaped: false,
  };
}

export function createBalloonAvoiding(
  bounds,
  elapsedSeconds,
  existingEntities,
  random = Math.random,
  spawnLineY,
  letterPlan,
) {
  const balloon = createBalloon(
    bounds,
    elapsedSeconds,
    random,
    spawnLineY,
    letterPlan,
  );
  const position = findAvoidingSpawnPosition(
    bounds,
    balloon.radius,
    existingEntities,
    random,
    spawnLineY,
  );

  return {
    ...balloon,
    x: position.x,
    baseX: position.x,
    y: position.y,
  };
}

export function createInitialBalloons({
  bounds,
  count,
  elapsedSeconds,
  random = Math.random,
  spawnLineY,
}) {
  const edges = getEdges(bounds);
  const laneCount = Math.min(3, Math.max(1, count));

  return Array.from({ length: count }, (_, index) => {
    const balloon = createBalloon(
      bounds,
      elapsedSeconds,
      random,
      spawnLineY,
    );
    const lane = index % laneCount;
    const row = Math.floor(index / laneCount);
    const laneX = edges.left
      + (edges.right - edges.left) * ((lane + 1) / (laneCount + 1));
    const lowerRowY = Math.max(
      edges.top + balloon.radius,
      spawnLineY - balloon.radius - 74,
    );
    const rowY = Math.max(
      edges.top + balloon.radius,
      lowerRowY - row * (balloon.radius * 2 + 46),
    );

    return {
      ...balloon,
      x: laneX,
      baseX: laneX,
      y: Math.min(rowY, spawnLineY - balloon.radius),
    };
  });
}

export function advanceBalloon(balloon, deltaSeconds, bounds) {
  const edges = getEdges(bounds);
  const y = balloon.y - balloon.speed * deltaSeconds;
  const swayPhase = (
    balloon.swayPhase + BALLOON_SWAY_RADIANS_PER_SECOND * deltaSeconds
  );
  const x = clampBalloonX(
    balloon.baseX + Math.sin(swayPhase) * balloon.swayAmplitude,
    balloon.radius,
    edges,
  );

  return {
    ...balloon,
    x,
    y,
    swayPhase,
    escaped: balloon.escaped || y + balloon.radius < edges.top,
  };
}

export function getHeartSpawnDelay(random = Math.random) {
  return 10 + random() * 6;
}

export function createHeartPickup(
  bounds,
  random = Math.random,
  spawnLineY,
) {
  const edges = getEdges(bounds);
  const minimumX = edges.left + HEART_RADIUS;
  const maximumX = edges.right - HEART_RADIUS;
  const x = clampBalloonX(
    minimumX + (maximumX - minimumX) * random(),
    HEART_RADIUS,
    edges,
  );

  return {
    x,
    y: (spawnLineY ?? edges.bottom) + HEART_RADIUS,
    radius: HEART_RADIUS,
    speed: HEART_SPEED,
    escaped: false,
  };
}

export function createHeartPickupAvoiding(
  bounds,
  existingEntities,
  random = Math.random,
  spawnLineY,
) {
  const pickup = createHeartPickup(bounds, random, spawnLineY);
  const position = findAvoidingSpawnPosition(
    bounds,
    pickup.radius,
    existingEntities,
    random,
    spawnLineY,
  );

  return {
    ...pickup,
    x: position.x,
    y: position.y,
  };
}

export function advanceHeartPickup(pickup, deltaSeconds, bounds) {
  const edges = getEdges(bounds);
  const y = pickup.y - pickup.speed * deltaSeconds;

  return {
    ...pickup,
    y,
    escaped: pickup.escaped || y + pickup.radius < edges.top,
  };
}

export function createHitFeedback(targetKind, resolution, position) {
  let text;
  let color;

  if (targetKind === 'balloon') {
    text = resolution.correct ? '+1' : '-1';
    color = resolution.correct ? '#fff176' : '#ff6b6b';
  } else {
    text = resolution.healed ? '+♥' : '+1';
    color = resolution.healed ? '#ff8fab' : '#fff176';
  }

  return {
    type: 'feedback',
    text,
    color,
    x: position.x,
    y: position.y,
    age: 0,
    duration: FEEDBACK_DURATION_SECONDS,
    riseSpeed: FEEDBACK_RISE_SPEED,
    opacity: 1,
  };
}

export function advanceFeedbackEffect(effect, deltaSeconds) {
  const age = Math.min(effect.duration, effect.age + deltaSeconds);

  return {
    ...effect,
    y: effect.y - effect.riseSpeed * deltaSeconds,
    age,
    opacity: Math.max(0, 1 - age / effect.duration),
  };
}
