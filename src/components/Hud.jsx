import { MAX_HEALTH } from '../game/config.js';
import { ROUND_MODES } from '../game/rules.js';

export default function Hud({
  health,
  mode,
  remainingSeconds,
  score,
}) {
  const safeHealth = Math.max(0, Math.min(MAX_HEALTH, health));
  const safeSeconds = Math.max(0, Math.ceil(remainingSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');

  return (
    <header className="hud">
      {mode === ROUND_MODES.GOLDEN && (
        <span className="golden-mode-badge">黃金模式</span>
      )}
      <div className="hud-metric">
        <span>分數</span>
        <strong>{score}</strong>
      </div>

      <div
        aria-label={`生命值 ${health} / ${MAX_HEALTH}`}
        className="heart-meter"
        role="img"
      >
        {Array.from({ length: MAX_HEALTH }, (_, index) => {
          const filled = index < safeHealth;

          return (
            <span
              aria-hidden="true"
              className={filled ? 'heart heart--filled' : 'heart heart--empty'}
              key={index}
            >
              {filled ? '♥' : '♡'}
            </span>
          );
        })}
      </div>

      <div className="hud-metric hud-timer">
        <span>時間</span>
        <strong>{minutes}:{seconds}</strong>
      </div>

      <p aria-live="polite" className="sr-only">
        分數 {score}，剩餘時間 {minutes} 分 {seconds} 秒
      </p>
    </header>
  );
}
