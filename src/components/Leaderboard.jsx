import { useEffect, useRef, useState } from 'react';

import { loadLeaderboard, submitLeaderboard } from '../leaderboard/client.js';
import { LEADERBOARD_ENDPOINT } from '../leaderboard/config.js';
import {
  createLeaderboardPayload,
  GOLDEN_MODE_NICKNAME,
  isGoldenModeUnlock,
  validateNickname,
} from '../leaderboard/rules.js';
import { ROUND_MODES } from '../game/rules.js';

function createRequestId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Some embedded browsers expose crypto but do not allow randomUUID.
  }

  return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSubmitMessage(response) {
  const resultMessage = response.updated === false
    ? '已保留原有最佳成績。'
    : '排行榜紀錄已更新。';
  const rankMessage = response.rank == null
    ? ''
    : `目前名次第 ${response.rank} 名。`;

  return `${resultMessage}${rankMessage}`;
}

export default function Leaderboard({
  onStartGoldenMode,
  readOnly = false,
  result,
}) {
  const [nickname, setNickname] = useState('');
  const [goldenUnlocked, setGoldenUnlocked] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const mountedRef = useRef(true);
  const endpointConfigured = LEADERBOARD_ENDPOINT.trim() !== '';
  const goldenRound = result?.mode === ROUND_MODES.GOLDEN;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!endpointConfigured) {
      setLoading(false);
      setLoadError('排行榜尚未設定，請管理者設定排行榜網址。');
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setLoadError('');

    loadLeaderboard(LEADERBOARD_ENDPOINT)
      .then((nextRecords) => {
        if (!active) {
          return;
        }
        setRecords(nextRecords);
        setLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setLoadError('排行榜暫時無法載入，請稍後重試。');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpointConfigured, loadVersion]);

  function retryLoad() {
    setLoadVersion((version) => version + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (!goldenRound && isGoldenModeUnlock(nickname)) {
      setValidationError('');
      setSubmitMessage('');
      setGoldenUnlocked(true);
      return;
    }

    if (!endpointConfigured) {
      return;
    }

    const submissionNickname = goldenRound
      ? GOLDEN_MODE_NICKNAME
      : nickname;
    const validation = validateNickname(submissionNickname);
    if (!validation.valid) {
      setValidationError(validation.error);
      setSubmitMessage('');
      return;
    }

    setValidationError('');
    setSubmitMessage('');
    setSubmitting(true);

    try {
      const payload = createLeaderboardPayload({
        nickname: validation.nickname,
        requestId: createRequestId(),
        result,
      });
      const response = await submitLeaderboard(LEADERBOARD_ENDPOINT, payload);

      if (!mountedRef.current) {
        return;
      }

      setSubmitMessage(formatSubmitMessage(response));
      setLoadVersion((version) => version + 1);
    } catch {
      if (mountedRef.current) {
        setSubmitMessage('排行榜登錄失敗，請稍後再試。');
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  const visibleRecords = records.slice(0, 100);

  return (
    <section className="leaderboard-panel" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">排行榜（前 100 名）</h2>
      {!readOnly && (
        <>
          <p className="leaderboard-note">
            暱稱為選填，不登錄也能繼續領獎或遊玩。
          </p>

          {goldenUnlocked ? (
            <div className="golden-unlock" role="status">
              <strong>黃金模式已解鎖</strong>
              <button
                className="primary-action golden-start-button"
                onClick={onStartGoldenMode}
                type="button"
              >
                開始黃金模式
              </button>
            </div>
          ) : (
            <form className="leaderboard-form" noValidate onSubmit={handleSubmit}>
              <label htmlFor="leaderboard-nickname">
                {goldenRound ? '暱稱（固定）' : '暱稱（選填）'}
              </label>
              <div className="leaderboard-form-controls">
                <input
                  aria-describedby={validationError ? 'nickname-error' : undefined}
                  disabled={submitting || (goldenRound && !endpointConfigured)}
                  id="leaderboard-nickname"
                  maxLength={12}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setValidationError('');
                  }}
                  readOnly={goldenRound}
                  type="text"
                  value={goldenRound ? GOLDEN_MODE_NICKNAME : nickname}
                />
                <button
                  className="primary-action leaderboard-submit"
                  disabled={submitting || (goldenRound && !endpointConfigured)}
                  type="submit"
                >
                  {submitting ? '登錄中…' : '登錄排行榜'}
                </button>
              </div>
            </form>
          )}

          {validationError && (
            <p
              className="leaderboard-status leaderboard-status--error"
              id="nickname-error"
              role="alert"
            >
              {validationError}
            </p>
          )}

          {submitMessage && (
            <p className="leaderboard-status" role="status">
              {submitMessage}
            </p>
          )}
        </>
      )}

      {loadError && (
        <div className="leaderboard-status leaderboard-status--error" role="status">
          <p>{loadError}</p>
          {endpointConfigured && (
            <button type="button" onClick={retryLoad} disabled={loading}>
              重新載入排行榜
            </button>
          )}
        </div>
      )}

      {loading && (
        <p className="leaderboard-status" role="status">
          排行榜載入中…
        </p>
      )}

      {!loading && !loadError && endpointConfigured && (
        <>
          <div className="leaderboard-row leaderboard-row--header" aria-hidden="true">
            <span>名次</span>
            <span>暱稱</span>
            <span>分數</span>
            <span>等級</span>
            <span>角色</span>
          </div>
          <ol className="leaderboard-list" aria-label="排行榜名次">
            {visibleRecords.map((record, index) => (
              <li
                className="leaderboard-row"
                key={record.recordId ?? `${record.nickname}-${index}`}
              >
                <span aria-label={`名次 ${record.rank ?? index + 1}`}>
                  {record.rank ?? index + 1}
                </span>
                <span className="leaderboard-nickname">{record.nickname}</span>
                <span aria-label={`分數 ${record.score}`}>{record.score}</span>
                <span aria-label={`等級 ${record.grade}`}>{record.grade}</span>
                <span aria-label={`角色 ${String(record.characterId).toUpperCase()}`}>
                  {String(record.characterId).toUpperCase()}
                </span>
              </li>
            ))}
          </ol>
          {visibleRecords.length === 0 && (
            <p className="leaderboard-status">目前尚無排行榜紀錄。</p>
          )}
        </>
      )}
    </section>
  );
}
