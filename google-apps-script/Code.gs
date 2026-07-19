var SHEET_NAME = 'Rankings';
var SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';
var HEADERS = [
  'recordId', 'submittedAt', 'nickname', 'normalizedNickname',
  'score', 'grade', 'characterId', 'correctHits', 'wrongHits',
];
var SCORE_GRADES = [
  { id: 'S', minimum: 55 },
  { id: 'A', minimum: 40 },
  { id: 'B', minimum: 25 },
  { id: 'C', minimum: 10 },
  { id: 'D', minimum: Number.NEGATIVE_INFINITY },
];
var CALLBACK_PATTERN = /^[A-Za-z_$][0-9A-Za-z_$]*$/;
var REQUEST_ID_PATTERN = /^[0-9A-Za-z_-]{8,80}$/;
var CHARACTER_PATTERN = /^[dkec]$/;
var CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;
var FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

function setupLeaderboard() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('請從目標 Google Sheet 開啟 Apps Script 並執行初始化。');
  }

  ensureSheet_(spreadsheet);
  PropertiesService.getScriptProperties().setProperty(
    SPREADSHEET_ID_PROPERTY,
    spreadsheet.getId(),
  );
}

function ensureSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  var firstRowWidth = sheet.getMaxColumns();
  var firstRowRange = sheet.getRange(1, 1, 1, firstRowWidth);
  var firstRowValues = firstRowRange.getValues()[0];
  var firstRowFormulas = firstRowRange.getFormulas()[0];
  var firstRowIsEmpty = rowIsEmpty_(firstRowValues, firstRowFormulas);

  if (!firstRowIsEmpty && !headersMatch_(firstRowValues, firstRowFormulas)) {
    throw new Error('Rankings 工作表第一列已有資料，但欄位名稱不正確；請先備份並手動修正，系統不會覆寫。');
  }

  if (firstRowIsEmpty) {
    if (firstRowWidth < HEADERS.length) {
      sheet.insertColumnsAfter(
        firstRowWidth,
        HEADERS.length - firstRowWidth,
      );
    }
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sheet.setFrozenRows(1);
  return sheet;
}

function rowIsEmpty_(values, formulas) {
  for (var index = 0; index < values.length; index += 1) {
    if (values[index] !== '' || formulas[index] !== '') {
      return false;
    }
  }
  return true;
}

function headersMatch_(values, formulas) {
  if (values.length !== formulas.length) {
    return false;
  }

  for (var formulaIndex = 0; formulaIndex < formulas.length; formulaIndex += 1) {
    if (formulas[formulaIndex] !== '') {
      return false;
    }
  }

  for (var index = 0; index < HEADERS.length; index += 1) {
    if (values[index] !== HEADERS[index]) {
      return false;
    }
  }

  for (var extraIndex = HEADERS.length; extraIndex < values.length; extraIndex += 1) {
    if (values[extraIndex] !== '') {
      return false;
    }
  }

  return true;
}

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty(SPREADSHEET_ID_PROPERTY);
  if (!spreadsheetId) {
    throw safeError_('排行榜尚未初始化，請先執行 setupLeaderboard。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getRankingsSheet_() {
  return ensureSheet_(getSpreadsheet_());
}

function doGet(e) {
  var parameters = getParameters_(e);
  var callback = String(parameters.callback || '');

  if (!CALLBACK_PATTERN.test(callback)) {
    return javascriptOutput_('/* 排行榜讀取請求格式不正確。 */');
  }

  try {
    if (parameters.action !== 'list') {
      throw safeError_('排行榜讀取動作不正確。');
    }

    var records = sortRecords_(dedupeRecords_(readRecords_(getRankingsSheet_())));
    var publicRecords = records.slice(0, 100).map(function (record, index) {
      return toPublicRecord_(record, index + 1);
    });

    return jsonpOutput_(callback, {
      ok: true,
      records: publicRecords,
    });
  } catch (error) {
    return jsonpOutput_(callback, {
      ok: false,
      records: [],
      error: safeErrorMessage_(error),
    });
  }
}

function doPost(e) {
  var parameters = getParameters_(e);
  var requestIdCandidate = String(parameters.requestId || '');
  var requestId = REQUEST_ID_PATTERN.test(requestIdCandidate)
    ? requestIdCandidate
    : '';
  var lock = null;
  var locked = false;
  var response;

  try {
    if (parameters.action !== 'submit') {
      throw safeError_('排行榜提交動作不正確。');
    }
    if (!REQUEST_ID_PATTERN.test(requestIdCandidate)) {
      throw safeError_('請求識別碼格式不正確。');
    }

    var submission = validateSubmission_(parameters);

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    locked = true;

    var sheet = getRankingsSheet_();
    var records = readRecords_(sheet);
    var candidate = {
      recordId: Utilities.getUuid(),
      submittedAt: new Date().toISOString(),
      nickname: submission.nickname,
      normalizedNickname: submission.normalizedNickname,
      score: submission.score,
      grade: calculateGrade_(submission.score),
      characterId: submission.characterId,
      correctHits: submission.correctHits,
      wrongHits: submission.wrongHits,
    };
    var writeResult = retainBestRecord_(sheet, records, candidate);
    var rankedRecords = sortRecords_(dedupeRecords_(readRecords_(sheet)));
    var rank = findRankByRecordId_(rankedRecords, writeResult.recordId);

    response = {
      requestId: requestId,
      ok: true,
      updated: writeResult.updated,
      rank: rank,
    };
  } catch (error) {
    response = {
      requestId: requestId,
      ok: false,
      updated: false,
      rank: null,
      error: safeErrorMessage_(error),
    };
  } finally {
    if (locked && lock) {
      try {
        lock.releaseLock();
      } catch (releaseError) {
        // Do not replace a safe client response with a lock cleanup detail.
      }
    }
  }

  return postMessageOutput_(response);
}

function getParameters_(e) {
  if (!e || !e.parameter || typeof e.parameter !== 'object') {
    return {};
  }
  return e.parameter;
}

function validateSubmission_(parameters) {
  if (Object.prototype.hasOwnProperty.call(parameters, 'grade')) {
    throw safeError_('評級由伺服器計算，請勿提交 grade。');
  }

  var nicknameData = validateNickname_(parameters.nickname);
  var score = parseIntegerParameter_(parameters.score, '分數', -20, 200);
  var correctHits = parseIntegerParameter_(
    parameters.correctHits,
    '正確命中數',
    0,
    200,
  );
  var wrongHits = parseIntegerParameter_(
    parameters.wrongHits,
    '錯誤命中數',
    0,
    20,
  );
  var characterId = String(parameters.characterId || '');

  if (!CHARACTER_PATTERN.test(characterId)) {
    throw safeError_('角色資料不正確。');
  }

  var heartBonus = score - correctHits + wrongHits;
  if (heartBonus < 0 || heartBonus > 10) {
    throw safeError_('分數與命中資料不一致。');
  }

  return {
    nickname: nicknameData.nickname,
    normalizedNickname: nicknameData.normalizedNickname,
    score: score,
    characterId: characterId,
    correctHits: correctHits,
    wrongHits: wrongHits,
  };
}

function validateNickname_(value) {
  var rawNickname = value === undefined || value === null
    ? ''
    : String(value);
  var nickname = rawNickname.trim();
  var normalizedNickname = nickname.normalize('NFKC').trim().toLowerCase();
  var nicknameLength = Array.from(nickname).length;

  if (nicknameLength < 1 || nicknameLength > 12) {
    throw safeError_('暱稱需為 1 到 12 個字元。');
  }
  if (CONTROL_CHARACTER_PATTERN.test(rawNickname)) {
    throw safeError_('暱稱不可包含控制字元。');
  }
  if (
    FORMULA_PREFIX_PATTERN.test(nickname)
    || FORMULA_PREFIX_PATTERN.test(normalizedNickname)
  ) {
    throw safeError_('暱稱不可由 =、+、- 或 @ 開頭。');
  }
  if (!normalizedNickname) {
    throw safeError_('暱稱格式不正確。');
  }

  return {
    nickname: nickname,
    normalizedNickname: normalizedNickname,
  };
}

function parseIntegerParameter_(value, label, minimum, maximum) {
  var text = value === undefined || value === null ? '' : String(value);
  if (!/^-?\d+$/.test(text)) {
    throw safeError_(label + '必須是整數。');
  }

  var parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw safeError_(label + '超出允許範圍。');
  }
  return parsed;
}

function calculateGrade_(score) {
  for (var index = 0; index < SCORE_GRADES.length; index += 1) {
    var grade = SCORE_GRADES[index];
    if (score >= grade.minimum) {
      return grade.id;
    }
  }
  throw new Error('Score grade configuration is invalid');
}

function readRecords_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var records = [];

  rows.forEach(function (row, index) {
    var record = parseStoredRecord_(row, index + 2);
    if (record) {
      records.push(record);
    }
  });
  return records;
}

function parseStoredRecord_(row, rowNumber) {
  try {
    var recordId = String(row[0] || '');
    var submittedAt = row[1] instanceof Date
      ? row[1].toISOString()
      : String(row[1] || '');
    var submittedAtMs = new Date(submittedAt).getTime();
    var nicknameData = validateNickname_(row[2]);
    var normalizedNickname = String(row[3] || '');
    var score = parseStoredInteger_(row[4], -20, 200);
    var grade = String(row[5] || '');
    var characterId = String(row[6] || '');
    var correctHits = parseStoredInteger_(row[7], 0, 200);
    var wrongHits = parseStoredInteger_(row[8], 0, 20);
    var heartBonus = score - correctHits + wrongHits;

    if (
      !recordId
      || !Number.isFinite(submittedAtMs)
      || normalizedNickname !== nicknameData.normalizedNickname
      || grade !== calculateGrade_(score)
      || !CHARACTER_PATTERN.test(characterId)
      || heartBonus < 0
      || heartBonus > 10
    ) {
      return null;
    }

    return {
      recordId: recordId,
      submittedAt: submittedAt,
      submittedAtMs: submittedAtMs,
      nickname: nicknameData.nickname,
      normalizedNickname: normalizedNickname,
      score: score,
      grade: grade,
      characterId: characterId,
      correctHits: correctHits,
      wrongHits: wrongHits,
      rowNumber: rowNumber,
    };
  } catch (error) {
    return null;
  }
}

function parseStoredInteger_(value, minimum, maximum) {
  var parsed = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error('Invalid stored integer');
  }
  return parsed;
}

function compareRecords_(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.wrongHits !== right.wrongHits) {
    return left.wrongHits - right.wrongHits;
  }
  if (left.submittedAtMs !== right.submittedAtMs) {
    return left.submittedAtMs - right.submittedAtMs;
  }
  return 0;
}

function sortRecords_(records) {
  return records.slice().sort(compareRecords_);
}

function dedupeRecords_(records) {
  var bestByNickname = Object.create(null);

  records.forEach(function (record) {
    var key = record.normalizedNickname;
    var existing = bestByNickname[key];
    if (!existing || compareRecords_(record, existing) < 0) {
      bestByNickname[key] = record;
    }
  });

  return Object.keys(bestByNickname).map(function (key) {
    return bestByNickname[key];
  });
}

function isBetterRecord_(candidate, existing) {
  return candidate.score > existing.score
    || (
      candidate.score === existing.score
      && candidate.wrongHits < existing.wrongHits
    );
}

function retainBestRecord_(sheet, records, candidate) {
  var matching = records.filter(function (record) {
    return record.normalizedNickname === candidate.normalizedNickname;
  });

  if (matching.length === 0) {
    sheet.appendRow(recordToRow_(candidate));
    return {
      recordId: candidate.recordId,
      updated: true,
    };
  }

  var existing = sortRecords_(matching)[0];
  var updated = isBetterRecord_(candidate, existing);
  var retained = updated ? candidate : existing;

  if (updated) {
    sheet.getRange(existing.rowNumber, 1, 1, HEADERS.length)
      .setValues([recordToRow_(candidate)]);
  }

  matching
    .filter(function (record) {
      return record.rowNumber !== existing.rowNumber;
    })
    .sort(function (left, right) {
      return right.rowNumber - left.rowNumber;
    })
    .forEach(function (record) {
      sheet.deleteRow(record.rowNumber);
    });

  return {
    recordId: retained.recordId,
    updated: updated,
  };
}

function recordToRow_(record) {
  return [
    record.recordId,
    record.submittedAt,
    record.nickname,
    record.normalizedNickname,
    record.score,
    record.grade,
    record.characterId,
    record.correctHits,
    record.wrongHits,
  ];
}

function findRankByRecordId_(records, recordId) {
  for (var index = 0; index < records.length; index += 1) {
    if (records[index].recordId === recordId) {
      return index + 1;
    }
  }
  return null;
}

function toPublicRecord_(record, rank) {
  return {
    rank: rank,
    nickname: record.nickname,
    score: record.score,
    grade: record.grade,
    characterId: record.characterId,
  };
}

function safeJson_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function javascriptOutput_(source) {
  return ContentService
    .createTextOutput(source)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonpOutput_(callback, payload) {
  return javascriptOutput_(callback + '(' + safeJson_(payload) + ');');
}

function postMessageOutput_(payload) {
  var json = safeJson_({
    source: 'dkec-leaderboard',
    requestId: payload.requestId,
    ok: payload.ok,
    updated: payload.updated,
    rank: payload.rank,
    error: payload.error,
  });
  return HtmlService
    .createHtmlOutput(
      '<script>parent.parent.postMessage(' + json + ", '*');</script>",
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function safeError_(message) {
  var error = new Error(message);
  error.isSafeForClient = true;
  return error;
}

function safeErrorMessage_(error) {
  if (
    error
    && error.isSafeForClient === true
    && typeof error.message === 'string'
  ) {
    return error.message.slice(0, 120);
  }
  return '排行榜服務暫時無法使用，請稍後再試。';
}
