import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  GAME_ASSETS,
  ROUND_SECONDS,
} from './config.js';
import {
  advanceCombatState,
  advanceFeedbackEffect,
  advanceBalloon,
  advanceHeartPickup,
  createBalloonAvoiding,
  createDart,
  createHeartPickupAvoiding,
  createInitialBalloons,
  getBackgroundDrawPlan,
  getCharacterDartOrigin,
  getCharacterDrawPlan,
  getDartBurstSourceRect,
  getFrameStepPlan,
  getHeartSpawnDelay,
  getLogicalPointerPosition,
  getResizeUpdate,
  getTargetIndicatorDrawPlan,
  isEntityHittable,
} from './engine.js';
import {
  createRoundState,
  getBalloonSpawnPlan,
  getTargetLetters,
  shouldEndRound,
  tickRound,
} from './rules.js';

const BALLOON_SPRITE_ORDER = ['d', 'k', 'e', 'c'];

function getSpawnLineY(images, bounds) {
  return getBackgroundDrawPlan(
    {
      width: images.background.naturalWidth,
      height: images.background.naturalHeight,
    },
    bounds,
  ).wall.destination.y;
}

function preloadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load game asset: ${source}`));
    image.src = source;
  });
}

async function preloadGameImages(characterId) {
  const entries = [
    ['background', GAME_ASSETS.background],
    ['balloons', GAME_ASSETS.balloons],
    ['heart', GAME_ASSETS.heart],
    ['dartBurst', GAME_ASSETS.dartBurst],
    ['character', GAME_ASSETS.characters[characterId].gameplay],
  ];
  const images = await Promise.all(
    entries.map(async ([key, source]) => [key, await preloadImage(source)]),
  );

  return Object.fromEntries(images);
}

function getRoundSummary(state) {
  return {
    characterId: state.characterId,
    mode: state.mode,
    score: state.score,
    health: state.health,
    remainingSeconds: Math.ceil(state.remainingSeconds),
    correctHits: state.correctHits,
    wrongHits: state.wrongHits,
  };
}

function summariesMatch(left, right) {
  return (
    left !== null
    && left.characterId === right.characterId
    && left.mode === right.mode
    && left.score === right.score
    && left.health === right.health
    && left.remainingSeconds === right.remainingSeconds
    && left.correctHits === right.correctHits
    && left.wrongHits === right.wrongHits
  );
}

function drawImageCover(
  context,
  image,
  sourceRectangle,
  destinationRectangle,
) {
  const sourceRatio = sourceRectangle.width / sourceRectangle.height;
  const destinationRatio = (
    destinationRectangle.width / destinationRectangle.height
  );
  let sourceWidth = sourceRectangle.width;
  let sourceHeight = sourceRectangle.height;
  let sourceX = sourceRectangle.x;
  let sourceY = sourceRectangle.y;

  if (sourceRatio > destinationRatio) {
    sourceWidth = sourceRectangle.height * destinationRatio;
    sourceX += (sourceRectangle.width - sourceWidth) / 2;
  } else {
    sourceHeight = sourceRectangle.width / destinationRatio;
    sourceY += (sourceRectangle.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destinationRectangle.x,
    destinationRectangle.y,
    destinationRectangle.width,
    destinationRectangle.height,
  );
}

function drawBakedWallForeground(context, image, wallPlan) {
  const { source, destination } = wallPlan;

  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );
}

function drawBalloon(context, spriteSheet, balloon) {
  const spriteIndex = BALLOON_SPRITE_ORDER.indexOf(balloon.letter);
  const cellWidth = spriteSheet.naturalWidth / BALLOON_SPRITE_ORDER.length;
  const width = balloon.radius * 2.2;
  const height = balloon.radius * 3.25;

  context.drawImage(
    spriteSheet,
    spriteIndex * cellWidth,
    0,
    cellWidth,
    spriteSheet.naturalHeight,
    balloon.x - width / 2,
    balloon.y - height * 0.42,
    width,
    height,
  );
}

function drawBalloonLetter(context, balloon) {
  const fontSize = Math.max(22, balloon.radius);
  context.save();
  context.font = `900 ${fontSize}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 5;
  context.strokeStyle = 'rgba(20, 32, 45, 0.9)';
  context.fillStyle = '#ffffff';
  context.strokeText(balloon.letter.toUpperCase(), balloon.x, balloon.y - 4);
  context.fillText(balloon.letter.toUpperCase(), balloon.x, balloon.y - 4);
  context.restore();
}

function drawHeart(context, image, pickup) {
  const size = pickup.radius * 2.5;
  context.drawImage(
    image,
    pickup.x - size / 2,
    pickup.y - size / 2,
    size,
    size,
  );
}

function drawCharacter(context, image, bounds, wallTop) {
  const destination = getCharacterDrawPlan(
    {
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
    bounds,
    wallTop,
  );

  context.drawImage(
    image,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  );

  return destination;
}

function drawTargetIndicator(
  context,
  spriteSheet,
  characterId,
  characterPlan,
  bounds,
) {
  const plan = getTargetIndicatorDrawPlan(characterPlan, bounds);
  const targetLetters = getTargetLetters(characterId);

  context.save();
  context.fillStyle = 'rgba(11, 34, 21, 0.9)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(plan.x, plan.y, plan.width, plan.height, 14);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffe392';
  context.font = '900 13px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('目標', plan.x + plan.width / 2, plan.y + 14);

  targetLetters.forEach((letter, index) => {
    const balloon = {
      letter,
      x: plan.x + plan.width * (index === 0 ? 0.32 : 0.68),
      y: plan.y + 54,
      radius: 14,
    };

    drawBalloon(context, spriteSheet, balloon);
    drawBalloonLetter(context, balloon);
  });
  context.restore();
}

function drawDart(context, spriteSheet, dart) {
  const angle = Math.atan2(dart.direction.y, dart.direction.x) + Math.PI / 4;
  const source = getDartBurstSourceRect('dart');

  context.save();
  context.translate(dart.x, dart.y);
  context.rotate(angle);
  context.drawImage(
    spriteSheet,
    source.x,
    source.y,
    source.width,
    source.height,
    -28,
    -28,
    56,
    56,
  );
  context.restore();
}

function drawBurst(context, spriteSheet, effect) {
  const progress = Math.min(0.999, effect.age / effect.duration);
  const frame = Math.floor(progress * 4);
  const source = getDartBurstSourceRect('burst', frame);
  const size = 96 + progress * 28;

  context.drawImage(
    spriteSheet,
    source.x,
    source.y,
    source.width,
    source.height,
    effect.x - size / 2,
    effect.y - size / 2,
    size,
    size,
  );
}

function drawFeedback(context, effect) {
  context.save();
  context.globalAlpha = effect.opacity;
  context.font = '900 32px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = 6;
  context.strokeStyle = 'rgba(20, 32, 45, 0.9)';
  context.fillStyle = effect.color;
  context.strokeText(effect.text, effect.x, effect.y);
  context.fillText(effect.text, effect.x, effect.y);
  context.restore();
}

function drawFrame(
  context,
  bounds,
  images,
  balloons,
  heartPickups,
  darts,
  effects,
  characterId,
) {
  const backgroundPlan = getBackgroundDrawPlan(
    {
      width: images.background.naturalWidth,
      height: images.background.naturalHeight,
    },
    bounds,
  );

  context.clearRect(0, 0, bounds.width, bounds.height);
  drawImageCover(
    context,
    images.background,
    backgroundPlan.upper.source,
    backgroundPlan.upper.destination,
  );

  balloons.forEach((balloon) => drawBalloon(context, images.balloons, balloon));
  heartPickups.forEach((pickup) => drawHeart(context, images.heart, pickup));
  balloons.forEach((balloon) => drawBalloonLetter(context, balloon));

  drawBakedWallForeground(
    context,
    images.background,
    backgroundPlan.wall,
  );
  const characterPlan = drawCharacter(
    context,
    images.character,
    bounds,
    backgroundPlan.wall.destination.y,
  );
  drawTargetIndicator(
    context,
    images.balloons,
    characterId,
    characterPlan,
    bounds,
  );

  darts.forEach((dart) => drawDart(context, images.dartBurst, dart));
  effects.forEach((effect) => {
    if (effect.type === 'feedback') {
      drawFeedback(context, effect);
    } else {
      drawBurst(context, images.dartBurst, effect);
    }
  });
}

export default function GameCanvas({
  characterId,
  mode,
  onRoundEnd,
  onStateChange,
  paused = false,
}) {
  const canvasRef = useRef(null);
  const boundsRef = useRef({ width: 0, height: 0 });
  const imagesRef = useRef(null);
  const roundRef = useRef(createRoundState(characterId, mode));
  const balloonsRef = useRef([]);
  const heartPickupsRef = useRef([]);
  const dartsRef = useRef([]);
  const effectsRef = useRef([]);
  const nextEntityIdRef = useRef(1);
  const nextHeartAtRef = useRef(null);
  const pausedRef = useRef(paused);
  const documentHiddenRef = useRef(false);
  const endedRef = useRef(false);
  const lastSummaryRef = useRef(null);
  const onRoundEndRef = useRef(onRoundEnd);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onRoundEndRef.current = onRoundEnd;
    onStateChangeRef.current = onStateChange;
  }, [onRoundEnd, onStateChange]);

  const emitState = useCallback((state, force = false) => {
    const summary = getRoundSummary(state);

    if (force || !summariesMatch(lastSummaryRef.current, summary)) {
      lastSummaryRef.current = summary;
      onStateChangeRef.current?.(summary);
    }

    return summary;
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (
      event.defaultPrevented
      || event.nativeEvent?.defaultPrevented
      || event.isPrimary === false
      || (event.pointerType === 'mouse' && event.button !== 0)
      || pausedRef.current
      || documentHiddenRef.current
      || endedRef.current
      || imagesRef.current === null
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const bounds = boundsRef.current;

    if (canvas === null || bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const rectangle = canvas.getBoundingClientRect();
    const target = getLogicalPointerPosition(
      { x: event.clientX, y: event.clientY },
      rectangle,
      bounds,
    );

    if (target === null) {
      return;
    }

    const backgroundPlan = getBackgroundDrawPlan(
      {
        width: imagesRef.current.background.naturalWidth,
        height: imagesRef.current.background.naturalHeight,
      },
      bounds,
    );
    const characterPlan = getCharacterDrawPlan(
      {
        width: imagesRef.current.character.naturalWidth,
        height: imagesRef.current.character.naturalHeight,
      },
      bounds,
      backgroundPlan.wall.destination.y,
    );
    const dart = createDart(getCharacterDartOrigin(characterPlan), target);

    dartsRef.current.push({
      ...dart,
      id: nextEntityIdRef.current++,
      age: 0,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return undefined;
    }

    let active = true;
    let animationFrame = null;
    let lastTimestamp = null;
    const context = canvas.getContext('2d');
    const round = createRoundState(characterId, mode);

    roundRef.current = round;
    balloonsRef.current = round.balloons;
    heartPickupsRef.current = [];
    dartsRef.current = round.darts;
    effectsRef.current = round.effects;
    nextEntityIdRef.current = 1;
    nextHeartAtRef.current = getHeartSpawnDelay();
    imagesRef.current = null;
    endedRef.current = false;
    lastSummaryRef.current = null;
    emitState(round, true);

    let initialBalloonsSeeded = false;

    const seedInitialBalloons = () => {
      const bounds = boundsRef.current;
      const images = imagesRef.current;

      if (
        initialBalloonsSeeded
        || images === null
        || bounds.width <= 0
        || bounds.height <= 0
      ) {
        return;
      }

      const spawnLineY = getSpawnLineY(images, bounds);
      const initialBalloons = createInitialBalloons({
        bounds,
        count: 6,
        elapsedSeconds: 0,
        random: Math.random,
        spawnLineY,
      }).map((balloon) => ({
        ...balloon,
        id: nextEntityIdRef.current++,
      }));

      initialBalloonsSeeded = true;
      balloonsRef.current = initialBalloons;
      roundRef.current = {
        ...roundRef.current,
        balloons: initialBalloons,
      };
    };

    const resizeCanvas = () => {
      const rectangle = canvas.getBoundingClientRect();
      const resizeUpdate = getResizeUpdate(
        rectangle,
        boundsRef.current,
        {
          balloons: balloonsRef.current,
          heartPickups: heartPickupsRef.current,
          darts: dartsRef.current,
          effects: effectsRef.current,
        },
      );

      if (resizeUpdate === null) {
        return;
      }

      const { bounds: newBounds, entities } = resizeUpdate;
      const { width, height } = newBounds;
      const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const backingWidth = Math.round(width * devicePixelRatio);
      const backingHeight = Math.round(height * devicePixelRatio);

      balloonsRef.current = entities.balloons;
      heartPickupsRef.current = entities.heartPickups;
      dartsRef.current = entities.darts;
      effectsRef.current = entities.effects;
      roundRef.current = {
        ...roundRef.current,
        balloons: entities.balloons,
        darts: entities.darts,
        effects: entities.effects,
      };

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0,
      );
      boundsRef.current = newBounds;
      seedInitialBalloons();
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    let devControls = null;
    let randomSpawnsAllowed = true;

    const getCurrentSpawnLineY = () => (
      imagesRef.current === null
        ? null
        : getSpawnLineY(imagesRef.current, boundsRef.current)
    );

    if (import.meta.env.DEV) {
      devControls = {
        getSnapshot: () => ({
          ...getRoundSummary(roundRef.current),
          spawnLineY: getCurrentSpawnLineY(),
          balloons: balloonsRef.current.map(({ id, letter, x, y, radius }) => ({
            id,
            letter,
            x,
            y,
            hittable: isEntityHittable(
              { y, radius },
              getCurrentSpawnLineY(),
            ),
          })),
          hearts: heartPickupsRef.current.map(({ id, x, y, radius }) => ({
            id,
            x,
            y,
            hittable: isEntityHittable(
              { y, radius },
              getCurrentSpawnLineY(),
            ),
          })),
          dartCount: dartsRef.current.length,
          effectCount: effectsRef.current.length,
          ended: endedRef.current,
          bounds: { ...boundsRef.current },
        }),
        releaseSpawns: () => {
          randomSpawnsAllowed = true;
        },
        setScenario: ({
          balloons = [],
          hearts = [],
          holdSpawns = true,
          ...state
        } = {}) => {
          const preparedBalloons = balloons.map((balloon) => ({
            id: balloon.id ?? nextEntityIdRef.current++,
            letter: balloon.letter,
            x: balloon.x,
            baseX: balloon.baseX ?? balloon.x,
            y: balloon.y,
            radius: balloon.radius ?? 28,
            speed: balloon.speed ?? 0,
            swayPhase: balloon.swayPhase ?? 0,
            swayAmplitude: balloon.swayAmplitude ?? 0,
            escaped: false,
          }));
          const preparedHearts = hearts.map((heart) => ({
            id: heart.id ?? nextEntityIdRef.current++,
            x: heart.x,
            y: heart.y,
            radius: heart.radius ?? 26,
            speed: heart.speed ?? 0,
            escaped: false,
          }));

          randomSpawnsAllowed = !holdSpawns;
          balloonsRef.current = preparedBalloons;
          heartPickupsRef.current = preparedHearts;
          dartsRef.current = [];
          effectsRef.current = [];
          roundRef.current = {
            ...roundRef.current,
            ...state,
            balloons: preparedBalloons,
            darts: [],
            effects: [],
          };
          emitState(roundRef.current, true);
        },
      };
      window.__DKEC_GAME_TEST__ = devControls;
    }

    const handleVisibilityChange = () => {
      documentHiddenRef.current = document.hidden;
      lastTimestamp = null;
    };

    documentHiddenRef.current = document.hidden;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const finishRound = () => {
      if (endedRef.current) {
        return;
      }

      endedRef.current = true;
      const summary = emitState(roundRef.current, true);
      onRoundEndRef.current?.(summary);
    };

    const stepPhysics = (startingRound, deltaSeconds) => {
      let currentRound = startingRound;
      const elapsedSeconds = ROUND_SECONDS - currentRound.remainingSeconds;
      const bounds = boundsRef.current;
      const spawnPlan = getBalloonSpawnPlan({
        elapsedSeconds,
        remainingSeconds: currentRound.remainingSeconds,
        score: currentRound.score,
      });
      const spawnLineY = getSpawnLineY(imagesRef.current, bounds);
      let balloons = balloonsRef.current
        .map((balloon) => advanceBalloon(balloon, deltaSeconds, bounds))
        .filter((balloon) => !balloon.escaped);
      let heartPickups = heartPickupsRef.current
        .map((pickup) => advanceHeartPickup(pickup, deltaSeconds, bounds))
        .filter((pickup) => !pickup.escaped);

      while (
        randomSpawnsAllowed
        && balloons.length < spawnPlan.targetCount
      ) {
        balloons.push({
          ...createBalloonAvoiding(
            bounds,
            elapsedSeconds,
            [...balloons, ...heartPickups],
            Math.random,
            spawnLineY,
            {
              targetLetters: getTargetLetters(characterId),
              preferredTargetRatio: spawnPlan.preferredTargetRatio,
            },
          ),
          id: nextEntityIdRef.current++,
        });
      }

      if (
        randomSpawnsAllowed
        && elapsedSeconds >= nextHeartAtRef.current
      ) {
        heartPickups.push({
          ...createHeartPickupAvoiding(
            bounds,
            [...balloons, ...heartPickups],
            Math.random,
            spawnLineY,
          ),
          id: nextEntityIdRef.current++,
        });
        nextHeartAtRef.current += getHeartSpawnDelay();
      }

      const effects = effectsRef.current
        .map((effect) => (
          effect.type === 'feedback'
            ? advanceFeedbackEffect(effect, deltaSeconds)
            : { ...effect, age: effect.age + deltaSeconds }
        ))
        .filter((effect) => effect.age < effect.duration);

      const combat = advanceCombatState({
        round: currentRound,
        balloons,
        heartPickups,
        darts: dartsRef.current,
        effects,
        bounds,
        deltaSeconds,
        nextEntityId: nextEntityIdRef.current,
        spawnLineY,
      });

      currentRound = combat.round;
      balloons = combat.balloons;
      heartPickups = combat.heartPickups;
      nextEntityIdRef.current = combat.nextEntityId;

      balloonsRef.current = balloons;
      heartPickupsRef.current = heartPickups;
      dartsRef.current = combat.darts;
      effectsRef.current = combat.effects;
      roundRef.current = currentRound;
      return roundRef.current;
    };

    const update = (roundDeltaSeconds, physicsSteps) => {
      let currentRound = tickRound(
        roundRef.current,
        roundDeltaSeconds,
      );

      for (const physicsDeltaSeconds of physicsSteps) {
        if (shouldEndRound(currentRound)) {
          break;
        }

        currentRound = stepPhysics(
          currentRound,
          physicsDeltaSeconds,
        );
      }

      roundRef.current = {
        ...currentRound,
        balloons: balloonsRef.current,
        darts: dartsRef.current,
        effects: effectsRef.current,
      };
      emitState(roundRef.current);
    };

    const frame = (timestamp) => {
      if (!active || endedRef.current) {
        return;
      }

      if (
        pausedRef.current
        || documentHiddenRef.current
        || boundsRef.current.width <= 0
        || boundsRef.current.height <= 0
      ) {
        lastTimestamp = timestamp;
        animationFrame = requestAnimationFrame(frame);
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      } else {
        const elapsedSeconds = Math.max(
          0,
          (timestamp - lastTimestamp) / 1000,
        );
        const stepPlan = getFrameStepPlan(elapsedSeconds, true);

        lastTimestamp = timestamp;
        update(
          stepPlan.roundDeltaSeconds,
          stepPlan.physicsSteps,
        );
      }

      drawFrame(
        context,
        boundsRef.current,
        imagesRef.current,
        balloonsRef.current,
        heartPickupsRef.current,
        dartsRef.current,
        effectsRef.current,
        characterId,
      );

      if (shouldEndRound(roundRef.current)) {
        finishRound();
        return;
      }

      animationFrame = requestAnimationFrame(frame);
    };

    preloadGameImages(characterId)
      .then((images) => {
        if (!active) {
          return;
        }

        imagesRef.current = images;
        resizeCanvas();
        seedInitialBalloons();
        animationFrame = requestAnimationFrame(frame);
      })
      .catch((error) => {
        if (active) {
          console.error(error);
        }
      });

    return () => {
      active = false;
      endedRef.current = true;
      imagesRef.current = null;
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (
        import.meta.env.DEV
        && window.__DKEC_GAME_TEST__ === devControls
      ) {
        delete window.__DKEC_GAME_TEST__;
      }

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [characterId, emitState, mode]);

  return (
    <canvas
      aria-label="DKEC balloon training game"
      onPointerDown={handlePointerDown}
      ref={canvasRef}
      role="img"
      style={{
        display: 'block',
        height: '100%',
        touchAction: 'none',
        width: '100%',
      }}
    />
  );
}
