import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getMyStats } from '../../src/api/client';
import { getShopCategories, getShopItemsMe, buyItem } from '../../src/api/client';

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
  red: '#f33f32',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
};

type ShopItem = {
  id: number;
  name: string;
  type: string;
  model_name: string;
  rarity: string;
  price: number;
  imageUrl: string;
};

export default function ShopScreen() {
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const [coins, setCoins] = useState(0);

  const [categories, setCategories] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<string>('');
  const [items, setItems] = useState<ShopItem[]>([]);

  const activeLabel = useMemo(() => (activeType ? activeType : 'all'), [activeType]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, stats] = await Promise.all([getShopCategories(), getMyStats()]);
      setCategories(cats || []);
      setCoins(stats?.coins ?? 0);

      const defaultType = (cats && cats.length > 0) ? cats[0] : '';
      setActiveType(defaultType);

      const shopItems = await getShopItemsMe(defaultType ? { type: defaultType } : {});
      setItems(Array.isArray(shopItems) ? shopItems : []);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить магазин');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const [stats, shopItems] = await Promise.all([
        getMyStats(),
        getShopItemsMe(type ? { type } : {}),
      ]);
      setCoins(stats?.coins ?? 0);
      setItems(Array.isArray(shopItems) ? shopItems : []);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить товары');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onSelectCategory = async (type: string) => {
    setActiveType(type);
    await loadItems(type);
  };

  const onBuy = async (item: ShopItem) => {
    if (buyingId) return;

    // локальная проверка — чисто UX (сервер всё равно перепроверит)
    if (coins < item.price) {
      Alert.alert('Недостаточно монет', `Нужно: ${item.price}`);
      return;
    }

    setBuyingId(item.id);
    try {
      await buyItem(item.id);

      // после покупки: обновляем coins + список товаров (купленное пропадёт)
      await loadItems(activeType);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Покупка не удалась', e?.message ?? 'Ошибка');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка магазина…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>SHOP</Text>
          <Text style={styles.headerTitle}>Items</Text>
          <Text style={styles.headerSub}>Category: {activeLabel}</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceValue}>{coins}</Text>
          <Text style={styles.balanceLabel}>COINS</Text>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.tabs}>
        {categories.map((c) => {
          const active = c === activeType;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onSelectCategory(c)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Items grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>В этой категории нет доступных предметов.</Text>
            <Text style={styles.mutedSmall}>Если ты всё купил — так и должно быть 🙂</Text>
          </View>
        ) : (
          items.map((it) => (
            <View key={it.id} style={styles.itemCard}>
              <View style={styles.thumbWrap}>
                <Image source={{ uri: it.imageUrl }} style={styles.thumb} resizeMode="contain" />
              </View>

              <Text numberOfLines={1} style={styles.itemName}>
                {it.name}
              </Text>
              <Text style={styles.itemMeta}>
                {it.rarity} • {it.type}
              </Text>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{it.price} COINS</Text>
                <TouchableOpacity
                  onPress={() => onBuy(it)}
                  style={[styles.buyBtn, buyingId === it.id && styles.buyBtnDisabled]}
                  disabled={buyingId === it.id}
                >
                  <Text style={styles.buyText}>{buyingId === it.id ? '...' : 'BUY'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NFT.bg, padding: 16 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 10 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: NFT.cyanDim },
  headerTitle: { fontSize: 26, fontWeight: '800', color: NFT.text, marginTop: 2 },
  headerSub: { fontSize: 12, color: NFT.textMuted, marginTop: 6 },

  balanceCard: {
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 96,
  },
  balanceValue: { fontSize: 18, fontWeight: '800', color: NFT.text },
  balanceLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: NFT.goldDim, marginTop: 4 },

  tabs: {
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'row',
   },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  tabActive: { backgroundColor: NFT.card, borderColor: NFT.cyanDim },
  tabText: { color: NFT.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: NFT.cyan },

  grid: {
    paddingBottom: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemCard: {
    width: '48%',
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 16,
    padding: 12,
  },
  thumbWrap: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    backgroundColor: NFT.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  thumb: { width: '90%', height: '90%' },

  itemName: { color: NFT.text, fontWeight: '800', fontSize: 13 },
  itemMeta: { color: NFT.textMuted, fontSize: 11, marginTop: 4 },

  priceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: NFT.goldDim, fontWeight: '800', fontSize: 12 },

  buyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyText: { color: NFT.text, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  empty: { width: '100%', paddingTop: 40, alignItems: 'center', gap: 6 },
  muted: { color: NFT.textMuted, fontWeight: '600' },
  mutedSmall: { color: NFT.textMuted, fontSize: 12 },
});
