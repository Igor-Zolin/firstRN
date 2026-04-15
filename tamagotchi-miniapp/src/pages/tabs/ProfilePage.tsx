import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createMarketListing,
  equipItem,
  getProfileSnapshot,
  resetInventory,
  unequipItem,
} from '../../api/client';
import type { Equipped, InventoryItem } from '../../types';

const STARTER_ITEM_IDS = new Set([37, 84, 70, 97]);
const STARTER_BY_SLOT: Record<string, number | null> = {
  background: 37,
  eyes: 84,
  cloth: 70,
  hat: 97,
  weapon: null,
};

function normalizePositiveInt(value: string, fallback = 1) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<number | null>(null);
  const [unequippingSlot, setUnequippingSlot] = useState<string | null>(null);
  const [activeType, setActiveType] = useState('all');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equipped, setEquipped] = useState<Equipped>({
    backgroundItemId: null,
    weaponItemId: null,
    eyesItemId: null,
    clothItemId: null,
    hatItemId: null,
  });
  const [note, setNote] = useState('');

  const equippedMap = useMemo(() => {
    const map = new Map<number, string>();
    if (equipped.backgroundItemId) map.set(equipped.backgroundItemId, 'background');
    if (equipped.weaponItemId) map.set(equipped.weaponItemId, 'weapon');
    if (equipped.eyesItemId) map.set(equipped.eyesItemId, 'eyes');
    if (equipped.clothItemId) map.set(equipped.clothItemId, 'cloth');
    if (equipped.hatItemId) map.set(equipped.hatItemId, 'hat');
    return map;
  }, [equipped]);

  const equippedCounts = useMemo(() => {
    const map = new Map<number, number>();
    [
      equipped.backgroundItemId,
      equipped.weaponItemId,
      equipped.eyesItemId,
      equipped.clothItemId,
      equipped.hatItemId,
    ].forEach((id) => {
      if (!id) return;
      map.set(id, (map.get(id) || 0) + 1);
    });
    return map;
  }, [equipped]);

  const categories = useMemo(() => {
    const types = Array.from(new Set(inventory.map((item) => item.type))).sort((a, b) => a.localeCompare(b));
    return ['all', ...types];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (activeType === 'all') return inventory;
    return inventory.filter((item) => item.type === activeType);
  }, [activeType, inventory]);

  const getMaxListable = useCallback(
    (item: InventoryItem) => {
      if (STARTER_ITEM_IDS.has(item.item_id)) return 0;
      const lockedByEquip = equippedCounts.get(item.item_id) || 0;
      return Math.max(0, item.quantity - lockedByEquip);
    },
    [equippedCounts]
  );

  const refresh = useCallback(async () => {
    const snapshot = await getProfileSnapshot();
    setInventory(Array.isArray(snapshot?.inventory) ? snapshot.inventory : []);
    setEquipped(snapshot?.equipped ?? {
      backgroundItemId: null,
      weaponItemId: null,
      eyesItemId: null,
      clothItemId: null,
      hatItemId: null,
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setNote('');
    void refresh()
      .catch((error) => setNote(error instanceof Error ? error.message : 'Не удалось загрузить профиль'))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh().catch(() => {});
    }, 10000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!categories.includes(activeType)) setActiveType('all');
  }, [activeType, categories]);

  const onEquip = async (item: InventoryItem) => {
    if (equipping) return;
    const allowed = new Set(['background', 'weapon', 'eyes', 'cloth', 'hat']);
    if (!allowed.has(item.type)) {
      setNote(`Тип ${item.type} не является слотом экипировки`);
      return;
    }

    setEquipping(item.item_id);
    setNote('');
    try {
      const response = await equipItem(item.type, item.item_id);
      if (response?.equipped) setEquipped(response.equipped);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось экипировать');
    } finally {
      setEquipping(null);
    }
  };

  const onUnequip = async (item: InventoryItem) => {
    const slot = equippedMap.get(item.item_id);
    if (!slot || unequippingSlot) return;

    const fallback = STARTER_BY_SLOT[slot];
    const fallbackText = slot === 'weapon' ? 'пустой слот' : `стартовый предмет #${fallback}`;

    if (!window.confirm(`Разэкипировать предмет?\n\n${item.name}\nСлот ${slot} переключится на ${fallbackText}`)) return;

    setUnequippingSlot(slot);
    setNote('');
    try {
      const response = await unequipItem(slot);
      if (response?.equipped) setEquipped(response.equipped);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось снять предмет');
    } finally {
      setUnequippingSlot(null);
    }
  };

  const onSell = async (item: InventoryItem) => {
    if (STARTER_ITEM_IDS.has(item.item_id)) {
      setNote('Стартовые предметы нельзя выставлять на продажу');
      return;
    }

    const max = getMaxListable(item);
    if (max < 1) {
      setNote('Этот предмет сейчас нельзя продать');
      return;
    }

    const priceInput = window.prompt(`Цена за 1 шт (${item.name})`, String(Math.max(1, Math.floor(item.price || 1))));
    if (priceInput === null) return;

    const qtyInput = window.prompt(`Количество (максимум ${max})`, '1');
    if (qtyInput === null) return;

    const pricePerUnit = normalizePositiveInt(priceInput, 1);
    const quantity = Math.min(max, normalizePositiveInt(qtyInput, 1));

    if (!window.confirm(`Подтверждение листинга\n\n${item.name}\nЦена: ${pricePerUnit} BEANZ\nКоличество: ${quantity}`)) return;

    setNote('');
    try {
      await createMarketListing({ itemId: item.item_id, quantity, pricePerUnit });
      await refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось выставить лот');
    }
  };

  const onResetInventory = async () => {
    setNote('');
    try {
      await resetInventory();
      await refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Ошибка reset-inv');
    }
  };

  if (loading) {
    return (
      <section className="screen screen-profile">
        <div className="screen-loading">Загрузка профиля…</div>
      </section>
    );
  }

  return (
    <section className="screen screen-profile">
      <div className="screen-scroll">
        <div className="profile-header">
          <p className="header-label">PROFILE</p>
          <h2 className="header-title">Inventory</h2>
          <p className="header-sub">Category: {activeType}</p>

          <div className="profile-equipped-row">
            <div className="profile-equipped-badge"><span>BG</span><strong>{equipped.backgroundItemId ?? '—'}</strong></div>
            <div className="profile-equipped-badge"><span>WEAPON</span><strong>{equipped.weaponItemId ?? '—'}</strong></div>
            <div className="profile-equipped-badge"><span>EYES</span><strong>{equipped.eyesItemId ?? '—'}</strong></div>
            <div className="profile-equipped-badge"><span>CLOTH</span><strong>{equipped.clothItemId ?? '—'}</strong></div>
            <div className="profile-equipped-badge"><span>HAT</span><strong>{equipped.hatItemId ?? '—'}</strong></div>
          </div>
        </div>

        <div className="profile-tabs">
          {categories.map((category) => (
            <button key={category} className={`profile-tab ${activeType === category ? 'profile-tab-active' : ''}`} onClick={() => setActiveType(category)}>
              {category}
            </button>
          ))}
        </div>

        <div className="profile-grid">
          {filteredInventory.length === 0 ? (
            <div className="empty-block">
              <p className="muted">{inventory.length === 0 ? 'Инвентарь пуст.' : 'В этой категории нет предметов.'}</p>
            </div>
          ) : (
            filteredInventory.map((item) => {
              const slot = equippedMap.get(item.item_id);
              const isEquipped = Boolean(slot);
              const isStarter = STARTER_ITEM_IDS.has(item.item_id);
              const sellDisabled = getMaxListable(item) < 1;
              const equipLoading = equipping === item.item_id;
              const unequipLoading = isEquipped && unequippingSlot === slot;

              return (
                <article key={item.item_id} className="profile-card">
                  <div className="profile-thumb-wrap">
                    <img src={item.imageUrl} className="profile-thumb" alt={item.name} loading="lazy" />
                  </div>

                  <h3 className="profile-name">{item.name}</h3>
                  <p className="profile-meta">{item.type} • {item.rarity} • qty {item.quantity}</p>

                  {isStarter ? (
                    <div className="profile-action-row">
                      <button className="profile-btn" disabled={equipLoading || isEquipped} onClick={() => void onEquip(item)}>
                        {equipLoading ? '...' : isEquipped ? 'EQUIPPED' : 'EQUIP'}
                      </button>
                    </div>
                  ) : (
                    <div className="profile-action-row">
                      <button className="profile-btn sell" disabled={sellDisabled} onClick={() => void onSell(item)}>SELL</button>
                      <button
                        className={`profile-btn ${isEquipped ? 'equipped' : ''}`}
                        disabled={isEquipped ? unequipLoading : equipLoading}
                        onClick={() => void (isEquipped ? onUnequip(item) : onEquip(item))}
                      >
                        {isEquipped ? (unequipLoading ? '...' : 'UNEQUIP') : (equipLoading ? '...' : 'EQUIP')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        <button className="reset-btn" onClick={() => void onResetInventory()}>Сбросить прогресс</button>

        {note ? <p className="screen-note">{note}</p> : null}
      </div>
    </section>
  );
}
