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
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getShopCategories, getShopItems, buyItem, getMyStats } from '../../src/api/client';

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
  beanz: '#f33f32',
  beanzDim: '#992a25',
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
  supply: number;
  imageUrl: string;
};

function confirmBuy(item: ShopItem): Promise<boolean> {
  const message = `${item.name}\nЦена: ${item.price} BEANZ`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`Подтвердить покупку?\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert('Подтверждение покупки', message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Купить', onPress: () => resolve(true) },
    ]);
  });
}

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const contentWidth = Math.max(280, width - (isCompact ? 24 : 32));
  const gridGap = 10;
  const columns = width >= 900 ? 4 : width >= 640 ? 3 : width >= 360 ? 2 : 1;
  const itemCardWidth =
    columns === 1
      ? contentWidth
      : Math.floor((contentWidth - gridGap * (columns - 1)) / columns);

  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const [beanz, setBeanz] = useState(0);

  const [categories, setCategories] = useState<string[]>([]);
  const [activeType, setActiveType] = useState<string>('');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const activeLabel = useMemo(() => (activeType ? activeType : 'all'), [activeType]);

  const applyServerStats = useCallback((s: {
      beanz: any;
    }) => {
      setBeanz(s.beanz ?? 0);
    }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, stats] = await Promise.all([getShopCategories(), getMyStats()]);
      setCategories(cats || []);
      setBeanz(stats?.beanz ?? 0);

      const defaultType = (cats && cats.length > 0) ? cats[0] : '';
      setActiveType(defaultType);

      const shopItems = await getShopItems({
        ...(defaultType ? { type: defaultType } : {}),
      });
      setItems(Array.isArray(shopItems) ? shopItems : []);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить магазин');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (type: string, query: string = searchQuery) => {
    setItemsLoading(true);
    try {
      const shopItems = await getShopItems({
        ...(type ? { type } : {}),
        ...(query ? { q: query } : {}),
      });
      setItems(Array.isArray(shopItems) ? shopItems : []);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить товары');
    } finally {
      setItemsLoading(false);
    }
  }, [searchQuery]);

  const refresh = useCallback(async () => {
    try {
      const [s] = await Promise.all([
        getMyStats(),
      ]);

      applyServerStats(s);
    } catch (e) {
      console.log(e);
    }
  }, [applyServerStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(() => {
        refresh();
      }, 8000);

      return () => clearInterval(id);
    }, [refresh])
  );

  const onSelectCategory = async (type: string) => {
    setActiveType(type);
    await loadItems(type, searchQuery);
  };

  const onApplySearch = async () => {
    const next = searchInput.trim();
    setSearchQuery(next);
    await loadItems(activeType, next);
  };

  const onResetSearch = async () => {
    setSearchInput('');
    setSearchQuery('');
    await loadItems(activeType, '');
  };

  const onBuy = async (item: ShopItem) => {
    if (buyingId) return;

    // локальная проверка — чисто UX (сервер всё равно перепроверит)
    if (beanz < item.price) {
      Alert.alert('Недостаточно бобов', `Нужно: ${item.price}`);
      return;
    }

    const approved = await confirmBuy(item);
    if (!approved) return;

    setBuyingId(item.id);
    try {
      const resp: any = await buyItem(item.id);
      const nextSupply =
        typeof resp?.remainingSupply === 'number'
          ? resp.remainingSupply
          : Math.max(0, item.supply - 1);
      const spent = typeof resp?.spent === 'number' ? resp.spent : item.price;

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, supply: nextSupply } : it))
      );

      if (typeof resp?.stats?.beanz === 'number') {
        setBeanz(resp.stats.beanz);
      } else {
        setBeanz((prev) => Math.max(0, prev - spent));
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert('Покупка не удалась', e?.message ?? 'Ошибка');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, isCompact && styles.containerCompact, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка магазина…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      {/* Header */}
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View>
          <Text style={styles.headerLabel}>SHOP</Text>
          <Text style={styles.headerTitle}>Items</Text>
          <Text style={styles.headerSub}>Category: {activeLabel}</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceValue}>{beanz}</Text>
          <Text style={styles.balanceLabel}>BEANZ</Text>
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsWrap}
        contentContainerStyle={styles.tabs}
      >
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
      </ScrollView>

      <View style={[styles.searchRow, isCompact && styles.searchRowCompact]}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Поиск по названию или файлу"
          placeholderTextColor={NFT.textMuted}
          style={[styles.searchInput, isCompact && styles.searchInputCompact]}
          onSubmitEditing={onApplySearch}
          returnKeyType="search"
        />

        <View style={[styles.searchActions, isCompact && styles.searchActionsCompact]}>
          <TouchableOpacity
            style={[styles.searchBtn, isCompact && styles.searchActionBtn]}
            onPress={onApplySearch}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
          {searchQuery ? (
            <TouchableOpacity
              style={[styles.clearBtn, isCompact && styles.searchActionBtn]}
              onPress={onResetSearch}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {itemsLoading ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator />
            <Text style={styles.muted}>Обновляем товары...</Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>В этой категории нет доступных предметов.</Text>
            <Text style={styles.mutedSmall}>Если ты всё купил - так и должно быть</Text>
          </View>
        ) : (
          items.map((it) => (
            <View
              key={it.id}
              style={[
                styles.itemCard,
                { width: itemCardWidth },
                isCompact && styles.itemCardCompact,
              ]}
            >
              <View style={styles.thumbWrap}>
                <Image source={{ uri: it.imageUrl }} style={styles.thumb} resizeMode="contain" />
              </View>

              <Text numberOfLines={1} style={styles.itemName}>
                {it.name}
              </Text>
              <Text style={styles.itemMeta}>
                {it.rarity} • {it.type} • {it.supply}
              </Text>

              <View style={[styles.priceRow, isCompact && styles.priceRowCompact]}>
                <Text style={styles.price}>{it.price} BEANZ</Text>
                <TouchableOpacity
                  onPress={() => onBuy(it)}
                  style={[
                    styles.buyBtn,
                    isCompact && styles.buyBtnCompact,
                    (buyingId === it.id || it.supply <= 0 || beanz < it.price) && styles.buyBtnDisabled,
                  ]}
                  disabled={buyingId === it.id || it.supply <= 0 || beanz < it.price}
                >
                  <Text style={styles.buyText}>
                    {it.supply <= 0 ? 'SOLD OUT' : buyingId === it.id ? '...' : 'BUY'}
                  </Text>
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
  container: {
    flex: 1,
    backgroundColor: NFT.bg,
    padding: 16,
    ...Platform.select({
      web: { paddingTop: 0 },
      default: { paddingTop: 50 }
    })
  },
  containerCompact: {
    paddingHorizontal: 12,
  },
  center: { justifyContent: 'center', alignItems: 'center', gap: 10 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  headerCompact: {
    flexWrap: 'wrap',
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
  balanceLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: NFT.beanz, marginTop: 4 },

  tabsWrap: { marginBottom: 12, minHeight: 40 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
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

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  searchRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    backgroundColor: NFT.surface,
    color: NFT.text,
    paddingHorizontal: 12,
  },
  searchInputCompact: {
    width: '100%',
  },
  searchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchActionsCompact: {
    width: '100%',
  },
  searchBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  searchActionBtn: {
    flex: 1,
    alignItems: 'center',
  },
  searchBtnText: { color: NFT.text, fontWeight: '700', fontSize: 12 },
  clearBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearBtnText: { color: NFT.textMuted, fontWeight: '700', fontSize: 12 },

  grid: {
    paddingBottom: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  itemCard: {
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 16,
    padding: 12,
  },
  itemCardCompact: {
    padding: 10,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: NFT.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  thumb: { width: '90%', height: '90%' },

  itemName: { color: NFT.text, fontWeight: '800', fontSize: 13 },
  itemMeta: { color: NFT.textMuted, fontSize: 11, marginTop: 4 },

  priceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priceRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  price: { color: NFT.beanzDim, fontWeight: '800', fontSize: 12 },

  buyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyBtnCompact: {
    width: '100%',
  },
  buyBtnDisabled: { 
    opacity: 0.5,
    color: '#cccccc',
    backgroundColor: '#000000',
   },
  buyText: { color: NFT.text, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  empty: { width: '100%', paddingTop: 40, alignItems: 'center', gap: 6 },
  muted: { color: NFT.textMuted, fontWeight: '600' },
  mutedSmall: { color: NFT.textMuted, fontSize: 12 },
  loadingInline: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
});
