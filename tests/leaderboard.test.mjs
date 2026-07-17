import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareLeaderboardEntries,
  createLeaderboardPayload,
  isBetterLeaderboardEntry,
  normalizeNickname,
  validateNickname,
} from '../src/leaderboard/rules.js';

test('nickname normalization converts, trims, applies NFKC, and lowercases', () => {
  assert.equal(normalizeNickname('  Ａlice  '), 'alice');
  assert.equal(normalizeNickname(42), '42');
});

test('nickname validation preserves trimmed display text and accepts Chinese', () => {
  assert.deepEqual(validateNickname('  小氣球  '), {
    valid: true,
    nickname: '小氣球',
    normalizedNickname: '小氣球',
    error: null,
  });
});

test('nickname validation rejects empty or whitespace-only values', () => {
  for (const value of ['', '   ', '\u3000']) {
    const validation = validateNickname(value);

    assert.equal(validation.valid, false);
    assert.equal(validation.nickname, '');
    assert.equal(validation.normalizedNickname, '');
    assert.match(validation.error, /^[^\x00-\x7f]+/u);
  }
});

test('nickname validation counts Unicode code points and rejects over twelve', () => {
  assert.equal(validateNickname('🎈'.repeat(12)).valid, true);

  const validation = validateNickname('🎈'.repeat(13));

  assert.equal(validation.valid, false);
  assert.match(validation.error, /12/u);
});

test('nickname validation rejects control characters', () => {
  for (const value of ['小\n氣球', 'Alice\u007f']) {
    const validation = validateNickname(value);

    assert.equal(validation.valid, false);
    assert.match(validation.error, /^[^\x00-\x7f]+/u);
  }
});

test('nickname validation rejects formula-like leading characters after trim', () => {
  for (const prefix of ['=', '+', '-', '@']) {
    const validation = validateNickname(`  ${prefix}player`);

    assert.equal(validation.valid, false);
    assert.match(validation.error, /^[^\x00-\x7f]+/u);
  }
});

test('leaderboard comparator ranks higher scores first', () => {
  const lower = { score: 8, wrongHits: 0, submittedAt: 1 };
  const higher = { score: 9, wrongHits: 9, submittedAt: 9 };

  assert.ok(compareLeaderboardEntries(higher, lower) < 0);
  assert.ok(compareLeaderboardEntries(lower, higher) > 0);
});

test('leaderboard comparator breaks ties by wrong hits then submission time', () => {
  const entries = [
    { id: 'late', score: 10, wrongHits: 1, submittedAt: 30 },
    { id: 'more-wrong', score: 10, wrongHits: 2, submittedAt: 10 },
    { id: 'early', score: 10, wrongHits: 1, submittedAt: 20 },
  ];

  assert.deepEqual(
    entries.toSorted(compareLeaderboardEntries).map(({ id }) => id),
    ['early', 'late', 'more-wrong'],
  );
  assert.equal(compareLeaderboardEntries(entries[0], entries[0]), 0);
});

test('same normalized nickname is replaced only by a better score or fewer wrong hits', () => {
  const existing = { nickname: 'alice', score: 10, wrongHits: 2 };

  assert.equal(isBetterLeaderboardEntry(
    { nickname: '  ＡLICE ', score: 11, wrongHits: 9 },
    existing,
  ), true);
  assert.equal(isBetterLeaderboardEntry(
    { nickname: 'Alice', score: 10, wrongHits: 1 },
    existing,
  ), true);
  assert.equal(isBetterLeaderboardEntry(
    { nickname: 'Alice', score: 10, wrongHits: 2 },
    existing,
  ), false);
  assert.equal(isBetterLeaderboardEntry(
    { nickname: 'Alice', score: 10, wrongHits: 3 },
    existing,
  ), false);
  assert.equal(isBetterLeaderboardEntry(
    { nickname: 'Bob', score: 99, wrongHits: 0 },
    existing,
  ), false);
});

test('leaderboard payload contains exactly the allowed submission fields', () => {
  const payload = createLeaderboardPayload({
    nickname: '  小氣球  ',
    requestId: 'request-123',
    result: {
      score: 14,
      characterId: 'k',
      correctHits: 18,
      wrongHits: 4,
      grade: 'B',
      submittedAt: 123456,
    },
  });

  assert.deepEqual(payload, {
    action: 'submit',
    requestId: 'request-123',
    nickname: '小氣球',
    score: 14,
    characterId: 'k',
    correctHits: 18,
    wrongHits: 4,
  });
  assert.deepEqual(Object.keys(payload), [
    'action',
    'requestId',
    'nickname',
    'score',
    'characterId',
    'correctHits',
    'wrongHits',
  ]);
  assert.equal('grade' in payload, false);
});

test('leaderboard payload rejects an invalid nickname with a safe Chinese error', () => {
  assert.throws(
    () => createLeaderboardPayload({
      nickname: '=unsafe',
      requestId: 'request-456',
      result: {
        score: 1,
        characterId: 'd',
        correctHits: 1,
        wrongHits: 0,
      },
    }),
    (error) => {
      assert.equal(error instanceof TypeError, true);
      assert.match(error.message, /^[^\x00-\x7f]+/u);
      return true;
    },
  );
});
