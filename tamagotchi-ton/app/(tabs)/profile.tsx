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
  Modal,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  getProfileSnapshot,
  equipItem,
  unequipItem,
  createMarketListing,
  resetInventory,
} from '../../src/api/client';

const NFT = {
  bg: '#0A0A0F',
  surface: '#12121A',
  card: '#16161F',
  cardBorder: 'rgba(0, 212, 255, 0.25)',
  cyan: '#00D4FF',
  cyanDim: 'rgba(0, 212, 255, 0.6)',
  purpleDim: 'rgba(168, 85, 247, 0.5)',
  goldDim: 'rgba(251, 191, 36, 0.7)',
  red: '#f33f32',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
};

const STARTER_ITEM_IDS = new Set([37, 84, 70, 97]);
const STARTER_BY_SLOT: Record<string, number | null> = {
  background: 37,
  eyes: 84,
  cloth: 70,
  hat: 97,
  weapon: null,
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

function normalizeEquipped(eq: any): Equipped {
  return {
    backgroundItemId: eq?.backgroundItemId ?? eq?.background_item_id ?? null,
    weaponItemId: eq?.weaponItemId ?? eq?.weapon_item_id ?? null,
    eyesItemId: eq?.eyesItemId ?? eq?.eyes_item_id ?? null,
    clothItemId: eq?.clothItemId ?? eq?.cloth_item_id ?? null,
    hatItemId: eq?.hatItemId ?? eq?.hat_item_id ?? null,
  };
}

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

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<number | null>(null);
  const [unequippingSlot, setUnequippingSlot] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>('all');

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equipped, setEquipped] = useState<Equipped>({
    backgroundItemId: null,
    weaponItemId: null,
    eyesItemId: null,
    clothItemId: null,
    hatItemId: null,
  });

  const [sellTarget, setSellTarget] = useState<InventoryItem | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState('1');
  const [sellQtyInput, setSellQtyInput] = useState('1');
  const [listing, setListing] = useState(false);

  const equippedMap = useMemo(() => {
    const m = new Map<number, string>();
    if (equipped.backgroundItemId) m.set(equipped.backgroundItemId, 'background');
    if (equipped.weaponItemId) m.set(equipped.weaponItemId, 'weapon');
    if (equipped.eyesItemId) m.set(equipped.eyesItemId, 'eyes');
    if (equipped.clothItemId) m.set(equipped.clothItemId, 'cloth');
    if (equipped.hatItemId) m.set(equipped.hatItemId, 'hat');
    return m;
  }, [equipped]);

  const equippedCounts = useMemo(() => {
    const m = new Map<number, number>();
    const values = [
      equipped.backgroundItemId,
      equipped.weaponItemId,
      equipped.eyesItemId,
      equipped.clothItemId,
      equipped.hatItemId,
    ];
    for (const id of values) {
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
    return m;
  }, [equipped]);

  const categories = useMemo(() => {
    const types = Array.from(new Set(inventory.map((it) => it.type))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ['all', ...types];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (activeType === 'all') return inventory;
    return inventory.filter((it) => it.type === activeType);
  }, [inventory, activeType]);

  const getMaxListable = useCallback(
    (item: InventoryItem) => {
      if (STARTER_ITEM_IDS.has(Number(item.item_id))) return 0;
      const lockedByEquip = equippedCounts.get(Number(item.item_id)) || 0;
      return Math.max(0, Number(item.quantity || 0) - lockedByEquip);
    },
    [equippedCounts]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getProfileSnapshot();
      setInventory(Array.isArray(snapshot?.inventory) ? snapshot.inventory : []);
      setEquipped(normalizeEquipped(snapshot?.equipped));
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await getProfileSnapshot();
      setEquipped(normalizeEquipped(snapshot?.equipped));
      if (Array.isArray(snapshot?.inventory)) setInventory(snapshot.inventory);
    } catch (e) {
      console.log(e);
    }
  }, []);

  useEffect(() => {
    if (!categories.includes(activeType)) {
      setActiveType('all');
    }
  }, [categories, activeType]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(() => {
        refresh();
      }, 10000);

      return () => clearInterval(id);
    }, [refresh])
  );

  const resetInv = async () => {
    try {
      await resetInventory();
      await refresh();
    } catch (e: any) {
      console.log('reset-inv error:', e);
      Alert.alert('Ошибка', String(e?.message || e));
    }
  };

  const onEquip = async (it: InventoryItem) => {
    if (equipping) return;

    const slot = it.type;
    const allowed = new Set(['background', 'weapon', 'eyes', 'cloth', 'hat']);
    if (!allowed.has(slot)) {
      Alert.alert('Нельзя экипировать', `Тип "${slot}" не является слотом экипировки`);
      return;
    }

    setEquipping(it.item_id);
    try {
      const resp = await equipItem(slot, it.item_id);
      if (resp?.equipped) setEquipped(normalizeEquipped(resp.equipped));
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка экипировки', e?.message ?? 'Не удалось экипировать');
    } finally {
      setEquipping(null);
    }
  };

  const onUnequip = async (it: InventoryItem) => {
    const slot = equippedMap.get(it.item_id);
    if (!slot || unequippingSlot) return;

    const fallback = STARTER_BY_SLOT[slot];
    const fallbackText = slot === 'weapon' ? 'пустой слот' : `стартовый предмет #${fallback}`;
    const approved = await confirmAction(
      'Разэкипировать предмет?',
      `${it.name}\nСлот "${slot}" переключится на ${fallbackText}.`
    );
    if (!approved) return;

    setUnequippingSlot(slot);
    try {
      const resp = await unequipItem(slot);
      if (resp?.equipped) setEquipped(normalizeEquipped(resp.equipped));
    } catch (e: any) {
      console.log(e);
      Alert.alert('Ошибка', e?.message ?? 'Не удалось снять предмет');
    } finally {
      setUnequippingSlot(null);
    }
  };

  const openSellMenu = (it: InventoryItem) => {
    if (STARTER_ITEM_IDS.has(Number(it.item_id))) {
      Alert.alert('Недоступно', 'Стартовые предметы нельзя выставлять на продажу.');
      return;
    }
    const maxListable = getMaxListable(it);
    if (maxListable < 1) {
      Alert.alert('Недоступно', 'Этот предмет сейчас нельзя продать.');
      return;
    }

    setSellTarget(it);
    setSellPriceInput(String(Math.max(1, Math.floor(Number(it.price || 1)))));
    setSellQtyInput('1');
  };

  const closeSellMenu = () => {
    setSellTarget(null);
    setSellPriceInput('1');
    setSellQtyInput('1');
  };

  const onQtyChange = (raw: string) => {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) {
      setSellQtyInput('');
      return;
    }
    const target = sellTarget;
    const max = target ? getMaxListable(target) : 1;
    let next = Math.floor(Number(digits));
    if (!next || next < 1) next = 1;
    if (next > max) next = max;
    setSellQtyInput(String(next));
  };

  const onCreateListing = async () => {
    if (!sellTarget) return;

    const maxListable = getMaxListable(sellTarget);
    if (maxListable < 1) {
      Alert.alert('Недоступно', 'Этот предмет сейчас нельзя продать.');
      closeSellMenu();
      return;
    }

    let quantity = Math.floor(Number(sellQtyInput || 1));
    if (!quantity || quantity < 1) quantity = 1;
    if (quantity > maxListable) {
      quantity = maxListable;
      setSellQtyInput(String(maxListable));
    }

    let pricePerUnit = Math.floor(Number(sellPriceInput || 1));
    if (!pricePerUnit || pricePerUnit < 1) pricePerUnit = 1;
    if (String(pricePerUnit) !== sellPriceInput) setSellPriceInput(String(pricePerUnit));

    const approved = await confirmAction(
      'Подтверждение листинга',
      `${sellTarget.name}\nЦена: ${pricePerUnit} BEANZ\nКоличество: ${quantity}`
    );
    if (!approved) return;

    setListing(true);
    try {
      await createMarketListing({
        itemId: sellTarget.item_id,
        quantity,
        pricePerUnit,
      });
      closeSellMenu();
      await refresh();
    } catch (e: any) {
      console.log(e);
      const serverMax = Math.floor(Number(e?.data?.maxListable));
      if (Number.isInteger(serverMax) && serverMax >= 1) {
        setSellQtyInput(String(serverMax));
      }
      Alert.alert('Не удалось выставить лот', e?.message ?? 'Ошибка');
    } finally {
      setListing(false);
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
      <View style={styles.header}>
        <Text style={styles.headerLabel}>PROFILE</Text>
        <Text style={styles.headerTitle}>Inventory</Text>
        <Text style={styles.headerSub}>Category: {activeType}</Text>

        <View style={styles.equippedRow}>
          <EquippedBadge label="BG" value={equipped.backgroundItemId} />
          <EquippedBadge label="WEAPON" value={equipped.weaponItemId} />
          <EquippedBadge label="EYES" value={equipped.eyesItemId} />
          <EquippedBadge label="CLOTH" value={equipped.clothItemId} />
          <EquippedBadge label="HAT" value={equipped.hatItemId} />
        </View>
      </View>

      <View style={styles.tabs}>
        {categories.map((c) => {
          const active = c === activeType;
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setActiveType(c)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {filteredInventory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>
              {inventory.length === 0 ? 'Инвентарь пуст.' : 'В этой категории нет предметов.'}
            </Text>
          </View>
        ) : (
          filteredInventory.map((it) => {
            const slot = equippedMap.get(it.item_id);
            const isEquipped = Boolean(slot);
            const isStarter = STARTER_ITEM_IDS.has(Number(it.item_id));
            const maxListable = getMaxListable(it);
            const sellDisabled = listing || maxListable < 1;
            const unequipLoading = isEquipped && unequippingSlot === slot;
            const equipLoading = equipping === it.item_id;

            return (
              <View key={it.item_id} style={styles.card}>
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: it.imageUrl }} style={styles.thumb} resizeMode="contain" />
                </View>

                <Text numberOfLines={1} style={styles.name}>
                  {it.name}
                </Text>
                <Text style={styles.meta}>
                  {it.type} • {it.rarity} • qty {it.quantity}
                </Text>

                {isStarter ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => onEquip(it)}
                      disabled={equipLoading || isEquipped}
                      style={[
                        styles.btn,
                        isEquipped ? styles.btnEquipped : null,
                        (equipLoading || isEquipped) ? styles.btnDisabled : null,
                      ]}
                    >
                      <Text style={styles.btnText}>
                        {equipLoading ? '...' : isEquipped ? 'EQUIPPED' : 'EQUIP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      onPress={() => openSellMenu(it)}
                      disabled={sellDisabled}
                      style={[
                        styles.btn,
                        styles.sellBtn,
                        sellDisabled && styles.btnDisabled,
                      ]}
                    >
                      <Text style={styles.btnText}>SELL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => (isEquipped ? onUnequip(it) : onEquip(it))}
                      disabled={isEquipped ? unequipLoading : equipLoading}
                      style={[
                        styles.btn,
                        isEquipped ? styles.btnEquipped : null,
                        (isEquipped ? unequipLoading : equipLoading) ? styles.btnDisabled : null,
                      ]}
                    >
                      <Text style={styles.btnText}>
                        {isEquipped
                          ? (unequipLoading ? '...' : 'UNEQUIP')
                          : (equipLoading ? '...' : 'EQUIP')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity onPress={resetInv} style={styles.resetBtn}>
        <Text style={styles.resetBtnText}>Сбросить прогресс</Text>
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={Boolean(sellTarget)} onRequestClose={closeSellMenu}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Выставить предмет</Text>
            <Text style={styles.modalSub}>{sellTarget?.name}</Text>

            <Text style={styles.modalLabel}>Цена за 1 шт (BEANZ)</Text>
            <TextInput
              value={sellPriceInput}
              onChangeText={(v) => setSellPriceInput(String(v || '').replace(/[^\d]/g, ''))}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Например: 25"
              placeholderTextColor={NFT.textMuted}
            />

            <Text style={styles.modalLabel}>Количество</Text>
            <TextInput
              value={sellQtyInput}
              onChangeText={onQtyChange}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Например: 2"
              placeholderTextColor={NFT.textMuted}
            />

            <Text style={styles.modalHint}>
              Максимум: {sellTarget ? getMaxListable(sellTarget) : 0}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={closeSellMenu}
                disabled={listing}
              >
                <Text style={styles.modalBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, listing && styles.btnDisabled]}
                onPress={onCreateListing}
                disabled={listing}
              >
                <Text style={styles.modalBtnText}>{listing ? '...' : 'Выставить'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerSub: { fontSize: 12, color: NFT.textMuted, marginTop: 6 },

  equippedRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },

  tabs: {
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    backgroundColor: 'transparent',
  },
  tabActive: { backgroundColor: NFT.card, borderColor: NFT.cyanDim },
  tabText: { color: NFT.textMuted, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: NFT.cyan },

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

  actionRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellBtn: {
    borderColor: NFT.goldDim,
  },
  btnEquipped: { borderColor: NFT.cyanDim },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: NFT.text, fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  empty: { width: '100%', paddingTop: 40, alignItems: 'center' },
  muted: { color: NFT.textMuted, fontWeight: '600' },

  resetBtn: {
    maxWidth: 300,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: NFT.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 14,
  },
  modalTitle: { color: NFT.text, fontSize: 18, fontWeight: '800' },
  modalSub: { color: NFT.textMuted, marginTop: 6, marginBottom: 12 },
  modalLabel: { color: NFT.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '600' },
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
  modalHint: { color: NFT.textMuted, fontSize: 11, marginBottom: 10 },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NFT.purpleDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnSecondary: { borderColor: NFT.cardBorder },
  modalBtnText: { color: NFT.text, fontWeight: '700' },
});
