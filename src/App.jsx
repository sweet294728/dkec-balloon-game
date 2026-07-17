import {
  useEffect,
  useState,
} from 'react';

import CharacterSelect from './components/CharacterSelect.jsx';
import Hud from './components/Hud.jsx';
import Results from './components/Results.jsx';
import RulesDialog from './components/RulesDialog.jsx';
import GameCanvas from './game/GameCanvas.jsx';
import {
  GAME_ASSETS,
  MAX_HEALTH,
  ROUND_SECONDS,
} from './game/config.js';

const REQUIRED_ASSET_SOURCES = [
  GAME_ASSETS.background,
  ...Object.values(GAME_ASSETS.characters).flatMap(
    ({ gameplay, select }) => [select, gameplay],
  ),
  GAME_ASSETS.balloons,
  GAME_ASSETS.heart,
  GAME_ASSETS.dartBurst,
];

const EMPTY_HUD = {
  score: 0,
  health: MAX_HEALTH,
  remainingSeconds: ROUND_SECONDS,
};

export default function App() {
  const [screen, setScreen] = useState('select');
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [hudSummary, setHudSummary] = useState(EMPTY_HUD);
  const [finalResult, setFinalResult] = useState(null);
  const [assetsLoaded, setAssetsLoaded] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(true);
  const [documentHidden, setDocumentHidden] = useState(
    () => document.hidden,
  );

  useEffect(() => {
    let active = true;

    Promise.all(
      REQUIRED_ASSET_SOURCES.map(
        (source) => new Promise((resolve, reject) => {
          const image = new Image();

          image.onload = () => {
            if (active) {
              setAssetsLoaded((loaded) => loaded + 1);
            }
            resolve();
          };
          image.onerror = () => reject(
            new Error(`Unable to preload game asset: ${source}`),
          );
          image.src = source;
        }),
      ),
    )
      .then(() => {
        if (active) {
          setAssetsReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentHidden(document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('game-is-playing', screen === 'playing');

    return () => {
      document.body.classList.remove('game-is-playing');
    };
  }, [screen]);

  const startRound = () => {
    if (selectedCharacterId === null || !assetsReady) {
      return;
    }

    setHudSummary(EMPTY_HUD);
    setFinalResult(null);
    setScreen('playing');
  };

  const finishRound = (result) => {
    setFinalResult(result);
    setScreen('results');
  };

  const changeCharacter = () => {
    setSelectedCharacterId(null);
    setHudSummary(EMPTY_HUD);
    setFinalResult(null);
    setRulesOpen(true);
    setScreen('select');
  };

  return (
    <main className={`app app--${screen}`}>
      {screen === 'select' && (
        <>
          <CharacterSelect
            assetsLoaded={assetsLoaded}
            assetsReady={assetsReady}
            assetsTotal={REQUIRED_ASSET_SOURCES.length}
            loadError={loadError}
            onOpenRules={() => setRulesOpen(true)}
            onSelect={setSelectedCharacterId}
            onStart={startRound}
            selectedCharacterId={selectedCharacterId}
          />
          {rulesOpen && (
            <RulesDialog onClose={() => setRulesOpen(false)} />
          )}
        </>
      )}

      {screen === 'playing' && selectedCharacterId !== null && (
        <section className="game-stage" aria-label="氣球特攻訓練場">
          <Hud
            health={hudSummary.health}
            remainingSeconds={hudSummary.remainingSeconds}
            score={hudSummary.score}
          />
          <div className="game-surface">
            <GameCanvas
              characterId={selectedCharacterId}
              onRoundEnd={finishRound}
              onStateChange={setHudSummary}
              paused={documentHidden}
            />
            {documentHidden && (
              <div className="pause-overlay" role="status">
                <strong>遊戲已暫停</strong>
                <span>回到頁面即可繼續</span>
              </div>
            )}
          </div>
        </section>
      )}

      {screen === 'results' && finalResult !== null && (
        <Results
          onChangeCharacter={changeCharacter}
          onReplay={startRound}
          result={finalResult}
        />
      )}
    </main>
  );
}
