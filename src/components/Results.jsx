import {
  getGradeReward,
  getScoreGrade,
  getScoreProgress,
} from '../game/rules.js';
import Leaderboard from './Leaderboard.jsx';

export default function Results({
  onChangeCharacter,
  onReplay,
  onStartGoldenMode,
  result,
}) {
  const grade = getScoreGrade(result.score);
  const progress = getScoreProgress(result.score);
  const reward = getGradeReward(grade.id);

  return (
    <section className="results-screen" aria-labelledby="results-title">
      <div className="results-card">
        <p className="eyebrow">訓練報告</p>
        <h1 id="results-title">任務結束</h1>

        <div className="results-reward-row">
          <div
            className={`results-grade results-grade--${grade.id.toLowerCase()}`}
            aria-label={`此次遊玩等級 ${grade.id}，${grade.label}`}
          >
            <span>此次遊玩等級</span>
            <strong>{grade.id}</strong>
            <small>{grade.label}</small>
          </div>

          {reward !== null && (
            <a
              aria-label={`領取 ${grade.id} 級獎勵，官網購物金 NT$${reward.amount}`}
              className="reward-action"
              href={reward.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span>領券</span>
              <strong>NT${reward.amount}</strong>
            </a>
          )}
        </div>

        <dl className="results-summary">
          <div className="results-score">
            <dt>最終分數</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>正確命中</dt>
            <dd>{result.correctHits}</dd>
          </div>
          <div>
            <dt>錯誤命中</dt>
            <dd>{result.wrongHits}</dd>
          </div>
        </dl>

        <p className="results-progress" role="status">
          {progress.isTopGrade
            ? '恭喜！已達最高等級 S'
            : `距離下一等級 ${progress.nextGrade.id} 還差 ${progress.pointsToNext} 分`}
        </p>

        <Leaderboard
          onStartGoldenMode={onStartGoldenMode}
          result={result}
        />

        <div className="results-actions">
          <button
            className="primary-action"
            onClick={onReplay}
            type="button"
          >
            再玩一次
          </button>
          <button
            className="secondary-action"
            onClick={onChangeCharacter}
            type="button"
          >
            更換角色
          </button>
        </div>
      </div>
    </section>
  );
}
