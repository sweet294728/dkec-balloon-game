import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const codePath = path.join(projectRoot, 'google-apps-script', 'Code.gs');
const codeSource = readFileSync(codePath, 'utf8');
const HEADERS = [
  'recordId',
  'submittedAt',
  'nickname',
  'normalizedNickname',
  'score',
  'grade',
  'characterId',
  'correctHits',
  'wrongHits',
];

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function createSheet({
  values = [],
  formulas = [],
  maxColumns = 12,
} = {}) {
  const sheet = {
    values: cloneMatrix(values),
    formulas: cloneMatrix(formulas),
    maxColumns,
    frozenRows: 0,
    failAppend: false,
    getMaxColumns() {
      return this.maxColumns;
    },
    getLastColumn() {
      let lastColumn = 0;
      const rowCount = Math.max(this.values.length, this.formulas.length);
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < this.maxColumns; columnIndex += 1) {
          const value = this.values[rowIndex]?.[columnIndex] ?? '';
          const formula = this.formulas[rowIndex]?.[columnIndex] ?? '';
          if (value !== '' || formula !== '') {
            lastColumn = Math.max(lastColumn, columnIndex + 1);
          }
        }
      }
      return lastColumn;
    },
    getLastRow() {
      let lastRow = 0;
      const rowCount = Math.max(this.values.length, this.formulas.length);
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const hasContent = Array.from(
          { length: this.maxColumns },
          (_, columnIndex) => (
            (this.values[rowIndex]?.[columnIndex] ?? '') !== ''
            || (this.formulas[rowIndex]?.[columnIndex] ?? '') !== ''
          ),
        ).some(Boolean);
        if (hasContent) lastRow = rowIndex + 1;
      }
      return lastRow;
    },
    getRange(row, column, rowCount, columnCount) {
      const readMatrix = (matrix) => Array.from(
        { length: rowCount },
        (_, rowOffset) => Array.from(
          { length: columnCount },
          (_, columnOffset) => (
            matrix[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ''
          ),
        ),
      );

      return {
        getValues: () => readMatrix(this.values),
        getFormulas: () => readMatrix(this.formulas),
        setValues: (newValues) => {
          newValues.forEach((valueRow, rowOffset) => {
            const targetRow = row - 1 + rowOffset;
            if (!this.values[targetRow]) this.values[targetRow] = [];
            if (!this.formulas[targetRow]) this.formulas[targetRow] = [];
            valueRow.forEach((value, columnOffset) => {
              const targetColumn = column - 1 + columnOffset;
              this.values[targetRow][targetColumn] = value;
              this.formulas[targetRow][targetColumn] = '';
              this.maxColumns = Math.max(this.maxColumns, targetColumn + 1);
            });
          });
        },
      };
    },
    setFrozenRows(count) {
      this.frozenRows = count;
    },
    appendRow(row) {
      if (this.failAppend) {
        throw new Error('SECRET_SHEET_ID authorization detail');
      }
      this.values.push(Array.from(row));
      this.formulas.push(Array.from({ length: row.length }, () => ''));
    },
    deleteRow(rowNumber) {
      this.values.splice(rowNumber - 1, 1);
      this.formulas.splice(rowNumber - 1, 1);
    },
  };

  return sheet;
}

function createHarness({
  sheet = createSheet({ values: [HEADERS] }),
  sheetExists = true,
  spreadsheetId = 'sheet-under-test',
  initialSpreadsheetId = spreadsheetId,
} = {}) {
  const state = {
    properties: initialSpreadsheetId
      ? { SPREADSHEET_ID: initialSpreadsheetId }
      : {},
    lockWaits: 0,
    lockReleases: 0,
    uuid: 0,
  };
  const spreadsheet = {
    currentSheet: sheetExists ? sheet : null,
    getId: () => spreadsheetId,
    getSheetByName: (name) => (
      name === 'Rankings' ? spreadsheet.currentSheet : null
    ),
    insertSheet: (name) => {
      assert.equal(name, 'Rankings');
      spreadsheet.currentSheet = sheet;
      return sheet;
    },
  };
  const scriptProperties = {
    getProperty(key) {
      return state.properties[key] ?? null;
    },
    setProperty(key, value) {
      state.properties[key] = value;
    },
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      openById: (id) => {
        assert.equal(id, state.properties.SPREADSHEET_ID);
        return spreadsheet;
      },
    },
    PropertiesService: {
      getScriptProperties: () => scriptProperties,
    },
    LockService: {
      getScriptLock: () => ({
        waitLock(milliseconds) {
          assert.equal(milliseconds, 10000);
          state.lockWaits += 1;
        },
        releaseLock() {
          state.lockReleases += 1;
        },
      }),
    },
    Utilities: {
      getUuid: () => `test-record-${++state.uuid}`,
    },
    ContentService: {
      MimeType: { JAVASCRIPT: 'application/javascript' },
      createTextOutput: (content) => ({
        content,
        mimeType: null,
        setMimeType(mimeType) {
          this.mimeType = mimeType;
          return this;
        },
      }),
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: (content) => ({
        content,
        xFrameOptionsMode: null,
        setXFrameOptionsMode(mode) {
          this.xFrameOptionsMode = mode;
          return this;
        },
      }),
    },
  };

  vm.runInNewContext(
    `${codeSource}\nglobalThis.__backend = { setupLeaderboard, doGet, doPost };`,
    context,
    { filename: 'Code.gs' },
  );

  return {
    api: context.__backend,
    sheet,
    spreadsheet,
    state,
  };
}

function parseJsonp(output, callback = 'callback') {
  assert.equal(output.mimeType, 'application/javascript');
  assert.ok(output.content.startsWith(`${callback}(`));
  return JSON.parse(output.content.slice(callback.length + 1, -2));
}

function parsePostMessage(output) {
  assert.equal(output.xFrameOptionsMode, 'ALLOWALL');
  const match = output.content.match(
    /^<script>parent\.parent\.postMessage\((.*), '\*'\);<\/script>$/s,
  );
  assert.ok(
    match,
    'submission output must reach the game above the Apps Script wrapper',
  );
  return JSON.parse(match[1]);
}

function submission(overrides = {}) {
  return {
    action: 'submit',
    requestId: 'request-0001',
    nickname: 'Alice',
    score: '10',
    characterId: 'd',
    correctHits: '10',
    wrongHits: '0',
    ...overrides,
  };
}

function submit(harness, overrides = {}) {
  return parsePostMessage(harness.api.doPost({
    parameter: submission(overrides),
  }));
}

test('setup writes exact headers only when the complete first row is truly empty', () => {
  const sheet = createSheet({
    values: [Array.from({ length: 12 }, () => '')],
    formulas: [Array.from({ length: 12 }, () => '')],
    maxColumns: 12,
  });
  const harness = createHarness({
    sheet,
    spreadsheetId: 'new-sheet-id',
    initialSpreadsheetId: 'old-sheet-id',
  });

  harness.api.setupLeaderboard();

  assert.deepEqual(sheet.values[0].slice(0, 9), HEADERS);
  assert.deepEqual(sheet.values[0].slice(9, 12), ['', '', '']);
  assert.deepEqual(sheet.formulas[0].slice(0, 12), Array(12).fill(''));
  assert.equal(sheet.frozenRows, 1);
  assert.equal(harness.state.properties.SPREADSHEET_ID, 'new-sheet-id');
});

test('setup rejects every formula-backed first row without changing it', () => {
  const cases = [
    {
      label: 'formula evaluating to empty in the first cell',
      values: [Array(12).fill('')],
      formulas: [['=IF(TRUE,"","")']],
    },
    {
      label: 'formula-backed header text',
      values: [[...HEADERS, '', '', '']],
      formulas: [['="recordId"']],
    },
    {
      label: 'formula evaluating to empty in an extra cell',
      values: [[...HEADERS, '', '', '']],
      formulas: [[...Array(11).fill(''), '=IF(TRUE,"","")']],
    },
  ];

  for (const scenario of cases) {
    const sheet = createSheet({
      values: scenario.values,
      formulas: scenario.formulas,
      maxColumns: 12,
    });
    const valuesBefore = cloneMatrix(sheet.values);
    const formulasBefore = cloneMatrix(sheet.formulas);
    const harness = createHarness({ sheet });

    assert.throws(
      () => harness.api.setupLeaderboard(),
      /第一列已有資料.*不會覆寫/,
      scenario.label,
    );
    assert.deepEqual(sheet.values, valuesBefore, scenario.label);
    assert.deepEqual(sheet.formulas, formulasBefore, scenario.label);
    assert.equal(sheet.frozenRows, 0, scenario.label);
  }
});

test('failed setup preserves the previously configured spreadsheet ID', () => {
  const sheet = createSheet({ values: [['wrongHeader']] });
  const harness = createHarness({
    sheet,
    spreadsheetId: 'invalid-new-sheet',
    initialSpreadsheetId: 'known-good-sheet',
  });

  assert.throws(
    () => harness.api.setupLeaderboard(),
    /第一列已有資料.*不會覆寫/,
  );
  assert.equal(
    harness.state.properties.SPREADSHEET_ID,
    'known-good-sheet',
  );
});

test('setup accepts exact literal headers and freezes row one', () => {
  const sheet = createSheet({
    values: [[...HEADERS, '', '', '']],
    formulas: [Array(12).fill('')],
  });
  const harness = createHarness({ sheet });

  harness.api.setupLeaderboard();

  assert.deepEqual(sheet.values[0].slice(0, 12), [...HEADERS, '', '', '']);
  assert.equal(sheet.frozenRows, 1);
});

test('submission validates bounds and calculates every grade on the server', () => {
  const harness = createHarness();
  const gradeCases = [
    { score: -20, correctHits: 0, wrongHits: 20, grade: 'D' },
    { score: 10, correctHits: 10, wrongHits: 0, grade: 'C' },
    { score: 25, correctHits: 25, wrongHits: 0, grade: 'B' },
    { score: 40, correctHits: 40, wrongHits: 0, grade: 'A' },
    { score: 55, correctHits: 55, wrongHits: 0, grade: 'S' },
    { score: 200, correctHits: 200, wrongHits: 0, grade: 'S' },
  ];

  gradeCases.forEach((gradeCase, index) => {
    const response = submit(harness, {
      requestId: `grade-${String(index).padStart(3, '0')}`,
      nickname: `Player${index}`,
      score: String(gradeCase.score),
      correctHits: String(gradeCase.correctHits),
      wrongHits: String(gradeCase.wrongHits),
    });
    assert.equal(response.ok, true);
    const stored = harness.sheet.values.find((row) => row[2] === `Player${index}`);
    assert.equal(stored[5], gradeCase.grade);
  });

  const invalidCases = [
    { requestId: 'badscore1', score: '-21', correctHits: '0', wrongHits: '20' },
    { requestId: 'badscore2', score: '201', correctHits: '200' },
    { requestId: 'badhits01', correctHits: '201' },
    { requestId: 'badhits02', wrongHits: '21' },
    { requestId: 'badheart1', score: '11', correctHits: '0' },
    { requestId: 'badchar01', characterId: 'x' },
    { requestId: 'badgrade1', grade: 'S' },
  ];
  for (const invalidCase of invalidCases) {
    assert.equal(submit(harness, invalidCase).ok, false);
  }
});

test('NFKC and prototype-key nicknames deduplicate to one best row each', () => {
  const harness = createHarness();

  assert.equal(submit(harness, { nickname: 'Alice' }).updated, true);
  assert.equal(submit(harness, {
    requestId: 'request-0002',
    nickname: 'ＡＬＩＣＥ',
    score: '20',
    correctHits: '20',
  }).updated, true);
  assert.equal(submit(harness, {
    requestId: 'request-0003',
    nickname: '__proto__',
    score: '15',
    correctHits: '15',
  }).updated, true);
  assert.equal(submit(harness, {
    requestId: 'request-0004',
    nickname: '__PROTO__',
    score: '16',
    correctHits: '16',
  }).updated, true);

  assert.equal(harness.sheet.values.filter((row) => row[3] === 'alice').length, 1);
  assert.equal(harness.sheet.values.filter((row) => row[3] === '__proto__').length, 1);
});

test('better results replace, worse results retain, and ranks use the full set', () => {
  const harness = createHarness();

  assert.equal(submit(harness, {
    requestId: 'request-bob1',
    nickname: 'Bob',
    score: '30',
    correctHits: '30',
  }).rank, 1);
  assert.equal(submit(harness, { requestId: 'request-ali1' }).rank, 2);

  const worse = submit(harness, {
    requestId: 'request-ali2',
    score: '9',
    correctHits: '9',
  });
  assert.deepEqual(
    { updated: worse.updated, rank: worse.rank },
    { updated: false, rank: 2 },
  );

  const better = submit(harness, {
    requestId: 'request-ali3',
    score: '40',
    correctHits: '40',
  });
  assert.deepEqual(
    { updated: better.updated, rank: better.rank },
    { updated: true, rank: 1 },
  );
  assert.equal(harness.sheet.values.filter((row) => row[3] === 'alice').length, 1);
});

test('a locked write failure returns a safe error and always releases the lock', () => {
  const harness = createHarness();
  harness.sheet.failAppend = true;

  const response = submit(harness, { nickname: 'Crash' });

  assert.equal(response.ok, false);
  assert.equal(response.error.includes('SECRET'), false);
  assert.equal(response.error.includes('authorization'), false);
  assert.equal(harness.state.lockWaits, 1);
  assert.equal(harness.state.lockReleases, 1);
});

test('list responses expose only the five public fields', () => {
  const harness = createHarness();
  submit(harness, {});

  const payload = parseJsonp(harness.api.doGet({
    parameter: { action: 'list', callback: 'callback' },
  }));

  assert.equal(payload.ok, true);
  assert.deepEqual(
    Object.keys(payload.records[0]).sort(),
    ['characterId', 'grade', 'nickname', 'rank', 'score'],
  );
  assert.equal(JSON.stringify(payload).includes('recordId'), false);
  assert.equal(JSON.stringify(payload).includes('normalizedNickname'), false);
});

test('list responses return at most the best one hundred unique nicknames', () => {
  const harness = createHarness();

  for (let index = 1; index <= 105; index += 1) {
    const suffix = String(index).padStart(3, '0');
    const response = submit(harness, {
      requestId: `request-${suffix}`,
      nickname: `玩家${suffix}`,
      score: String(index),
      correctHits: String(index),
    });
    assert.equal(response.ok, true);
  }

  const payload = parseJsonp(harness.api.doGet({
    parameter: { action: 'list', callback: 'callback' },
  }));

  assert.equal(payload.records.length, 100);
  assert.equal(payload.records[0].score, 105);
  assert.equal(payload.records[0].rank, 1);
  assert.equal(payload.records.at(-1).score, 6);
  assert.equal(payload.records.at(-1).rank, 100);
});

test('JSONP escapes less-than, U+2028, and U+2029 before script execution', () => {
  const harness = createHarness();
  const dangerousNickname = 'x\u2028y\u2029</s>';
  assert.equal(Array.from(dangerousNickname).length, 8);
  assert.equal(submit(harness, { nickname: dangerousNickname }).ok, true);

  const output = harness.api.doGet({
    parameter: { action: 'list', callback: 'callback' },
  });

  assert.equal(output.content.includes('<'), false);
  assert.equal(output.content.includes('\u2028'), false);
  assert.equal(output.content.includes('\u2029'), false);
  assert.match(output.content, /\\u003c/);
  assert.match(output.content, /\\u2028/);
  assert.match(output.content, /\\u2029/);
  assert.equal(parseJsonp(output).records[0].nickname, dangerousNickname);
});
