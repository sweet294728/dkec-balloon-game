import { useEffect, useRef } from 'react';

import Leaderboard from './Leaderboard.jsx';

export default function LeaderboardDialog({ onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="rules-dialog-backdrop">
      <section
        aria-labelledby="pre-game-leaderboard-title"
        aria-modal="true"
        className="rules-dialog-card leaderboard-dialog-card"
        role="dialog"
      >
        <button
          aria-label="關閉排行榜"
          className="rules-dialog-close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>
        <h2 className="sr-only" id="pre-game-leaderboard-title">
          遊戲排行榜
        </h2>
        <Leaderboard readOnly />
      </section>
    </div>
  );
}
