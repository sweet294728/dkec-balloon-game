const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const UNSAFE_LEADING_CHARACTER_PATTERN = /^[=+\-@]/;

export const GOLDEN_MODE_NICKNAME = 'DKEC';

export function isGoldenModeUnlock(value) {
  return value === GOLDEN_MODE_NICKNAME;
}

export function normalizeNickname(value) {
  return String(value).trim().normalize('NFKC').trim().toLowerCase();
}

export function validateNickname(value) {
  const rawNickname = String(value);
  const nickname = rawNickname.trim();
  const normalizedNickname = normalizeNickname(value);
  const result = {
    valid: false,
    nickname,
    normalizedNickname,
    error: null,
  };

  if (nickname.length === 0) {
    return {
      ...result,
      error: '暱稱不可空白。',
    };
  }

  if (Array.from(nickname).length > 12) {
    return {
      ...result,
      error: '暱稱最多 12 個字元。',
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(rawNickname)) {
    return {
      ...result,
      error: '暱稱含有不允許的控制字元。',
    };
  }

  if (UNSAFE_LEADING_CHARACTER_PATTERN.test(nickname)) {
    return {
      ...result,
      error: '暱稱不可使用 =、+、- 或 @ 開頭。',
    };
  }

  return {
    valid: true,
    nickname,
    normalizedNickname,
    error: null,
  };
}

export function compareLeaderboardEntries(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.wrongHits !== right.wrongHits) {
    return left.wrongHits - right.wrongHits;
  }

  if (left.submittedAt < right.submittedAt) {
    return -1;
  }

  if (left.submittedAt > right.submittedAt) {
    return 1;
  }

  return 0;
}

export function isBetterLeaderboardEntry(candidate, existing) {
  const candidateNickname = candidate.normalizedNickname
    ?? normalizeNickname(candidate.nickname);
  const existingNickname = existing.normalizedNickname
    ?? normalizeNickname(existing.nickname);

  if (candidateNickname !== existingNickname) {
    return false;
  }

  return candidate.score > existing.score
    || (
      candidate.score === existing.score
      && candidate.wrongHits < existing.wrongHits
    );
}

export function createLeaderboardPayload({ nickname, result, requestId }) {
  const validation = validateNickname(nickname);

  if (!validation.valid) {
    throw new TypeError(validation.error);
  }

  return {
    action: 'submit',
    requestId,
    nickname: validation.nickname,
    score: result.score,
    characterId: result.characterId,
    correctHits: result.correctHits,
    wrongHits: result.wrongHits,
  };
}
