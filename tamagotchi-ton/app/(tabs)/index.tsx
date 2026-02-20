import { Link } from 'expo-router';
import React, { useState, useEffect, useCallback  } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Platform,
} from 'react-native';
import { ShaoLayers } from '@/components/ShaoLayers';
import { getMyStats, tap, upgrade, resetProgress, cheat, getEquippedMe, getInventoryMe, dailyClaim } from '@/src/api/client';

const NFT = {
  bg: '#0A0A0F',
  surface: '#12121A',
  card: '#16161F',
  cardBorder: 'rgba(0, 212, 255, 0.25)',
  cyan: '#00D4FF',
  cyanDim: 'rgba(0, 212, 255, 0.6)',
  purple: '#A855F7',
  purpleDim: 'rgba(168, 85, 247, 0.5)',
  gold: '#FBBF24',
  goldDim: 'rgba(251, 191, 36, 0.7)',
  xp: '#2be98a',
  energy: '#22D3EE',
  beanz: '#f33f32',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  glow: 'rgba(0, 212, 255, 0.35)',
  glowGold: 'rgba(251, 191, 36, 0.3)',
};

export default function App() {
  // ---- state теперь отражает данные с бэка ----
  const [energy, setEnergy] = useState(0);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [multiply, setMultiply] = useState(1);
  
  const [beanz, setBeanz] = useState(0);
  const [beanzMining, setBeanzMining] = useState(0);
  
  const [coin, setCoin] = useState(0);
  const [maxCoins, setMaxCoins] = useState(500);
  const [multiplyCoins, setMultiplyCoins] = useState(1);
  
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpToNext, setXpToNext] = useState(0);
  const [xpProgress, setXpProgress] = useState(0);
  
  const applyServerStats = useCallback((s: { energy: any; energyCap: any; coins: any; coinsCap: any; beanz: any; xp: any; tapMult: any; coinsRate: any; beanzRate: any; level: any; xpToNext: any; xpProgress: any; }) => {
    setEnergy(s.energy ?? 0);
    setMaxEnergy(s.energyCap ?? 100);
    setCoin(s.coins ?? 0);
    setMaxCoins(s.coinsCap ?? 500);
    setBeanz(s.beanz ?? 0);
    setLevel(s.level ?? 1);
    setXpToNext(s.xpToNext ?? 0);
    setXpProgress(s.xpProgress ?? 0);
    setXp(s.xp ?? 0);
    
    setMultiply(s.tapMult ?? 1);
    setMultiplyCoins(s.coinsRate ?? 1);
    setBeanzMining(s.beanzRate ?? 0);
  }, []);

  const [equipped, setEquipped] = useState({
    backgroundItemId: null,
    weaponItemId: null,
    eyesItemId: null,
    clothItemId: null,
    hatItemId: null,
  });

  const [inventory, setInventory] = useState<any[]>([]);
  
  const load = useCallback(async () => {
    try {
      const stats = await getMyStats();
      applyServerStats(stats);
      dailyClaim(); // попытка забрать ежедневный бонус при загрузке
    } catch (e) {
      console.log(e);
    }
  }, [applyServerStats]);

  const refresh = useCallback(async () => {
    try {
      const [s, eq, inv] = await Promise.all([
        getMyStats(),
        getEquippedMe(),
        getInventoryMe(),
      ]);
  
      applyServerStats(s);
  
      if (eq) {
        setEquipped({
          backgroundItemId: eq.backgroundItemId ?? eq.background_item_id ?? null,
          weaponItemId: eq.weaponItemId ?? eq.weapon_item_id ?? null,
          eyesItemId: eq.eyesItemId ?? eq.eyes_item_id ?? null,
          clothItemId: eq.clothItemId ?? eq.cloth_item_id ?? null,
          hatItemId: eq.hatItemId ?? eq.hat_item_id ?? null,
        });
      }
  
      if (Array.isArray(inv)) setInventory(inv);
    } catch (e) {
      console.log(e);
    }
  }, [applyServerStats]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // handlers (только заменяем логику, JSX не трогаем)
  const handleValueChange = async () => {
    await tap();
    await refresh();
  };

  const multiplyPlus = async () => { await upgrade('tap_plus'); await refresh(); };
  const multiplyMulti = async () => { await upgrade('tap_multi'); await refresh(); };
  const maxEnergyPlus = async () => { await upgrade('cap_energy'); await refresh(); };
  const coinsPlus = async () => { await upgrade('coin_rate'); await refresh(); };
  const beanzMiningPlus = async () => { await upgrade('beanz_mining'); await refresh(); };
  const maxCoinsPlus = async () => { await upgrade('cap_coins'); await refresh(); }

  const resetAll = async () => { await resetProgress(); await refresh(); };
  const CheatCode = async () => { await cheat(); await refresh(); };

  const fillWidth = Math.min(100, (energy / Math.max(1, maxEnergy)) * 100);

  const linkButtonStyle = StyleSheet.flatten([
    styles.linkButton,
    { borderColor: NFT.cyanDim },
  ]);

  const levelStyle = StyleSheet.flatten([
    styles.levelBar,
    { borderColor: NFT.cyanDim },
  ]);
  const levelFillStyle = StyleSheet.flatten([
    styles.levelBarFill,
    { width: `${Math.max(0, Math.min(100, xpProgress * 100))}%` as any },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, 5000);

    return () => clearInterval(id);
  }, [refresh]);

    return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>COLLECTION</Text>
            <Text style={styles.headerTitle}>Shao</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.linkText}>{`LVL ${level}`}</Text>
          <View style={levelStyle}>
            <View style={levelFillStyle} />
             <Text style={[styles.linkText, styles.xpText]}>{`${xp} / ${xpToNext} XP`}</Text>
          </View>
          </View>
        </View>

        <View style={styles.nftCardWrap}>
          {/* <View style={styles.nftCardGlow} /> */}
          <View style={styles.nftCard}>
            <View style={styles.rarityBadge}>
              <Text style={styles.rarityText}>#1</Text>
            </View>

            <TouchableOpacity
              onPress={handleValueChange}
              activeOpacity={0.9}
              style={styles.petTouchArea}
            >
              <View style={styles.petFrame}>
                <View style={styles.petFrameInner}>

                  <ShaoLayers equipped={equipped} inventory={inventory} />

                </View>
              </View>

              <Text style={styles.tapHint}>TAP TO CHARGE</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>

          <Link href="/modals/profile" dismissTo asChild>
            <TouchableOpacity style={linkButtonStyle}>
              <Link href="/modals/profile" style={styles.linkText}>INVENTORY</Link>
            </TouchableOpacity>
          </Link>
          <Link href="/modals/profile" dismissTo asChild>
            <TouchableOpacity style={linkButtonStyle}>
              <Link href="/shop" style={styles.linkText}>MARKET</Link>
            </TouchableOpacity>
          </Link>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{beanz}</Text>
            <Text style={[styles.statLabel, styles.statLabelRed]}>BEANZ</Text>
            <View style={[styles.statBar, styles.statBarEnergy]}>
              <View
                style={[
                  styles.statBarFill,
                  { width: '100%' },
                  styles.statBarFillRed,
                ]}
              />
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{coin}</Text>
            <Text style={[styles.statLabel, styles.statLabelGold]}>COINS</Text>
            <View style={styles.statBar}>
              <View style={[styles.statBarFill, styles.statBarFillGold, { width: '100%' }]} />
            </View>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressTitle}>POWER</Text>
            <Text style={styles.progressNumbers}>
              {energy} / {maxEnergy}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${fillWidth}%` }]} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>UPGRADES</Text>
        <View style={styles.upgradeGrid}>
          <TouchableOpacity onPress={multiplyPlus} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>+1 STEP</Text>
            <Text style={styles.upgradeBtnSub}>×{multiply}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={multiplyMulti} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>×1.5 MULTI</Text>
            <Text style={styles.upgradeBtnSub}>×{multiply}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={maxEnergyPlus} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>MAX ENERGY +50</Text>
            <Text style={styles.upgradeBtnSub}>{maxEnergy}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={maxCoinsPlus} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>MAX COINS +25%</Text>
            <Text style={styles.upgradeBtnSub}>{maxCoins}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>MINING BEANZ</Text>
        <View style={styles.upgradeGrid}>
          <TouchableOpacity onPress={beanzMiningPlus} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>BEANZ/M +1</Text>
            <Text style={styles.upgradeBtnSub}>×{beanzMining}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={coinsPlus} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnTitle}>COIN/M +0.5</Text>
            <Text style={styles.upgradeBtnSub}>{multiplyCoins}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.upgradeGrid}>
          <TouchableOpacity onPress={resetAll} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Сбросить прогресс</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={CheatCode} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Чит-код</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NFT.bg,
    ...Platform.select({
      web: { paddingTopTop: 0 },
      default: { paddingTop: 35 }
    })
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: NFT.cyanDim,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: NFT.text,
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelBar: {
    height: 36,
    minWidth: 120,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NFT.cyanDim,
    overflow: 'hidden',
  },
  levelBarFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: NFT.xp,
    color: NFT.beanz,
    borderRadius: 18,
    ...Platform.select({
      web: { boxShadow: `0 0 12px ${NFT.xp}` },
      default: {
        shadowColor: NFT.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
    }),
  },
  xpText: {
    textAlign: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: NFT.cyan,
  },
  nftCardWrap: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
    alignItems: 'center',
  },
  nftCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: NFT.cardBorder,
    backgroundColor: NFT.card,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: `0 0 60px ${NFT.glow}` },
      default: {
        shadowColor: NFT.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 12,
      },
    }),
  },
  rarityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    backgroundColor: NFT.purpleDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NFT.purple,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '800',
    color: NFT.text,
    letterSpacing: 1,
  },
  petTouchArea: {
    alignItems: 'center',
  },
  petFrame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NFT.cyanDim,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  petFrameInner: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: NFT.surface,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  tapHint: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: NFT.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: NFT.text,
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.cyanDim,
    marginTop: 4,
  },
  statLabelGold: {
    color: NFT.goldDim,
  },
  statLabelRed: {
    color: NFT.beanz,
  },
  statBar: {
    marginTop: 10,
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statBarEnergy: {},
  statBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  statBarFillEnergy: {
    backgroundColor: NFT.energy,
  },
  statBarFillGold: {
    backgroundColor: NFT.gold,
    width: '100%',
  },
  statBarFillRed: {
    backgroundColor: NFT.beanz,
    width: '100%',
  },
  progressSection: {
    width: '100%',
    backgroundColor: NFT.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 16,
    marginBottom: 24,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
  },
  progressNumbers: {
    fontSize: 14,
    fontWeight: '700',
    color: NFT.cyan,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: NFT.energy,
    ...Platform.select({
      web: { boxShadow: `0 0 12px ${NFT.cyan}` },
      default: {
        shadowColor: NFT.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
    }),
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
    marginBottom: 12,
    width: '100%',
    textAlign: 'left',
  },
  upgradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 28,
  },
  upgradeBtn: {
    width: '48%',
    minWidth: 130,
    backgroundColor: NFT.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 14,
  },
  upgradeBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: NFT.text,
    letterSpacing: 0.5,
  },
  upgradeBtnSub: {
    fontSize: 12,
    fontWeight: '600',
    color: NFT.cyanDim,
    marginTop: 4,
  },
  resetBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: NFT.textMuted,
  },
});