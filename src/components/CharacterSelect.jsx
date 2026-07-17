import {
  CHARACTERS,
  GAME_ASSETS,
} from '../game/config.js';

const characterIds = Object.keys(CHARACTERS);

export default function CharacterSelect({
  assetsLoaded,
  assetsReady,
  assetsTotal,
  loadError,
  onOpenLeaderboard,
  onOpenRules,
  onSelect,
  onStart,
  selectedCharacterId,
}) {
  return (
    <section className="selection-screen" aria-labelledby="selection-title">
      <header className="selection-header">
        <p className="eyebrow">60 秒氣球訓練</p>
        <h1>DKEC 氣球特攻隊</h1>
        <p id="selection-title">選擇你的出戰角色</p>
      </header>

      <div className="selection-utility-actions">
        <button
          className="rules-open-button"
          onClick={onOpenRules}
          type="button"
        >
          <span aria-hidden="true">?</span>
          規則說明
        </button>
        <button
          className="leaderboard-open-button"
          onClick={onOpenLeaderboard}
          type="button"
        >
          查看排行榜
        </button>
      </div>

      <aside hidden className="target-rule-banner" aria-label="射擊規則">
        <p aria-label="選擇 D寶、K寶：只能射 E、C 氣球">
          選擇 <strong>D寶、K寶</strong>：只能射 <strong>E、C</strong> 氣球
        </p>
        <p aria-label="選擇 E寶、C寶：只能射 D、K 氣球">
          選擇 <strong>E寶、C寶</strong>：只能射 <strong>D、K</strong> 氣球
        </p>
      </aside>

      <div className="character-grid" aria-label="可選角色">
        {characterIds.map((characterId) => {
          const character = CHARACTERS[characterId];
          const selected = selectedCharacterId === characterId;

          return (
            <button
              aria-pressed={selected}
              className="character-card"
              key={characterId}
              onClick={() => onSelect(characterId)}
              style={{ '--character-color': character.color }}
              type="button"
            >
              <span className="character-portrait">
                <img
                  alt={`${character.displayName} 正面角色圖`}
                  src={GAME_ASSETS.characters[characterId].select}
                />
              </span>
              <strong>{character.displayName}</strong>
              <span>{character.team.toUpperCase()} 小隊</span>
              <span className="selection-mark" aria-hidden="true">
                {selected ? '✓ 已選擇' : '選擇'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="selection-actions">
        {!assetsReady && (
          <p className="asset-status" role="status">
            {loadError
              ? '素材載入失敗，請重新整理後再試'
              : `任務素材載入中 ${assetsLoaded} / ${assetsTotal}`}
          </p>
        )}
        <button
          className="primary-action"
          disabled={!assetsReady || selectedCharacterId === null}
          onClick={onStart}
          type="button"
        >
          開始任務
        </button>
      </div>
    </section>
  );
}
