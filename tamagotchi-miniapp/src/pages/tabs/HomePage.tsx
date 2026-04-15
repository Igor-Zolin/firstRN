import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cheat,
  dailyClaim,
  downloadAvatar,
  getHomeSnapshot,
  getMyStats,
  resetProgress,
  tap,
  upgrade,
} from '../../api/client';
import type { Equipped, InventoryItem, Stats } from '../../types';

const defaultEquipped: Equipped = {
  backgroundItemId: null,
  weaponItemId: null,
  eyesItemId: null,
  clothItemId: null,
  hatItemId: null,
};

function byId(items: InventoryItem[]) {
  const map = new Map<number, InventoryItem>();
  items.forEach((item) => map.set(item.item_id, item));
  return map;
}

export function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [equipped, setEquipped] = useState<Equipped>(defaultEquipped);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const dailyClaimDayRef = useRef<number | null>(null);

  const itemMap = useMemo(() => byId(inventory), [inventory]);

  const layers = useMemo(() => {
    const ids = [
      equipped.backgroundItemId,
      equipped.weaponItemId,
      equipped.clothItemId,
      equipped.eyesItemId,
      equipped.hatItemId,
    ].filter((id): id is number => Boolean(id));

    return ids.map((id) => itemMap.get(id)?.imageUrl).filter((value): value is string => Boolean(value));
  }, [equipped, itemMap]);

  const applyStats = useCallback((next: Stats) => {
    setStats(next);
  }, []);

  const refresh = useCallback(async () => {
    const snapshot = await getHomeSnapshot();
    if (snapshot?.stats) applyStats(snapshot.stats);
    if (snapshot?.equipped) setEquipped(snapshot.equipped);
    if (Array.isArray(snapshot?.inventory)) setInventory(snapshot.inventory);
  }, [applyStats]);

  const refreshStatsOnly = useCallback(async () => {
    const next = await getMyStats();
    applyStats(next);
  }, [applyStats]);

  const tryDailyClaim = useCallback(async () => {
    const dayUtc = Math.floor(Date.now() / 86400000);
    if (dailyClaimDayRef.current === dayUtc) return;
    dailyClaimDayRef.current = dayUtc;

    try {
      const result = await dailyClaim();
      if (result?.claimed) {
        await refreshStatsOnly();
      }
    } catch {
      // ignore daily errors
    }
  }, [refreshStatsOnly]);

  useEffect(() => {
    void refresh();
    void tryDailyClaim();

    const id = window.setInterval(() => {
      void refreshStatsOnly();
    }, 8000);

    return () => window.clearInterval(id);
  }, [refresh, refreshStatsOnly, tryDailyClaim]);

  const runAction = useCallback(
    async (action: () => Promise<Stats>) => {
      if (busy) return;
      setBusy(true);
      setNote('');
      try {
        applyStats(await action());
      } catch (error) {
        setNote(error instanceof Error ? error.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [applyStats, busy]
  );

  const levelProgress = Math.max(0, Math.min(100, (stats?.xpProgress ?? 0) * 100));
  const energyProgress = Math.max(0, Math.min(100, ((stats?.energy ?? 0) / Math.max(1, stats?.energyCap ?? 1)) * 100));

  const coin = stats?.coins ?? 0;
  const maxCoins = stats?.coinsCap ?? 500;
  const multiply = stats?.tapMult ?? 1;
  const maxEnergy = stats?.energyCap ?? 100;
  const beanz = stats?.beanz ?? 0;
  const beanzMining = stats?.beanzRate ?? 0;
  const upgBeanzLevel = stats?.upg_beanz_level ?? 0;
  const multiplyCoins = stats?.coinsRate ?? 1;

  return (
    <section className="screen screen-home">
      <div className="screen-scroll">
        <div className="home-header">
          <div>
            <p className="header-label">COLLECTION</p>
            <h2 className="header-title">Shao</h2>
          </div>

          <div className="home-level-row">
            <span className="home-level-text">LVL {stats?.level ?? 1}</span>
            <div className="home-level-bar">
              <div className="home-level-fill" style={{ width: `${levelProgress}%` }} />
              <span className="home-level-caption">
                {stats?.xp ?? 0} / {stats?.xpToNext ?? 0} XP
              </span>
            </div>
          </div>
        </div>

        <div className="home-nft-wrap">
          <div className="home-nft-card">
            <div className="home-rarity-badge">#1</div>

            <button className="home-pet-touch" onClick={() => void runAction(tap)} disabled={busy}>
              <div className="home-pet-frame">
                <div className="home-pet-inner">
                  {layers.length > 0 ? (
                    layers.map((src, index) => (
                      <img key={`${src}-${index}`} className="home-layer" src={src} alt="equipped layer" loading="lazy" />
                    ))
                  ) : (
                    <span className="muted">No equipped items</span>
                  )}
                </div>
              </div>
              <span className="home-tap-hint">TAP TO CHARGE</span>
            </button>
          </div>

          <button className="reset-btn" onClick={() => void downloadAvatar()}>
            MINT AVATAR
          </button>

          <div className="home-link-row">
            <Link className="link-btn" to="/profile">INVENTORY</Link>
            <Link className="link-btn" to="/shop">MARKET</Link>
          </div>
        </div>

        <div className="home-stats-row">
          <div className="home-stat-card">
            <p className="home-stat-value">{beanz}</p>
            <p className="home-stat-label beanz">BEANZ</p>
          </div>
          <div className="home-stat-card">
            <p className="home-stat-value">{coin}</p>
            <p className="home-stat-label gold">COINS</p>
          </div>
        </div>

        <div className="home-progress-card">
          <div className="home-progress-head">
            <span className="home-progress-title">POWER</span>
            <span className="home-progress-numbers">{stats?.energy ?? 0} / {maxEnergy}</span>
          </div>
          <div className="home-progress-track">
            <div className="home-progress-fill" style={{ width: `${energyProgress}%` }} />
          </div>
        </div>

        <p className="section-title">UPGRADES</p>
        <div className="upgrade-grid">
          <button className="upgrade-btn" disabled={coin < Math.floor(maxCoins * 0.1) || busy} onClick={() => void runAction(() => upgrade('tap_plus'))}>
            <span>+1 STEP</span>
            <span className="upgrade-sub">×{multiply} · {Math.floor(maxCoins * 0.1)} COINS</span>
          </button>
          <button className="upgrade-btn" disabled={coin < Math.floor(maxCoins * 0.33) || busy} onClick={() => void runAction(() => upgrade('tap_multi'))}>
            <span>×1.5 MULTI</span>
            <span className="upgrade-sub">×{multiply} · {Math.floor(maxCoins * 0.33)} COINS</span>
          </button>
          <button className="upgrade-btn" disabled={coin < Math.floor(maxCoins * 0.7) || busy} onClick={() => void runAction(() => upgrade('cap_energy'))}>
            <span>MAX ENERGY +50</span>
            <span className="upgrade-sub">{maxEnergy} · {Math.floor(maxCoins * 0.7)} COINS</span>
          </button>
          <button className="upgrade-btn" disabled={coin < Math.floor(maxCoins * 0.8) || busy} onClick={() => void runAction(() => upgrade('cap_coins'))}>
            <span>MAX COINS +25%</span>
            <span className="upgrade-sub">{maxCoins} · {Math.floor(maxCoins * 0.8)} COINS</span>
          </button>
        </div>

        <p className="section-title">MINING</p>
        <div className="upgrade-grid">
          <button
            className="upgrade-btn"
            disabled={coin < Math.floor(maxCoins * 0.5 + upgBeanzLevel * upgBeanzLevel * 20) || busy}
            onClick={() => void runAction(() => upgrade('beanz_mining'))}
          >
            <span>BEANZ/M +1</span>
            <span className="upgrade-sub">
              ×{beanzMining} · {Math.min(Math.floor(maxCoins * 0.5 + upgBeanzLevel * upgBeanzLevel * 20), maxCoins)} COINS
            </span>
          </button>
          <button className="upgrade-btn" disabled={coin < Math.floor(maxCoins * 0.9) || busy} onClick={() => void runAction(() => upgrade('coin_rate'))}>
            <span>COIN/M +0.2</span>
            <span className="upgrade-sub">{multiplyCoins} · {Math.floor(maxCoins * 0.9)} COINS</span>
          </button>
        </div>

        <div className="upgrade-grid">
          <button className="reset-btn" onClick={() => void runAction(resetProgress)}>Reset progress</button>
          <button className="reset-btn" onClick={() => void runAction(cheat)}>Cheat-code</button>
        </div>

        {note ? <p className="screen-note">{note}</p> : null}
      </div>
    </section>
  );
}
