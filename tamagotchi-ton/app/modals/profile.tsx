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

import { getInventoryMe, getEquippedMe, equipItem } from '../../src/api/client';

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

type InventoryItem = {
  item_id: number;
  quantity: number;
  name: string;
  type: 'background' | 'weapon' | 'eyes' | 'cloth' | 'hat' | string;
  model_name: string;
  rarity: string;
  price: number;
  imageUrl: string;
};

type Equipped = {
  backgroundItemId: number | null;
  weaponItemId: number | null;
  eyesItemId: number | null;
  clothItemId: number | null;
  hatItemId: number | null;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<number | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equipped, setEquipped] = useState<Equipped>({
    backgroundItemId: null,
    weaponItemId: null,
    eyesItemId: null,
    clothItemId: null,
    hatItemId: null,
  });

  const equippedMap = useMemo(() => {
    const m = new Map<number, string>();
    if (equipped.backgroundItemId) m.set(equipped.backgroundItemId, 'background');
    if (equipped.weaponItemId) m.set(equipped.weaponItemId, 'weapon');
    if (equipped.eyesItemId) m.set(equipped.eyesItemId, 'eyes');
    if (equipped.clothItemId) m.set(equipped.clothItemId, 'cloth');
    if (equipped.hatItemId) m.set(equipped.hatItemId, 'hat');
    return m;
  }, [equipped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, eq] = await Promise.all([getInventoryMe(), getEquippedMe()]);
      setInventory(Array.isArray(inv) ? inv : []);
      setEquipped(eq || {});
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onEquip = async (it: InventoryItem) => {
    if (equipping) return;

    // slot = it.type
    const slot = it.type;
    const allowed = new Set(['background', 'weapon', 'eyes', 'cloth', 'hat']);
    if (!allowed.has(slot)) {
      Alert.alert('Нельзя экипировать', `Тип "${slot}" не является слотом экипировки`);
      return;
    }

    setEquipping(it.item_id);
    try {
      const resp = await equipItem(slot, it.item_id);
      if (resp?.equipped) setEquipped(resp.equipped);
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка экипировки', e?.message ?? 'Не удалось экипировать');
    } finally {
      setEquipping(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.muted}>Загрузка профиля…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top equipped summary */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PROFILE</Text>
        <Text style={styles.headerTitle}>Inventory</Text>

        <View style={styles.equippedRow}>
          <EquippedBadge label="BG" value={equipped.backgroundItemId} />
          <EquippedBadge label="WEAPON" value={equipped.weaponItemId} />
          <EquippedBadge label="EYES" value={equipped.eyesItemId} />
          <EquippedBadge label="CLOTH" value={equipped.clothItemId} />
          <EquippedBadge label="HAT" value={equipped.hatItemId} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {inventory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>Инвентарь пуст.</Text>
          </View>
        ) : (
          inventory.map((it) => {
            const isEquipped = equippedMap.has(it.item_id);

            return (
              <View key={it.item_id} style={styles.card}>
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: it.imageUrl }} style={styles.thumb} resizeMode="contain" />
                </View>

                <Text numberOfLines={1} style={styles.name}>
                  {it.name}
                </Text>
                <Text style={styles.meta}>
                  {it.type} • {it.rarity}
                </Text>

                <TouchableOpacity
                  onPress={() => onEquip(it)}
                  disabled={equipping === it.item_id}
                  style={[
                    styles.btn,
                    isEquipped ? styles.btnEquipped : null,
                    equipping === it.item_id ? styles.btnDisabled : null,
                  ]}
                >
                  <Text style={styles.btnText}>
                    {equipping === it.item_id ? '...' : isEquipped ? 'EQUIPPED' : 'EQUIP'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function EquippedBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NFT.bg, padding: 16 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 10 },

  header: { marginBottom: 12 },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: NFT.cyanDim },
  headerTitle: { fontSize: 26, fontWeight: '800', color: NFT.text, marginTop: 4 },

  equippedRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },

  badge: {
    backgroundColor: NFT.card,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  badgeLabel: { fontSize: 10, fontWeight: '800', color: NFT.textMuted, letterSpacing: 1 },
  badgeValue: { fontSize: 12, fontWeight: '800', color: NFT.text, marginTop: 4 },

  grid: {
    paddingBottom: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },

  card: {
    width: '48%',
    maxWidth: 300,
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

  name: { color: NFT.text, fontWeight: '800', fontSize: 13 },
  meta: { color: NFT.textMuted, fontSize: 11, marginTop: 4 },

  btn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    alignItems: 'center',
  },
  btnEquipped: { borderColor: NFT.cyanDim },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: NFT.text, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  empty: { width: '100%', paddingTop: 40, alignItems: 'center' },
  muted: { color: NFT.textMuted, fontWeight: '600' },
});
