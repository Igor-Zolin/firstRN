import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  buyFromMarket,
  cancelMarketListing,
  getMarketSnapshot,
} from '@/src/api/client';
// import { TonWalletCard } from '@/src/components/ton-wallet-card';
// import { getMarketCurrencyMode } from '@/src/ton/config';

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
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  // TON market mode is temporarily disabled.
  // const marketCurrencyMode = useMemo(() => getMarketCurrencyMode(), []);
  const [loading, setLoading] = useState(true);
  const [beanz, setBeanz] = useState(0);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const publicListings = useMemo(
    () => listings.filter((l) => !l.isMine),
    [listings]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getMarketSnapshot({ mode: 'focus' });
      setBeanz(snapshot?.stats?.beanz ?? 0);
      const p = Array.isArray(snapshot?.listings) ? snapshot.listings : [];
      const mine = Array.isArray(snapshot?.myListings) ? snapshot.myListings : [];
      setListings(p);
      setMyListings(mine);
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
      await refreshListings();
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
      await refreshListings();
    } catch (e: any) {
      Alert.alert('Покупка не удалась', e?.message ?? 'Ошибка');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, isCompact && styles.containerCompact, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка рынка...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, isCompact && styles.headerCompact]}>
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

        <Text style={styles.sectionTitle}>Мои лоты</Text>
        {myListings.length === 0 ? (
          <Text style={styles.muted}>Активных лотов нет</Text>
        ) : (
          <View style={styles.grid}>
            {myListings.map((l) => (
              <View key={`my-${l.id}`} style={styles.listingCard}>
                <View style={styles.listingThumbWrap}>
                  <Image source={{ uri: l.imageUrl }} style={styles.listingThumb} resizeMode="contain" />
                </View>
                <Text style={styles.listingName} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.listingMeta}>
                  {l.price_per_unit} BEANZ · Осталось: {l.quantity_left}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    cancelingId === l.id && styles.actionBtnDisabled,
                  ]}
                  disabled={cancelingId === l.id}
                  onPress={() => onCancelListing(l)}
                >
                  <Text style={styles.smallBtnText}>{cancelingId === l.id ? '...' : 'Снять'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Лоты игроков</Text>
        {publicListings.length === 0 ? (
          <Text style={styles.muted}>Пока нет доступных лотов</Text>
        ) : (
          <View style={styles.grid}>
            {publicListings.map((l) => (
              <View key={`pub-${l.id}`} style={styles.listingCard}>
                <View style={styles.listingThumbWrap}>
                  <Image source={{ uri: l.imageUrl }} style={styles.listingThumb} resizeMode="contain" />
                </View>
                <Text style={styles.listingName} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.listingMeta}>
                  Продавец: {l.seller_username ?? `#${l.seller_user_id}`}
                </Text>
                <Text style={styles.listingMeta}>
                  {l.price_per_unit} BEANZ · Осталось: {l.quantity_left}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.smallBtn,
                    buyingId === l.id && styles.actionBtnDisabled,
                  ]}
                  disabled={buyingId === l.id || beanz < l.price_per_unit}
                  onPress={() => onBuyOne(l)}
                >
                  <Text style={styles.smallBtnText}>{buyingId === l.id ? '...' : 'Купить 1'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
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
  containerCompact: {
    paddingHorizontal: 12,
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
    gap: 10,
  },
  headerCompact: {
    flexWrap: 'wrap',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },

  listingCard: {
    width: '48%',
    minWidth: 150,
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 16,
    padding: 10,
    gap: 6,
  },
  listingThumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: NFT.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listingThumb: { width: '90%', height: '90%' },
  listingName: { color: NFT.text, fontSize: 13, fontWeight: '700' },
  listingMeta: { color: NFT.textMuted, fontSize: 11 },
  smallBtn: {
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnDisabled: { opacity: 0.5 },
  smallBtnText: { color: NFT.text, fontSize: 12, fontWeight: '700' },
});
