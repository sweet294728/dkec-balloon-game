import { useEffect, useRef } from 'react';

import { GAME_ASSETS } from '../game/config.js';

const BALLOON_POSITIONS = {
  d: '0% center',
  k: '33.333% center',
  e: '66.666% center',
  c: '100% center',
};

function BalloonIcon({ letter }) {
  return (
    <span
      aria-label={`${letter.toUpperCase()} 氣球`}
      className="rules-balloon-icon"
      role="img"
      style={{
        backgroundImage: `url(${GAME_ASSETS.balloons})`,
        backgroundPosition: BALLOON_POSITIONS[letter],
      }}
    />
  );
}

function CharacterPair({ letters }) {
  return (
    <span className="rules-character-pair">
      {letters.map((letter) => (
        <img
          alt={`${letter.toUpperCase()}寶`}
          key={letter}
          src={GAME_ASSETS.characters[letter].select}
        />
      ))}
    </span>
  );
}

export default function RulesDialog({ onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div className="rules-dialog-backdrop">
      <section
        aria-labelledby="rules-dialog-title"
        aria-modal="true"
        className="rules-dialog-card"
        role="dialog"
      >
        <button
          aria-label="關閉規則說明"
          className="rules-dialog-close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>

        <header className="rules-dialog-header">
          <p className="eyebrow">任務開始前</p>
          <h2 id="rules-dialog-title">規則說明</h2>
          <p>認清隊伍顏色，射中正確的目標氣球！</p>
        </header>

        <div className="rules-team-grid">
          <div className="rules-team-card">
            <CharacterPair letters={['d', 'k']} />
            <strong>D寶、K寶只能射</strong>
            <span className="rules-balloon-pair">
              <BalloonIcon letter="e" />
              <BalloonIcon letter="c" />
            </span>
          </div>
          <div className="rules-team-card">
            <CharacterPair letters={['e', 'c']} />
            <strong>E寶、C寶只能射</strong>
            <span className="rules-balloon-pair">
              <BalloonIcon letter="d" />
              <BalloonIcon letter="k" />
            </span>
          </div>
        </div>

        <div className="rules-score-list">
          <p><span className="rules-token rules-token--good">✓</span>射中正確氣球：<strong>+1 分</strong></p>
          <p><span className="rules-token rules-token--bad">×</span>射中錯誤氣球：<strong>-1 分、扣 1 顆心</strong></p>
          <p>
            <img alt="愛心氣球" src={GAME_ASSETS.heart} />
            射中愛心氣球：<strong>補 1 顆心，滿心時則 +1 分</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
