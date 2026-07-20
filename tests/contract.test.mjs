import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  GAME_ASSETS,
  MAX_HEALTH,
} from '../src/game/config.js';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const expectedCharacterKeys = ['d', 'k', 'e', 'c'];

const sourcePath = (...segments) => path.join(projectRoot, 'src', ...segments);
const readSource = (...segments) => readFile(sourcePath(...segments), 'utf8');
const projectPath = (...segments) => path.join(projectRoot, ...segments);
const readProjectFile = (...segments) => readFile(projectPath(...segments), 'utf8');
const GAME_CANVAS_PATH = sourcePath('game', 'GameCanvas.jsx');

const assetPaths = [
  GAME_ASSETS.background,
  ...expectedCharacterKeys.flatMap((key) => [
    GAME_ASSETS.characters[key].select,
    GAME_ASSETS.characters[key].gameplay,
  ]),
  GAME_ASSETS.balloons,
  GAME_ASSETS.heart,
  GAME_ASSETS.dartBurst,
];

test('GAME_ASSETS exposes exactly the four character asset pairs', () => {
  assert.deepEqual(Object.keys(GAME_ASSETS.characters), expectedCharacterKeys);

  for (const key of expectedCharacterKeys) {
    assert.deepEqual(
      Object.keys(GAME_ASSETS.characters[key]),
      ['select', 'gameplay'],
    );
  }
});

test('all twelve GAME_ASSETS paths resolve to non-empty PNG files', async () => {
  assert.equal(assetPaths.length, 12);
  assert.equal(new Set(assetPaths).size, 12);

  for (const assetPath of assetPaths) {
    assert.match(assetPath, /^\/assets\/game\/.+\.png$/);

    const filePath = path.join(projectRoot, 'public', assetPath);
    const fileStat = await stat(filePath);

    assert.ok(fileStat.isFile(), `${assetPath} must be a file`);
    assert.ok(fileStat.size > 0, `${assetPath} must not be empty`);
  }
});

test('the three screens include all required visible copy', async () => {
  const [characterSelect, hud, results] = await Promise.all([
    readSource('components', 'CharacterSelect.jsx'),
    readSource('components', 'Hud.jsx'),
    readSource('components', 'Results.jsx'),
  ]);

  assert.match(characterSelect, /DKEC 氣球特攻隊/);
  assert.match(characterSelect, /選擇你的出戰角色/);
  assert.match(characterSelect, /開始任務/);
  assert.match(hud, /分數/);
  assert.match(results, /任務結束/);
  assert.match(results, /再玩一次/);
  assert.match(results, /更換角色/);
});

test('CharacterSelect derives and renders the shared four-character config', async () => {
  const source = await readSource('components', 'CharacterSelect.jsx');

  assert.match(source, /Object\.keys\(CHARACTERS\)/);
  assert.match(source, /\.map\(\(characterId\)/);
  assert.match(source, /GAME_ASSETS\.characters\[characterId\]\.select/);
  assert.deepEqual(Object.keys(GAME_ASSETS.characters), expectedCharacterKeys);
});

test('CharacterSelect keeps start disabled until selection and assets are ready', async () => {
  const source = await readSource('components', 'CharacterSelect.jsx');

  assert.match(source, /\bassetsReady\b/);
  assert.match(source, /\bselectedCharacterId\b/);
  assert.match(
    source,
    /disabled=\{!assetsReady \|\| selectedCharacterId === null\}/,
  );
});

/* Replaced by the illustrated dialog contract below.
test('CharacterSelect explains the DK and EC target rules before the cards', async () => {
  const [characterSelect, styles] = await Promise.all([
    readSource('components', 'CharacterSelect.jsx'),
    readSource('styles.css'),
  ]);

  const bannerStructure = /<aside\s+className="target-rule-banner"\s+aria-label="射擊規則">\s*<p\s+aria-label="選擇 D寶、K寶：只能射 E、C 氣球">\s*選擇\s+<strong>D寶、K寶<\/strong>：只能射\s+<strong>E、C<\/strong>\s+氣球\s*<\/p>\s*<p\s+aria-label="選擇 E寶、C寶：只能射 D、K 氣球">\s*選擇\s+<strong>E寶、C寶<\/strong>：只能射\s+<strong>D、K<\/strong>\s+氣球\s*<\/p>\s*<\/aside>/;
  const bannerMatch = characterSelect.match(bannerStructure);

  assert.ok(bannerMatch, 'the complete semantic banner structure must exist');

  const bannerMarkup = bannerMatch[0];
  const missingStructureVariants = [
    bannerMarkup.replace('<aside', '<div'),
    bannerMarkup.replace(' aria-label="射擊規則"', ''),
    bannerMarkup.replace('<strong>D寶、K寶</strong>', 'D寶、K寶'),
    bannerMarkup.replace('<strong>E、C</strong>', 'E、C'),
    bannerMarkup.replace('<strong>E寶、C寶</strong>', 'E寶、C寶'),
    bannerMarkup.replace('<strong>D、K</strong>', 'D、K'),
  ];

  for (const missingStructure of missingStructureVariants) {
    assert.doesNotMatch(missingStructure, bannerStructure);
  }

  const headerEndIndex = characterSelect.indexOf('</header>');
  const bannerIndex = characterSelect.indexOf('className="target-rule-banner"');
  const gridIndex = characterSelect.indexOf('className="character-grid"');

  assert.ok(headerEndIndex >= 0);
  assert.ok(bannerIndex > headerEndIndex);
  assert.ok(gridIndex > bannerIndex);
  assert.match(styles, /\.target-rule-banner \{/);
  assert.match(styles, /\.target-rule-banner strong \{/);
});
*/

test('selection uses a blocking illustrated rules dialog', async () => {
  const [app, characterSelect, dialog, styles] = await Promise.all([
    readSource('App.jsx'),
    readSource('components', 'CharacterSelect.jsx'),
    readSource('components', 'RulesDialog.jsx'),
    readSource('styles.css'),
  ]);

  assert.match(app, /const \[rulesOpen, setRulesOpen\] = useState\(true\)/);
  assert.match(app, /setRulesOpen\(true\)/);
  assert.match(app, /<RulesDialog onClose=\{\(\) => setRulesOpen\(false\)\}/);
  assert.match(characterSelect, /onOpenRules/);
  assert.match(characterSelect, /規則說明/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /aria-label="關閉規則說明"/);
  assert.match(dialog, /射中正確氣球/);
  assert.match(dialog, /射中錯誤氣球/);
  assert.match(dialog, /滿心時則 \+1 分/);
  assert.match(dialog, /GAME_ASSETS\.characters/);
  assert.match(dialog, /GAME_ASSETS\.balloons/);
  assert.match(dialog, /GAME_ASSETS\.heart/);
  assert.match(styles, /\.rules-dialog-backdrop/);
  assert.match(styles, /\.rules-dialog-card/);
});

test('Hud exposes current health and the maximum five to assistive tech', async () => {
  const source = await readSource('components', 'Hud.jsx');

  assert.equal(MAX_HEALTH, 5);
  assert.match(
    source,
    /aria-label=\{`生命值 \$\{health\} \/ \$\{MAX_HEALTH\}`\}/,
  );
});

test('Results provides separate replay and character-change callbacks', async () => {
  const source = await readSource('components', 'Results.jsx');

  assert.match(source, /此次遊玩等級/);
  assert.match(source, /getScoreGrade\(result\.score\)/);
  assert.match(source, /getGradeReward\(grade\.id\)/);
  assert.match(source, /領取/);
  assert.match(source, /官網購物金/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /result\.score/);
  assert.match(source, /\bonReplay\b/);
  assert.match(source, /\bonChangeCharacter\b/);
  assert.match(source, /onClick=\{onReplay\}/);
  assert.match(source, /onClick=\{onChangeCharacter\}/);
});

test('round mode flows from App through canvas, HUD, and results actions', async () => {
  const [app, canvas, hud, results] = await Promise.all([
    readSource('App.jsx'),
    readSource('game', 'GameCanvas.jsx'),
    readSource('components', 'Hud.jsx'),
    readSource('components', 'Results.jsx'),
  ]);

  assert.match(
    app,
    /const \[roundMode, setRoundMode\] = useState\(ROUND_MODES\.NORMAL\)/,
  );
  assert.match(app, /<GameCanvas[\s\S]*mode=\{roundMode\}/);
  assert.match(app, /<Hud[\s\S]*mode=\{roundMode\}/);
  assert.match(
    app,
    /onReplay=\{\(\) => startRound\(ROUND_MODES\.NORMAL\)\}/,
  );
  assert.match(
    app,
    /onStartGoldenMode=\{\(\) => startRound\(ROUND_MODES\.GOLDEN\)\}/,
  );
  assert.match(canvas, /createRoundState\(characterId, mode\)/);
  assert.match(canvas, /mode:\s*state\.mode/);
  assert.match(hud, /mode === ROUND_MODES\.GOLDEN/);
  assert.match(hud, /黃金模式/);
  assert.match(results, /onStartGoldenMode/);
});

test('golden mode uses the existing game frame with restrained visual markers', async () => {
  const [app, styles] = await Promise.all([
    readSource('App.jsx'),
    readSource('styles.css'),
  ]);

  assert.match(app, /app--golden/);
  assert.match(styles, /\.app--golden \.game-stage/);
  assert.match(styles, /\.app--golden \.game-surface::after/);
  assert.match(styles, /\.golden-mode-badge/);
  assert.match(styles, /\.golden-unlock/);
  assert.match(styles, /\.golden-start-button/);
  assert.match(
    styles,
    /\.app--golden \.game-surface::after\s*\{[^}]*pointer-events:\s*none/s,
  );
  assert.doesNotMatch(styles, /url\([^)]*golden/i);
});

test('Results shows progress toward the next score grade', async () => {
  const source = await readSource('components', 'Results.jsx');

  assert.match(
    source,
    /import\s*\{[^}]*\bgetScoreProgress\b[^}]*\}\s*from '\.\.\/game\/rules\.js';/,
  );
  assert.match(source, /getScoreProgress\(result\.score\)/);
  assert.match(source, /progress\.pointsToNext/);
  assert.match(source, /距離下一等級/);
  assert.match(source, /已達最高等級 S/);
});

test('the app registers a generated project image as its favicon', async () => {
  const source = await readSource('main.jsx');

  assert.match(source, /rel\s*=\s*['"]icon['"]/);
  assert.match(source, /\/assets\/game\/heart-pickup\.png/);
});

test('wall, character, target indicator, darts, and effects use the required layer order', () => {
  const source = readFileSync(GAME_CANVAS_PATH, 'utf8');
  const drawFrameSource = source.slice(
    source.indexOf('function drawFrame('),
    source.indexOf('export default function GameCanvas'),
  );
  const wall = drawFrameSource.indexOf('drawBakedWallForeground(');
  const character = drawFrameSource.indexOf('drawCharacter(');
  const targetIndicator = drawFrameSource.indexOf('drawTargetIndicator(');
  const darts = drawFrameSource.indexOf('darts.forEach(');
  const effects = drawFrameSource.indexOf('effects.forEach(');

  assert.ok(wall >= 0);
  assert.ok(character > wall);
  assert.ok(targetIndicator > character);
  assert.ok(darts > targetIndicator);
  assert.ok(effects > darts);
});

test('GameCanvas seeds six immediate balloons and gates later hits at the wall line', () => {
  const source = readFileSync(GAME_CANVAS_PATH, 'utf8');

  assert.match(source, /createInitialBalloons/);
  assert.match(source, /count:\s*6/);
  assert.match(source, /spawnLineY/);
  assert.match(source, /wall\.destination\.y/);
  assert.match(source, /advanceCombatState\(\{[\s\S]*spawnLineY/);
  assert.match(source, /createBalloonAvoiding\([\s\S]*spawnLineY/);
  assert.doesNotMatch(source, /entrySpeedMultiplier|entrySpeed|\*\s*2\s*\*\s*deltaSeconds/);
});

test('GameCanvas replenishes balloons from the current weighted spawn plan', () => {
  const source = readFileSync(GAME_CANVAS_PATH, 'utf8');

  assert.match(
    source,
    /getBalloonSpawnPlan\(\{\s*elapsedSeconds,\s*remainingSeconds:\s*currentRound\.remainingSeconds,\s*score:\s*currentRound\.score,\s*\}\)/,
  );
  assert.match(source, /balloons\.length < spawnPlan\.targetCount/);
  assert.match(
    source,
    /createBalloonAvoiding\([\s\S]*?spawnLineY,\s*\{\s*targetLetters:\s*getTargetLetters\(characterId\),\s*preferredTargetRatio:\s*spawnPlan\.preferredTargetRatio,\s*\},\s*\)/,
  );
});

test('leaderboard client uses JSONP for reads without fetch', async () => {
  const source = await readSource('leaderboard', 'client.js');

  assert.match(source, /createElement\(['"]script['"]\)/);
  assert.match(source, /callback/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test('leaderboard client submits through a hidden POST form and iframe messages', async () => {
  const source = await readSource('leaderboard', 'client.js');

  assert.match(source, /createElement\(['"]iframe['"]\)/);
  assert.match(source, /createElement\(['"]form['"]\)/);
  assert.match(source, /\.method\s*=\s*['"]POST['"]/);
  assert.match(source, /addEventListener\(['"]message['"]/);
  assert.match(source, /postMessage|event\.source/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test('Leaderboard exposes the optional submission and top one hundred list contracts', async () => {
  const [source, styles] = await Promise.all([
    readSource('components', 'Leaderboard.jsx'),
    readSource('styles.css'),
  ]);

  assert.match(source, /排行榜（前 100 名）/);
  assert.match(source, /暱稱（選填）/);
  assert.match(source, /登錄排行榜/);
  assert.match(source, /重新載入排行榜/);
  assert.match(source, /maxLength=\{12\}/);
  assert.match(source, /validateNickname\(submissionNickname\)/);
  assert.match(source, /createLeaderboardPayload\(/);
  assert.match(source, /loadLeaderboard\(LEADERBOARD_ENDPOINT\)/);
  assert.match(source, /submitLeaderboard\(LEADERBOARD_ENDPOINT, payload\)/);
  assert.match(source, /records\.slice\(0, 100\)/);
  assert.match(source, /<ol[^>]*className="leaderboard-list"/);
  assert.match(source, /名次/);
  assert.match(source, /暱稱/);
  assert.match(source, /分數/);
  assert.match(source, /等級/);
  assert.match(source, /角色/);
  assert.match(
    styles,
    /\.leaderboard-list\s*\{[^}]*max-height:[^;]+;[^}]*overflow-y:\s*auto/s,
  );
  assert.match(
    styles,
    /\.leaderboard-list\s*\{[^}]*touch-action:\s*pan-y/s,
  );
});

test('Leaderboard supports a read-only pre-game mode without submission controls', async () => {
  const source = await readSource('components', 'Leaderboard.jsx');

  assert.match(
    source,
    /function Leaderboard\(\{[\s\S]*readOnly = false,[\s\S]*result,[\s\S]*\}\)/,
  );
  assert.match(source, /\{!readOnly && \([\s\S]*leaderboard-form/);
  assert.match(source, /loadLeaderboard\(LEADERBOARD_ENDPOINT\)/);
  assert.match(source, /visibleRecords\.map/);
  assert.match(source, /重新載入排行榜/);
});

test('Leaderboard intercepts exact DKEC before submission and locks golden results', async () => {
  const source = await readSource('components', 'Leaderboard.jsx');

  assert.match(source, /isGoldenModeUnlock\(nickname\)/);
  assert.match(source, /setGoldenUnlocked\(true\)/);
  assert.match(source, /黃金模式已解鎖/);
  assert.match(source, /開始黃金模式/);
  assert.match(source, /onClick=\{onStartGoldenMode\}/);
  assert.match(
    source,
    /value=\{goldenRound \? GOLDEN_MODE_NICKNAME : nickname\}/,
  );
  assert.match(source, /readOnly=\{goldenRound\}/);

  const submitHandler = source.slice(source.indexOf('async function handleSubmit'));
  const unlockIndex = submitHandler.indexOf('isGoldenModeUnlock(nickname)');
  const endpointIndex = submitHandler.indexOf('if (!endpointConfigured)');
  const submitIndex = submitHandler.indexOf(
    'submitLeaderboard(LEADERBOARD_ENDPOINT, payload)',
  );

  assert.ok(unlockIndex >= 0);
  assert.ok(endpointIndex > unlockIndex);
  assert.ok(submitIndex > endpointIndex);
});

test('selection exposes a read-only leaderboard dialog without opening it automatically', async () => {
  const appSource = await readSource('App.jsx');
  const selectSource = await readSource('components', 'CharacterSelect.jsx');
  const dialogSource = await readSource('components', 'LeaderboardDialog.jsx');

  assert.match(appSource, /const \[leaderboardOpen, setLeaderboardOpen\] = useState\(false\)/);
  assert.match(appSource, /onOpenLeaderboard=\{\(\) => setLeaderboardOpen\(true\)\}/);
  assert.match(appSource, /leaderboardOpen && \([\s\S]*LeaderboardDialog/);
  assert.match(selectSource, /onOpenLeaderboard/);
  assert.match(selectSource, />\s*查看排行榜\s*</);
  assert.match(dialogSource, /<Leaderboard readOnly/);
  assert.doesNotMatch(dialogSource, /leaderboard-form/);
});

test('Results places the square reward action beside the grade before the leaderboard', async () => {
  const source = await readSource('components', 'Results.jsx');
  const styles = await readSource('styles.css');

  assert.match(source, /import Leaderboard from ['"]\.\/Leaderboard\.jsx['"]/);
  assert.match(source, /<Leaderboard[\s\S]*result=\{result\}[\s\S]*\/>/);
  assert.match(
    source,
    /className="results-reward-row"[\s\S]*className=\{`results-grade[\s\S]*className="reward-action"/,
  );
  assert.match(source, /aria-label=\{`領取 \$\{grade\.id\} 級獎勵，官網購物金 NT\$\$\{reward\.amount\}`\}/);
  assert.match(
    source,
    /className="reward-amount"[\s\S]*className="reward-currency">NT\$<\/span>[\s\S]*className="reward-value">\{reward\.amount\}<\/span>[\s\S]*className="reward-label">點我領券<\/span>/,
  );
  assert.match(
    styles,
    /\.reward-amount\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*baseline/s,
  );
  assert.match(styles, /\.reward-currency\s*\{[^}]*font-size:\s*0\.72rem/s);
  assert.match(
    styles,
    /\.reward-value\s*\{[^}]*font-size:\s*clamp\(2\.15rem,\s*9vw,\s*2\.85rem\)/s,
  );
  assert.match(styles, /\.reward-label\s*\{[^}]*font-size:\s*0\.78rem/s);
  assert.match(
    styles,
    /\.reward-action\s*\{[^}]*color:\s*#ffffff[^}]*background:\s*linear-gradient\(135deg,\s*#ff5a5f,\s*#c91f32\)/s,
  );

  const rewardRowIndex = source.indexOf('className="results-reward-row"');
  const leaderboardIndex = source.indexOf('<Leaderboard');
  const actionsIndex = source.indexOf('className="results-actions"');

  assert.ok(rewardRowIndex >= 0);
  assert.ok(leaderboardIndex > rewardRowIndex);
  assert.ok(actionsIndex > leaderboardIndex);
});

test('reward action matches the grade footprint on regular and compact results layouts', async () => {
  const source = await readSource('styles.css');

  assert.match(
    source,
    /\.results-reward-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*148px\)/s,
  );
  assert.match(
    source,
    /\.reward-action\s*\{[^}]*width:\s*148px[^}]*height:\s*148px[^}]*min-height:\s*148px/s,
  );
  assert.match(
    source,
    /@media \(max-width: 539px\) and \(max-height: 900px\)[\s\S]*\.results-reward-row\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*116px\)[\s\S]*\.reward-action\s*\{[^}]*width:\s*116px[^}]*height:\s*116px[^}]*min-height:\s*116px/s,
  );
});

test('Apps Script backend declares the complete Sheet and service contract', async () => {
  const source = await readProjectFile('google-apps-script', 'Code.gs');

  assert.match(source, /(?:var|const)\s+SHEET_NAME\s*=\s*['"]Rankings['"]/);
  assert.match(
    source,
    /(?:var|const)\s+HEADERS\s*=\s*\[\s*['"]recordId['"]\s*,\s*['"]submittedAt['"]\s*,\s*['"]nickname['"]\s*,\s*['"]normalizedNickname['"]\s*,\s*['"]score['"]\s*,\s*['"]grade['"]\s*,\s*['"]characterId['"]\s*,\s*['"]correctHits['"]\s*,\s*['"]wrongHits['"]\s*,?\s*\]/,
  );
  assert.match(source, /function\s+setupLeaderboard\s*\(/);
  assert.match(source, /function\s+ensureSheet_\s*\(/);
  assert.match(source, /function\s+doGet\s*\(/);
  assert.match(source, /function\s+doPost\s*\(/);
  assert.match(source, /PropertiesService\.getScriptProperties\s*\(/);
  assert.match(source, /SpreadsheetApp\.openById\s*\(/);
  assert.match(source, /\.getMaxColumns\s*\(\s*\)/);
  assert.match(source, /\.getFormulas\s*\(\s*\)/);
  assert.match(source, /LockService\.getScriptLock\s*\(/);
  assert.match(source, /\.waitLock\s*\(\s*10000\s*\)/);
  assert.match(source, /finally\s*\{[\s\S]*?\.releaseLock\s*\(\s*\)/);
});

test('Apps Script backend enforces validation, ranking, and safe transport contracts', async () => {
  const source = await readProjectFile('google-apps-script', 'Code.gs');

  assert.match(source, /\.normalize\s*\(\s*['"]NFKC['"]\s*\)/);
  assert.match(source, /Array\.from\s*\([^)]*nickname[^)]*\)/);
  assert.match(source, /\^\[A-Za-z_\$\]\[0-9A-Za-z_\$\]\*\$/);
  assert.match(source, /\^\[0-9A-Za-z_-\]\{8,80\}\$/);
  assert.match(source, /records\.slice\s*\(\s*0\s*,\s*100\s*\)/);
  assert.match(source, /ContentService\.MimeType\.JAVASCRIPT/);
  assert.match(source, /HtmlService\.XFrameOptionsMode\.ALLOWALL/);
  assert.match(source, /source\s*:\s*['"]dkec-leaderboard['"]/);
  assert.match(source, /parent\.postMessage\s*\(/);
  assert.match(source, /replace\s*\(\s*\/?</);
  assert.match(source, /2028/);
  assert.match(source, /2029/);
  assert.match(source, /score\s*-\s*correctHits\s*\+\s*wrongHits/);
  assert.match(
    source,
    /(?:var|const)\s+SCORE_GRADES\s*=\s*\[\s*\{\s*id:\s*['"]S['"]\s*,\s*minimum:\s*55\s*\}\s*,\s*\{\s*id:\s*['"]A['"]\s*,\s*minimum:\s*40\s*\}\s*,\s*\{\s*id:\s*['"]B['"]\s*,\s*minimum:\s*25\s*\}\s*,\s*\{\s*id:\s*['"]C['"]\s*,\s*minimum:\s*10\s*\}\s*,\s*\{\s*id:\s*['"]D['"]\s*,\s*minimum:\s*Number\.NEGATIVE_INFINITY\s*\}\s*,?\s*\]/,
  );
  assert.match(
    source,
    /function\s+calculateGrade_\s*\([^)]*\)\s*\{[\s\S]{0,500}?SCORE_GRADES/,
  );
  assert.doesNotMatch(
    source,
    /function\s+calculateGrade_\s*\([^)]*\)\s*\{[\s\S]{0,500}?score\s*>=\s*(?:55|40|25|10)/,
  );
  assert.match(source, /bestByNickname\s*=\s*Object\.create\s*\(\s*null\s*\)/);
  assert.doesNotMatch(source, /parameters\.grade|parameter\.grade/);

  const publicRecordMatch = source.match(/function\s+toPublicRecord_\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(publicRecordMatch, 'toPublicRecord_ must explicitly filter response fields');
  assert.match(publicRecordMatch[0], /rank\s*:/);
  assert.match(publicRecordMatch[0], /nickname\s*:/);
  assert.match(publicRecordMatch[0], /score\s*:/);
  assert.match(publicRecordMatch[0], /grade\s*:/);
  assert.match(publicRecordMatch[0], /characterId\s*:/);
  assert.doesNotMatch(publicRecordMatch[0], /recordId\s*:|normalizedNickname\s*:/);
});

test('Chinese deployment guide covers deployment, privacy, limitations, and acceptance checks', async () => {
  const guide = await readProjectFile('google-apps-script', '部署說明.md');

  assert.match(guide, /Google Sheet/);
  assert.match(guide, /\u64f4充功能[\s\S]*Apps Script/);
  assert.match(guide, /setupLeaderboard/);
  assert.match(guide, /Rankings/);
  for (const header of [
    'recordId',
    'submittedAt',
    'nickname',
    'normalizedNickname',
    'score',
    'grade',
    'characterId',
    'correctHits',
    'wrongHits',
  ]) {
    assert.match(guide, new RegExp(header));
  }
  assert.match(guide, /\u65b0增部署[\s\S]*網頁應用程式/);
  assert.match(guide, /\u57f7行身分[\s\S]*我/);
  assert.match(guide, /\u4efb何人|Anyone/);
  assert.match(guide, /Workspace[\s\S]*管理員/);
  assert.match(guide, /\/exec/);
  assert.match(guide, /\/dev/);
  assert.match(guide, /LEADERBOARD_ENDPOINT/);
  assert.match(guide, /npm\.cmd run export:html/);
  assert.match(guide, /\u7ba1理部署[\s\S]*新版本/);
  assert.match(guide, /\u96b1私/);
  assert.match(guide, /\u516c開[\s\S]*防弊/);
  assert.match(guide, /\u9996次提交/);
  assert.match(guide, /\u66f4高分/);
  assert.match(guide, /\u8f03差|較低分/);
  assert.match(guide, /NFKC/);
  assert.match(guide, /\u624b機|行動裝置/);
});

test('project instructions permit only the approved leaderboard addition', async () => {
  const instructions = await readProjectFile('AGENTS.md');
  const prohibitedLine = instructions
    .split(/\r?\n/)
    .find((line) => line.startsWith('- Do not add '));

  assert.ok(prohibitedLine);
  assert.doesNotMatch(prohibitedLine, /leaderboards/);
  assert.match(prohibitedLine, /audio/);
  assert.match(prohibitedLine, /login/);
  assert.match(prohibitedLine, /multiplayer/);
  assert.match(prohibitedLine, /finished project images/);
});

test('build scripts use the sandbox-safe Vite config runner', async () => {
  const packageJson = JSON.parse(await readProjectFile('package.json'));

  assert.equal(packageJson.scripts.build, 'vite build --configLoader runner');
  assert.match(
    packageJson.scripts['export:html'],
    /^vite build --configLoader runner && /,
  );
  assert.match(
    packageJson.scripts['verify:production'],
    /^vite build --configLoader runner && /,
  );
});

test('short mobile results compact only non-text vertical space', () => {
  const styles = readFileSync(sourcePath('styles.css'), 'utf8');
  const compactStart = styles.indexOf(
    '@media (max-width: 539px) and (max-height: 900px)',
  );

  assert.notEqual(compactStart, -1);

  const compactBlock = styles.slice(compactStart);

  assert.match(compactBlock, /\.results-screen\s*\{[^}]*overflow-x:\s*clip/s);
  assert.match(compactBlock, /\.results-grade\s*\{[^}]*width:\s*116px/s);
  assert.match(compactBlock, /\.leaderboard-form input,\s*\.leaderboard-submit\s*\{[^}]*min-height:\s*44px/s);
  assert.match(compactBlock, /\.results-actions\s*\{[^}]*gap:\s*8px/s);
  assert.doesNotMatch(compactBlock, /font-size\s*:/);
});
