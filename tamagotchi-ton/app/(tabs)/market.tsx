import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  buyFromMarket,
  cancelMarketListing,
  createMarketListing,
  getMarketSnapshot,
} from '@/src/api/client';
// import { TonWalletCard } from '@/src/components/ton-wallet-card';
// import { getMarketCurrencyMode } from '@/src/ton/config';

type SellableItem = {
  item_id: number;
  quantity: number;
  maxListable: number;
  lockedByEquip: number;
  name: string;
  type: string;
  rarity: string;
  model_name: string;
  imageUrl: string;
};

type MarketListing = {
  id: number;
  seller_user_id: number;
  seller_username?: string;
  item_id: number;
  name: string;
  type: string;
  rarity: string;
  imageUrl: string;
  price_per_unit: number;
  quantity_total: number;
  quantity_left: number;
  isMine?: boolean;
};

const NFT = {
  bg: '#0A0A0F',
  surface: '#12121A',
  card: '#16161F',
  cardBorder: 'rgba(0, 212, 255, 0.25)',
  cyan: '#00D4FF',
  cyanDim: 'rgba(0, 212, 255, 0.6)',
  purpleDim: 'rgba(168, 85, 247, 0.5)',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  beanz: '#f33f32',
};

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Подтвердить', onPress: () => resolve(true) },
    ]);
  });
}

export default function MarketScreen() {
  // TON market mode is temporarily disabled.
  // const marketCurrencyMode = useMemo(() => getMarketCurrencyMode(), []);
  const [loading, setLoading] = useState(true);
  const [beanz, setBeanz] = useState(0);
  const [sellable, setSellable] = useState<SellableItem[]>([]);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('1');
  const [qtyInput, setQtyInput] = useState('1');

  const [creating, setCreating] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const selectedItem = useMemo(
    () => sellable.find((it) => it.item_id === selectedItemId) || null,
    [sellable, selectedItemId]
  );

  const publicListings = useMemo(
    () => listings.filter((l) => !l.isMine),
    [listings]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getMarketSnapshot();
      setBeanz(snapshot?.stats?.beanz ?? 0);
      const s: SellableItem[] = Array.isArray(snapshot?.sellable) ? snapshot.sellable : [];
      const p = Array.isArray(snapshot?.listings) ? snapshot.listings : [];
      const mine = Array.isArray(snapshot?.myListings) ? snapshot.myListings : [];
      setSellable(s);
      setListings(p);
      setMyListings(mine);
      setSelectedItemId((prev) => {
        const normalized: SellableItem[] = s;
        if (prev && normalized.some((it) => it.item_id === prev)) return prev;
        return normalized.length > 0 ? normalized[0].item_id : null;
      });
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить рынок');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshListings = useCallback(async () => {
    const snapshot = await getMarketSnapshot({ mode: 'focus' });
    setBeanz(snapshot?.stats?.beanz ?? 0);
    setListings(Array.isArray(snapshot?.listings) ? snapshot.listings : []);
    setMyListings(Array.isArray(snapshot?.myListings) ? snapshot.myListings : []);
  }, []);

  const refreshSellable = useCallback(async () => {
    const snapshot = await getMarketSnapshot();
    const normalized: SellableItem[] = Array.isArray(snapshot?.sellable) ? snapshot.sellable : [];
    setSellable(normalized);
    if (Array.isArray(snapshot?.listings)) setListings(snapshot.listings);
    if (Array.isArray(snapshot?.myListings)) setMyListings(snapshot.myListings);
    if (snapshot?.stats?.beanz != null) setBeanz(snapshot.stats.beanz);
    setSelectedItemId((prev) => {
      if (prev && normalized.some((it) => it.item_id === prev)) return prev;
      return normalized.length > 0 ? normalized[0].item_id : null;
    });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      const refreshFocusedData = async () => {
        try {
          await refreshListings();
        } catch {
          // ignore focus refresh errors
        }
      };

      refreshFocusedData();
      const id = setInterval(refreshFocusedData, 10000);
      return () => clearInterval(id);
    }, [refreshListings])
  );

  const onCreateListing = async () => {
    if (!selectedItem) {
      Alert.alert('Нет предмета', 'Выбери предмет для продажи.');
      return;
    }

    const pricePerUnit = Math.floor(Number(priceInput));
    const quantity = Math.floor(Number(qtyInput));

    if (!pricePerUnit || pricePerUnit < 1) {
      Alert.alert('Некорректная цена', 'Цена должна быть не меньше 1 BEANZ.');
      return;
    }
    if (!quantity || quantity < 1) {
      Alert.alert('Некорректное количество', 'Количество должно быть не меньше 1.');
      return;
    }
    if (quantity > selectedItem.maxListable) {
      Alert.alert('Слишком много', `Максимум для продажи: ${selectedItem.maxListable}`);
      return;
    }

    const approved = await confirmAction(
      'Подтверждение листинга',
      `${selectedItem.name}\nЦена: ${pricePerUnit} BEANZ\nКоличество: ${quantity}`
    );
    if (!approved) return;

    setCreating(true);
    try {
      await createMarketListing({
        itemId: selectedItem.item_id,
        quantity,
        pricePerUnit,
      });

      setQtyInput('1');
      await refreshSellable();
    } catch (e: any) {
      Alert.alert('Не удалось выставить лот', e?.message ?? 'Ошибка');
    } finally {
      setCreating(false);
    }
  };

  const onCancelListing = async (listing: MarketListing) => {
    if (cancelingId) return;
    const approved = await confirmAction(
      'Отменить лот?',
      `${listing.name}\nВернётся в инвентарь: ${listing.quantity_left}`
    );
    if (!approved) return;

    setCancelingId(listing.id);
    try {
      await cancelMarketListing(listing.id);
      await refreshSellable();
    } catch (e: any) {
      Alert.alert('Ошибка отмены', e?.message ?? 'Не удалось отменить лот');
    } finally {
      setCancelingId(null);
    }
  };

  const onBuyOne = async (listing: MarketListing) => {
    // TON purchase flow temporarily disabled.
    // if (marketCurrencyMode === 'ton') {
    //   Alert.alert(
    //     'TON mode',
    //     'Базовая интеграция подключена. Следующий шаг: подготовка TON-транзакции и подтверждение on-chain оплаты.'
    //   );
    //   return;
    // }

    if (buyingId) return;
    const approved = await confirmAction(
      'Купить предмет?',
      `${listing.name}\nЦена: ${listing.price_per_unit} BEANZ\nКоличество: 1`
    );
    if (!approved) return;

    setBuyingId(listing.id);
    try {
      const result: any = await buyFromMarket(listing.id, 1);
      if (typeof result?.buyerBeanz === 'number') {
        setBeanz(result.buyerBeanz);
      }
      await refreshSellable();
    } catch (e: any) {
      Alert.alert('Покупка не удалась', e?.message ?? 'Ошибка');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка рынка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>SECONDARY MARKET</Text>
            <Text style={styles.headerTitle}>P2P Listings</Text>
          </View>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceValue}>{beanz}</Text>
            <Text style={styles.balanceLabel}>BEANZ</Text>
          </View>
        </View>
        {/* <TonWalletCard /> */}
        <Text style={styles.marketMode}>
          Settlement: BEANZ
        </Text>

        <Text style={styles.sectionTitle}>Выставить предмет</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsRow}>
          {sellable.length === 0 ? (
            <Text style={styles.muted}>Нет предметов для продажи</Text>
          ) : (
            sellable.map((it) => {
              const selected = it.item_id === selectedItemId;
              return (
                <TouchableOpacity
                  key={it.item_id}
                  style={[styles.sellItemCard, selected && styles.sellItemCardActive]}
                  onPress={() => setSelectedItemId(it.item_id)}
                >
                  <Image source={{ uri: it.imageUrl }} style={styles.sellThumb} resizeMode="contain" />
                  <Text style={styles.sellName} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={styles.sellMeta}>
                    Есть: {it.quantity} · Можно: {it.maxListable}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Цена за 1 шт (BEANZ)</Text>
          <TextInput
            value={priceInput}
            onChangeText={setPriceInput}
            keyboardType="numeric"
            style={styles.input}
            placeholder="Например: 25"
            placeholderTextColor={NFT.textMuted}
          />

          <Text style={styles.formLabel}>Количество</Text>
          <TextInput
            value={qtyInput}
            onChangeText={setQtyInput}
            keyboardType="numeric"
            style={styles.input}
            placeholder="Например: 2"
            placeholderTextColor={NFT.textMuted}
          />

          <Text style={styles.hint}>
            Максимум: {selectedItem?.maxListable ?? 0}
            {selectedItem?.lockedByEquip ? ` (в экипировке: ${selectedItem.lockedByEquip})` : ''}
          </Text>

          <TouchableOpacity
            onPress={onCreateListing}
            disabled={creating || !selectedItem}
            style={[styles.actionBtn, (creating || !selectedItem) && styles.actionBtnDisabled]}
          >
            <Text style={styles.actionBtnText}>{creating ? 'Создание...' : 'Выставить на продажу'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Мои лоты</Text>
        {myListings.length === 0 ? (
          <Text style={styles.muted}>Активных лотов нет</Text>
        ) : (
          myListings.map((l) => (
            <View key={`my-${l.id}`} style={styles.listingCard}>
              <Image source={{ uri: l.imageUrl }} style={styles.listingThumb} resizeMode="contain" />
              <View style={styles.listingBody}>
                <Text style={styles.listingName}>{l.name}</Text>
                <Text style={styles.listingMeta}>
                  {l.price_per_unit} BEANZ · Осталось: {l.quantity_left}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, cancelingId === l.id && styles.actionBtnDisabled]}
                disabled={cancelingId === l.id}
                onPress={() => onCancelListing(l)}
              >
                <Text style={styles.smallBtnText}>{cancelingId === l.id ? '...' : 'Снять'}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Лоты игроков</Text>
        {publicListings.length === 0 ? (
          <Text style={styles.muted}>Пока нет доступных лотов</Text>
        ) : (
          publicListings.map((l) => (
            <View key={`pub-${l.id}`} style={styles.listingCard}>
              <Image source={{ uri: l.imageUrl }} style={styles.listingThumb} resizeMode="contain" />
              <View style={styles.listingBody}>
                <Text style={styles.listingName}>{l.name}</Text>
                <Text style={styles.listingMeta}>
                  Продавец: {l.seller_username ?? `#${l.seller_user_id}`}
                </Text>
                <Text style={styles.listingMeta}>
                  {l.price_per_unit} BEANZ · Осталось: {l.quantity_left}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, buyingId === l.id && styles.actionBtnDisabled]}
                disabled={buyingId === l.id || beanz < l.price_per_unit}
                onPress={() => onBuyOne(l)}
              >
                <Text style={styles.smallBtnText}>{buyingId === l.id ? '...' : 'Купить 1'}</Text>
              </TouchableOpacity>
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
      default: { paddingTop: 40 },
    }),
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { paddingBottom: 30 },
  muted: { color: NFT.textMuted },
  marketMode: { color: NFT.textMuted, fontSize: 12, marginBottom: 10 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLabel: { fontSize: 10, color: NFT.cyanDim, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 24, color: NFT.text, fontWeight: '800', marginTop: 4 },
  balanceCard: {
    minWidth: 100,
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  balanceValue: { color: NFT.text, fontWeight: '800', fontSize: 18 },
  balanceLabel: { color: NFT.beanz, fontWeight: '700', fontSize: 10, marginTop: 3, letterSpacing: 1 },

  sectionTitle: {
    color: NFT.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },

  itemsRow: { gap: 10, paddingBottom: 8 },
  sellItemCard: {
    width: 160,
    backgroundColor: NFT.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 10,
  },
  sellItemCardActive: { borderColor: NFT.cyan },
  sellThumb: { width: '100%', height: 90, backgroundColor: NFT.surface, borderRadius: 8, marginBottom: 8 },
  sellName: { color: NFT.text, fontWeight: '700', fontSize: 12 },
  sellMeta: { color: NFT.textMuted, fontSize: 11, marginTop: 4 },

  formCard: {
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  formLabel: { color: NFT.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    backgroundColor: NFT.surface,
    color: NFT.text,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  hint: { color: NFT.textMuted, fontSize: 11, marginBottom: 10 },
  actionBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: NFT.purpleDim,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: NFT.text, fontWeight: '700' },

  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  listingThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: NFT.surface },
  listingBody: { flex: 1 },
  listingName: { color: NFT.text, fontSize: 13, fontWeight: '700' },
  listingMeta: { color: NFT.textMuted, fontSize: 11, marginTop: 3 },
  smallBtn: {
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  smallBtnText: { color: NFT.text, fontSize: 12, fontWeight: '700' },
});
