# Adaptive Assist and Google Sheets Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add next-grade progress, a score-aware final-ten-second balloon assist, and an optional top-20 Google Sheets leaderboard without changing the established combat, health, reward, speed, or wall-gating rules.

**Architecture:** Keep score and spawn decisions as pure functions in `src/game/rules.js`, and keep weighted letter selection in `src/game/engine.js`. Add a self-contained leaderboard area with pure validation/sorting rules, a DOM transport that uses JSONP for public reads and a hidden POST form for writes, and a React component embedded in the results screen. Deliver a Google Apps Script web app that owns validation, deduplication, ranking, and Sheet writes.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Canvas 2D, Node `node:test`, Google Apps Script V8, Google Sheets.

## Global Constraints

- Preserve the 60-second round, five-heart maximum, existing hit scoring, heart behavior, reward links, and D/K versus E/C target rules.
- Preserve the existing 1, 1.15, and 1.3 speed multipliers; final-ten-second assistance must not add speed.
- Preserve the wall start line and the rule that an entity is hittable only after fully clearing the line.
- Use no new npm dependencies.
- Keep the app standalone under `balloon-game/` and preserve single-file HTML export.
- The Apps Script web app is anonymous and public; collect no email, IP, Google identity, or personal fields beyond the optional nickname.
- The leaderboard shows 20 rows and keeps one best result per normalized nickname.
- This directory is not a Git repository. Do not initialize Git or fabricate commit steps; finish every task with fresh tests as the checkpoint.
- The approved design is `docs/superpowers/specs/2026-07-17-adaptive-assist-leaderboard-design.md`.

---

## File Map

**Create**

- `src/leaderboard/config.js` — deployed `/exec` URL, intentionally empty until deployment.
- `src/leaderboard/rules.js` — nickname validation, normalization, ranking comparison, and payload shaping.
- `src/leaderboard/client.js` — JSONP list request and hidden-form POST submission.
- `src/components/Leaderboard.jsx` — optional nickname form, status messages, retry, and top-20 table.
- `tests/leaderboard.test.mjs` — pure leaderboard behavior.
- `tests/leaderboard-client.test.mjs` — URL and submission payload behavior.
- `google-apps-script/Code.gs` — complete Apps Script backend.
- `google-apps-script/部署說明.md` — Chinese setup and deployment handoff.

**Modify**

- `src/game/rules.js` — `getScoreProgress` and `getBalloonSpawnPlan`.
- `src/game/engine.js` — deterministic weighted balloon-letter choice.
- `src/game/GameCanvas.jsx` — use the score-aware spawn plan for replenishment.
- `src/components/Results.jsx` — next-grade message and leaderboard.
- `src/styles.css` — progress, form, statuses, and responsive ranking list.
- `tests/rules.test.mjs` — score and assist boundaries.
- `tests/combat.test.mjs` — weighted target selection.
- `tests/contract.test.mjs` — UI, transport, Apps Script, and unchanged-speed contracts.
- `AGENTS.md` — remove only the obsolete no-leaderboard restriction.

---

### Task 1: Score progress and final-ten-second spawn plan

**Files:**
- Modify: `src/game/rules.js`
- Test: `tests/rules.test.mjs`

**Interfaces:**
- Produces: `getScoreProgress(score: number) -> { currentGrade, nextGrade, pointsToNext, isTopGrade }`
- Produces: `getBalloonSpawnPlan({ elapsedSeconds, remainingSeconds, score }) -> { targetCount, speedMultiplier, preferredTargetRatio, assistGoal }`
- Preserves: `getDifficulty(elapsedSeconds)` and all existing exports.

- [ ] **Step 1: Add failing score-progress tests**

Import `getScoreProgress` and assert the exact boundaries:

```js
assert.deepEqual(getScoreProgress(-2), {
  currentGrade: getScoreGrade(-2),
  nextGrade: getScoreGrade(10),
  pointsToNext: 12,
  isTopGrade: false,
});
assert.equal(getScoreProgress(9).pointsToNext, 1);
assert.equal(getScoreProgress(10).pointsToNext, 15);
assert.equal(getScoreProgress(25).pointsToNext, 15);
assert.equal(getScoreProgress(40).pointsToNext, 15);
assert.deepEqual(getScoreProgress(55), {
  currentGrade: getScoreGrade(55),
  nextGrade: null,
  pointsToNext: 0,
  isTopGrade: true,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/rules.test.mjs`

Expected: FAIL because `getScoreProgress` is not exported.

- [ ] **Step 3: Implement `getScoreProgress` minimally**

Add below `getScoreGrade`:

```js
export function getScoreProgress(score) {
  const currentGrade = getScoreGrade(score);
  const currentIndex = SCORE_GRADES.findIndex(
    (grade) => grade.id === currentGrade.id,
  );

  if (currentIndex === 0) {
    return {
      currentGrade,
      nextGrade: null,
      pointsToNext: 0,
      isTopGrade: true,
    };
  }

  const nextGrade = SCORE_GRADES[currentIndex - 1];

  return {
    currentGrade,
    nextGrade,
    pointsToNext: nextGrade.minimum - score,
    isTopGrade: false,
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/rules.test.mjs`

Expected: all rules tests pass.

- [ ] **Step 5: Add failing spawn-plan boundary tests**

```js
assert.deepEqual(getBalloonSpawnPlan({
  elapsedSeconds: 49,
  remainingSeconds: 11,
  score: 0,
}), {
  targetCount: 12,
  speedMultiplier: 1.3,
  preferredTargetRatio: 0.5,
  assistGoal: null,
});

for (const [score, targetCount, assistGoal] of [
  [0, 20, 40],
  [25, 18, 40],
  [39, 15, 40],
  [40, 18, 55],
  [54, 15, 55],
]) {
  assert.deepEqual(getBalloonSpawnPlan({
    elapsedSeconds: 50,
    remainingSeconds: 10,
    score,
  }), {
    targetCount,
    speedMultiplier: 1.3,
    preferredTargetRatio: 0.8,
    assistGoal,
  });
}

assert.deepEqual(getBalloonSpawnPlan({
  elapsedSeconds: 50,
  remainingSeconds: 10,
  score: 55,
}), {
  targetCount: 14,
  speedMultiplier: 1.3,
  preferredTargetRatio: 0.5,
  assistGoal: null,
});
```

- [ ] **Step 6: Run the focused test and verify RED**

Run: `node --test tests/rules.test.mjs`

Expected: FAIL because `getBalloonSpawnPlan` is not exported.

- [ ] **Step 7: Implement `getBalloonSpawnPlan`**

```js
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
```

- [ ] **Step 8: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass with zero failures.

---

### Task 2: Weighted target-letter generation and canvas integration

**Files:**
- Modify: `src/game/engine.js`
- Modify: `src/game/GameCanvas.jsx`
- Test: `tests/combat.test.mjs`
- Test: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `getBalloonSpawnPlan(...)` and `getTargetLetters(characterId)`.
- Produces: `selectBalloonLetter(randomValue, targetLetters, preferredTargetRatio)`.
- Extends: `createBalloon(..., letterPlan?)` and `createBalloonAvoiding(..., letterPlan?)` with an optional final argument.

- [ ] **Step 1: Add failing weighted-letter tests**

```js
assert.equal(engine.selectBalloonLetter(0, ['e', 'c'], 0.8), 'e');
assert.equal(engine.selectBalloonLetter(0.79, ['e', 'c'], 0.8), 'c');
assert.equal(engine.selectBalloonLetter(0.8, ['e', 'c'], 0.8), 'd');
assert.equal(engine.selectBalloonLetter(0.999, ['e', 'c'], 0.8), 'k');
assert.deepEqual(
  [0, 0.25, 0.5, 0.75].map((value) => (
    engine.selectBalloonLetter(value, null, 0.5)
  )),
  ['d', 'k', 'e', 'c'],
);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/combat.test.mjs`

Expected: FAIL because `selectBalloonLetter` is missing.

- [ ] **Step 3: Implement weighted selection**

```js
export function selectBalloonLetter(
  randomValue,
  targetLetters = null,
  preferredTargetRatio = 0.5,
) {
  if (!Array.isArray(targetLetters) || targetLetters.length !== 2) {
    const index = Math.min(3, Math.floor(randomValue * 4));
    return BALLOON_LETTERS[index];
  }

  const wrongLetters = BALLOON_LETTERS.filter(
    (letter) => !targetLetters.includes(letter),
  );
  const useTargets = randomValue < preferredTargetRatio;
  const group = useTargets ? targetLetters : wrongLetters;
  const groupProgress = useTargets
    ? randomValue / preferredTargetRatio
    : (randomValue - preferredTargetRatio) / (1 - preferredTargetRatio);
  const index = Math.min(1, Math.floor(groupProgress * 2));

  return group[index];
}
```

Update `createBalloon` to use this function for `letter`, while preserving the current random-call order and the legacy uniform path when no plan is supplied. Thread the optional plan through `createBalloonAvoiding`.

- [ ] **Step 4: Run weighted-letter tests and verify GREEN**

Run: `node --test tests/combat.test.mjs`

Expected: all combat tests pass.

- [ ] **Step 5: Add a failing canvas contract for the assist plan**

Assert that `GameCanvas.jsx` imports and calls `getBalloonSpawnPlan`, passes `currentRound.score`, `currentRound.remainingSeconds`, `getTargetLetters(characterId)`, and `preferredTargetRatio` into replenishment. Keep the existing negative assertion that no `entrySpeedMultiplier` exists.

- [ ] **Step 6: Run the contract test and verify RED**

Run: `node --test tests/contract.test.mjs`

Expected: FAIL because the canvas still uses `getDifficulty` directly.

- [ ] **Step 7: Integrate the spawn plan in `GameCanvas.jsx`**

Replace the replenishment plan with:

```js
const spawnPlan = getBalloonSpawnPlan({
  elapsedSeconds,
  remainingSeconds: currentRound.remainingSeconds,
  score: currentRound.score,
});
const targetLetters = getTargetLetters(characterId);

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
        targetLetters,
        preferredTargetRatio: spawnPlan.preferredTargetRatio,
      },
    ),
    id: nextEntityIdRef.current++,
  });
}
```

Do not alter `advanceBalloon`, initial six-balloon seeding, wall gating, or speed calculation.

- [ ] **Step 8: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass with unchanged existing collision and timing coverage.

---

### Task 3: Next-grade message in Results

**Files:**
- Modify: `src/components/Results.jsx`
- Modify: `src/styles.css`
- Test: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `getScoreProgress(result.score)`.
- Produces: visible and accessible progress copy for top and non-top grades.

- [ ] **Step 1: Add failing source contracts**

Require the Results source to import `getScoreProgress`, render `progress.pointsToNext`, include `距離下一等級`, and include `已達最高等級 S`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/contract.test.mjs`

Expected: FAIL because the progress UI does not exist.

- [ ] **Step 3: Implement the message**

In `Results.jsx`:

```jsx
const progress = getScoreProgress(result.score);

<p className="results-progress" role="status">
  {progress.isTopGrade
    ? '恭喜！已達最高等級 S'
    : `距離下一等級 ${progress.nextGrade.id} 還差 ${progress.pointsToNext} 分`}
</p>
```

Place it immediately after the score summary. Style `.results-progress` as a high-contrast rounded strip that wraps on narrow screens.

- [ ] **Step 4: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 4: Pure leaderboard rules

**Files:**
- Create: `src/leaderboard/rules.js`
- Create: `tests/leaderboard.test.mjs`

**Interfaces:**
- Produces: `normalizeNickname(value)`.
- Produces: `validateNickname(value) -> { valid, nickname, normalizedNickname, error }`.
- Produces: `compareLeaderboardEntries(left, right)` for `Array.prototype.sort`.
- Produces: `isBetterLeaderboardEntry(candidate, existing)`.
- Produces: `createLeaderboardPayload({ nickname, result, requestId })`.

- [ ] **Step 1: Write failing validation and ranking tests**

Cover these exact cases:

```js
assert.equal(normalizeNickname('  Ａlice  '), 'alice');
assert.equal(validateNickname(' ').valid, false);
assert.equal(validateNickname('1234567890123').valid, false);
assert.equal(validateNickname('=SUM(A1)').valid, false);
assert.equal(validateNickname('小氣球').valid, true);

const sorted = [
  { nickname: '晚到', score: 40, wrongHits: 1, submittedAt: '2026-07-17T03:00:00.000Z' },
  { nickname: '少錯', score: 40, wrongHits: 0, submittedAt: '2026-07-17T04:00:00.000Z' },
  { nickname: '高分', score: 55, wrongHits: 3, submittedAt: '2026-07-17T05:00:00.000Z' },
].sort(compareLeaderboardEntries);
assert.deepEqual(sorted.map(({ nickname }) => nickname), ['高分', '少錯', '晚到']);
assert.equal(isBetterLeaderboardEntry(
  { score: 41, wrongHits: 2 },
  { score: 40, wrongHits: 0 },
), true);
assert.equal(isBetterLeaderboardEntry(
  { score: 40, wrongHits: 2 },
  { score: 40, wrongHits: 1 },
), false);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/leaderboard.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure rules**

Use NFKC normalization, `Array.from(nickname).length`, `/[\u0000-\u001f\u007f]/`, and `/^[=+\-@]/`. `createLeaderboardPayload` must return only `action`, `requestId`, `nickname`, `score`, `characterId`, `correctHits`, and `wrongHits`; it must not accept grade from the client.

The comparator must be exactly:

```js
export function compareLeaderboardEntries(left, right) {
  return right.score - left.score
    || left.wrongHits - right.wrongHits
    || new Date(left.submittedAt) - new Date(right.submittedAt);
}

export function isBetterLeaderboardEntry(candidate, existing) {
  return candidate.score > existing.score
    || (
      candidate.score === existing.score
      && candidate.wrongHits < existing.wrongHits
    );
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/leaderboard.test.mjs`

Expected: all leaderboard rule tests pass.

- [ ] **Step 5: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 5: Browser transport for list and submit

**Files:**
- Create: `src/leaderboard/config.js`
- Create: `src/leaderboard/client.js`
- Create: `tests/leaderboard-client.test.mjs`

**Interfaces:**
- Produces: `LEADERBOARD_ENDPOINT = ''` until the deployment URL is supplied.
- Produces: `buildLeaderboardListUrl(endpoint, callbackName)`.
- Produces: `loadLeaderboard(endpoint, { timeoutMs }?) -> Promise<{ records }>`.
- Produces: `submitLeaderboard(endpoint, payload, { timeoutMs }?) -> Promise<submissionResult>`.

- [ ] **Step 1: Write failing URL tests**

```js
assert.equal(
  buildLeaderboardListUrl(
    'https://script.google.com/macros/s/example/exec',
    '__dkecCallback1',
  ),
  'https://script.google.com/macros/s/example/exec?action=list&callback=__dkecCallback1',
);
assert.throws(
  () => buildLeaderboardListUrl('', '__dkecCallback1'),
  /尚未設定排行榜網址/,
);
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/leaderboard-client.test.mjs`

Expected: FAIL because `client.js` does not exist.

- [ ] **Step 3: Implement URL building and the JSONP loader**

`loadLeaderboard` must:

1. Generate a callback matching `^__[A-Za-z0-9_]+$`.
2. Add a `<script>` whose URL contains `action=list` and `callback`.
3. Resolve only `{ ok: true, records: [...] }`.
4. Reject on script error or after 8 seconds.
5. Always delete the global callback, script element, and timeout.

- [ ] **Step 4: Implement hidden-form POST submission**

`submitLeaderboard` must:

1. Create a hidden named iframe and hidden form with `method="POST"`.
2. Add payload fields as hidden inputs and target the iframe.
3. Listen for `message` events only from `iframe.contentWindow`.
4. Require `data.source === 'dkec-leaderboard'` and the exact `requestId`.
5. Resolve on `ok: true`, reject on backend error or after 10 seconds.
6. Always remove listener, form, iframe, and timeout.

- [ ] **Step 5: Add a static contract preventing `fetch` writes**

In `tests/contract.test.mjs`, assert that `client.js` contains `document.createElement('iframe')`, `form.method = 'POST'`, and `postMessage` handling, and does not call `fetch(`.

- [ ] **Step 6: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 6: Results leaderboard component and responsive styling

**Files:**
- Create: `src/components/Leaderboard.jsx`
- Modify: `src/components/Results.jsx`
- Modify: `src/styles.css`
- Test: `tests/contract.test.mjs`

**Interfaces:**
- Consumes: `result`, `LEADERBOARD_ENDPOINT`, leaderboard rules, and client functions.
- Produces: optional submission form, load/retry states, submission feedback, and up to 20 ranking rows.

- [ ] **Step 1: Add failing component contracts**

Require the source to contain:

- `排行榜（前 20 名）`
- `暱稱（選填）`
- `登錄排行榜`
- `重新載入排行榜`
- `maxLength={12}`
- Calls to `validateNickname`, `loadLeaderboard`, and `submitLeaderboard`
- `records.slice(0, 20)`
- A semantic ordered list or table with rank, nickname, score, grade, and character.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/contract.test.mjs`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component state flow**

Use these explicit states:

```js
const [nickname, setNickname] = useState('');
const [records, setRecords] = useState([]);
const [loading, setLoading] = useState(false);
const [loadError, setLoadError] = useState('');
const [submitting, setSubmitting] = useState(false);
const [submitMessage, setSubmitMessage] = useState('');
const [validationError, setValidationError] = useState('');
```

On mount, load only when `LEADERBOARD_ENDPOINT` is non-empty. On submit, validate first, create a cryptographically unique request ID with `crypto.randomUUID()` when available and a timestamp/random fallback otherwise, submit, announce whether the record was updated, include the returned rank when non-null, and reload the list.

- [ ] **Step 4: Embed the component in Results**

```jsx
<Leaderboard result={result} />
```

Place it after the reward action and before the replay/change-character actions so a leaderboard outage cannot block those buttons.

- [ ] **Step 5: Add responsive CSS**

Create `.leaderboard-panel`, `.leaderboard-form`, `.leaderboard-status`, `.leaderboard-list`, and `.leaderboard-row` rules. Use a five-column CSS grid on desktop and a compact five-column grid with smaller type below 540px. Require `min-width: 0`, wrapping nicknames, and no fixed pixel width that can overflow the results card.

- [ ] **Step 6: Run the full suite and build as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: Vite exits 0 with no compile errors.

---

### Task 7: Complete Google Apps Script backend and deployment guide

**Files:**
- Create: `google-apps-script/Code.gs`
- Create: `google-apps-script/部署說明.md`
- Modify: `tests/contract.test.mjs`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `setupLeaderboard()`, `doGet(e)`, and `doPost(e)`.
- Sheet name: `Rankings`.
- Headers: `recordId`, `submittedAt`, `nickname`, `normalizedNickname`, `score`, `grade`, `characterId`, `correctHits`, `wrongHits`.

- [ ] **Step 1: Add failing Apps Script contracts**

Assert that `Code.gs` contains the exact header set, `setupLeaderboard`, `doGet`, `doPost`, `LockService.getScriptLock`, `PropertiesService.getScriptProperties`, `SpreadsheetApp.openById`, `ContentService.MimeType.JAVASCRIPT`, `HtmlService.XFrameOptionsMode.ALLOWALL`, NFKC nickname normalization, a 20-row slice, and server-side grade calculation.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/contract.test.mjs`

Expected: FAIL because `google-apps-script/Code.gs` does not exist.

- [ ] **Step 3: Implement initialization and Sheet access**

Use these constants and functions:

```js
const SHEET_NAME = 'Rankings';
const HEADERS = [
  'recordId', 'submittedAt', 'nickname', 'normalizedNickname',
  'score', 'grade', 'characterId', 'correctHits', 'wrongHits',
];
const SCORE_GRADES = [
  { id: 'S', minimum: 55 },
  { id: 'A', minimum: 40 },
  { id: 'B', minimum: 25 },
  { id: 'C', minimum: 10 },
  { id: 'D', minimum: Number.NEGATIVE_INFINITY },
];

function setupLeaderboard() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('請從目標 Google Sheet 執行初始化。');
  PropertiesService.getScriptProperties().setProperty(
    'SPREADSHEET_ID',
    spreadsheet.getId(),
  );
  ensureSheet_(spreadsheet);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties()
    .getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('排行榜尚未初始化。');
  return SpreadsheetApp.openById(id);
}
```

`ensureSheet_` creates `Rankings`, writes exactly one header row, freezes it, and rejects a non-empty sheet whose first row does not match `HEADERS`.

- [ ] **Step 4: Implement validation and ranking**

Validation must enforce:

```js
const nickname = String(parameters.nickname || '').trim();
const normalizedNickname = nickname.normalize('NFKC').trim().toLowerCase();
const length = Array.from(nickname).length;
const invalidFormula = /^[=+\-@]/.test(nickname);
const hasControl = /[\u0000-\u001f\u007f]/.test(nickname);
```

Accept only integer score `-20..200`, correct hits `0..200`, wrong hits `0..20`, and character `d|k|e|c`. Require `score - correctHits + wrongHits` to be between 0 and 10 inclusive. Calculate grade from `SCORE_GRADES`; never accept a grade parameter.

Sort records by score descending, wrong hits ascending, then submitted time ascending. Replace an existing normalized nickname only for higher score or equal score with fewer wrong hits.

- [ ] **Step 5: Implement public read and locked write**

`doGet(e)` accepts only `action=list` and a callback matching `/^[A-Za-z_$][0-9A-Za-z_$]*$/`, returns `{ ok: true, records: records.slice(0, 20) }` as JavaScript, and escapes `<`, U+2028, and U+2029 in JSON.

`doPost(e)` accepts only `action=submit`, validates a request ID matching `/^[0-9A-Za-z_-]{8,80}$/`, acquires `LockService.getScriptLock().waitLock(10000)`, writes or keeps the best record, calculates its 1-based rank from the full sorted list, and releases the lock in `finally`.

Return submission results through:

```js
function postMessageOutput_(payload) {
  const json = safeJson_({
    source: 'dkec-leaderboard',
    ...payload,
  });
  return HtmlService
    .createHtmlOutput(`<script>parent.postMessage(${json}, '*');</script>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

Backend errors must expose only a short Chinese validation message, never a stack trace, Sheet ID, or authorization detail.

- [ ] **Step 6: Write the deployment guide**

Document these exact actions:

1. Create a Google Sheet and open Extensions → Apps Script.
2. Paste `Code.gs`, save, choose `setupLeaderboard`, click Run, and authorize.
3. Verify the `Rankings` tab and nine headers.
4. Deploy → New deployment → Web app.
5. Execute as Me; Who has access: Anyone.
6. Copy the URL ending in `/exec`, not `/dev`.
7. Paste it into `src/leaderboard/config.js` as `LEADERBOARD_ENDPOINT`.
8. Re-run `npm.cmd run export:html` and copy the exported file.
9. For later backend edits, Manage deployments → Edit → New version → Deploy, preserving the same `/exec` URL.

Include a privacy note, the public-endpoint anti-cheat limitation, and a test checklist for list, first submit, better replacement, worse rejection, duplicate nickname casing, and mobile display.

- [ ] **Step 7: Update project instructions**

In `AGENTS.md`, remove only `leaderboards` from the old prohibited feature line because it conflicts with this approved request. Preserve the prohibitions on audio, login, multiplayer, and finished project images.

- [ ] **Step 8: Run the full suite as the task checkpoint**

Run: `npm.cmd test`

Expected: all tests pass.

---

### Task 8: Production verification, browser QA, export, and network sync

**Files:**
- Verify: all source and test files above.
- Generate: `dist/`
- Generate: `export/DKEC氣球特攻隊-單檔版.html`
- Copy: the exported HTML to the approved UNC folder.

**Interfaces:**
- Produces: a verified standalone HTML with the endpoint configuration embedded.
- Requires: if `LEADERBOARD_ENDPOINT` is still empty, the UI must show the documented unconfigured state and the deployment guide must explain the final rebuild step.

- [ ] **Step 1: Run fresh automated verification**

Run: `npm.cmd test`

Expected: zero failed tests.

Run: `npm.cmd run verify:production`

Expected: Vite build and production verification both exit 0.

- [ ] **Step 2: Export the standalone HTML**

Run: `npm.cmd run export:html`

Expected: `export/DKEC氣球特攻隊-單檔版.html` exists, contains no `/assets/` references, and passes `tests/single-html-export.test.mjs`.

- [ ] **Step 3: Run browser QA on desktop and mobile**

Check at minimum 1280×800 and 390×844:

- D/C/B/A result shows exact points to next grade.
- S result shows the top-grade message.
- Leaderboard unconfigured, loading, loaded, validation-error, submit-success, retained-best, and network-error states fit the card.
- Twenty rows do not cause horizontal scrolling.
- Reward, replay, and character-change actions still work.
- Final-ten-second balloons remain behind the wall until fully hittable and do not move faster than the existing late-round speed.

- [ ] **Step 4: Sync only after fresh hash verification**

With user-approved access, copy using PowerShell `Copy-Item -LiteralPath ... -Force` to:

```text
\\10.10.1.252\電子商務部\07_個人資料夾\＊ALICE\DKEC呼吸小氣球\氣球特攻隊\DKEC氣球特攻隊-單檔版.html
```

Run `Get-FileHash -Algorithm SHA256` on source and destination and require identical size and hash before reporting completion.

- [ ] **Step 5: Final requirements audit**

Re-read the approved design and confirm every section maps to fresh test, build, browser, export, or hash evidence. Report the one remaining operator action if the real `/exec` URL has not yet been supplied: deploy Apps Script, paste the URL, then rebuild and resync.
