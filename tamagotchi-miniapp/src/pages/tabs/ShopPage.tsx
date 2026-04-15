import { useCallback, useEffect, useMemo, useState } from 'react';
import { buyItem, getMyStats, getShopCategories, getShopItems } from '../../api/client';
import type { ShopItem } from '../../types';

export function ShopPage() {
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const [beanz, setBeanz] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeType, setActiveType] = useState('');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [note, setNote] = useState('');

  const activeLabel = useMemo(() => (activeType || 'all'), [activeType]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNote('');
    try {
      const [cats, stats] = await Promise.all([getShopCategories(), getMyStats()]);
      setCategories(cats || []);
      setBeanz(stats?.beanz ?? 0);

      const defaultType = cats?.[0] ?? '';
      setActiveType(defaultType);

      const shopItems = await getShopItems({ ...(defaultType ? { type: defaultType } : {}) });
      setItems(Array.isArray(shopItems) ? shopItems : []);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Failed to load shop');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(
    async (type: string, query = searchQuery) => {
      setItemsLoading(true);
      setNote('');
      try {
        const shopItems = await getShopItems({
          ...(type ? { type } : {}),
          ...(query ? { q: query } : {}),
        });
        setItems(Array.isArray(shopItems) ? shopItems : []);
      } catch (error) {
        setNote(error instanceof Error ? error.message : 'Failed to load items');
      } finally {
        setItemsLoading(false);
      }
    },
    [searchQuery]
  );

  const refreshBalance = useCallback(async () => {
    try {
      const stats = await getMyStats();
      setBeanz(stats?.beanz ?? 0);
    } catch {
      // ignore balance errors
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshBalance();
    }, 8000);
    return () => window.clearInterval(id);
  }, [refreshBalance]);

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
    if (beanz < item.price) {
      setNote(`Недостаточно бобов. Нужно: ${item.price}`);
      return;
    }

    if (!window.confirm(`Подтвердить покупку?\n\n${item.name}\nЦена: ${item.price} BEANZ`)) return;

    setBuyingId(item.id);
    setNote('');
    try {
      const response = await buyItem(item.id);
      const nextSupply =
        typeof response?.remainingSupply === 'number'
          ? response.remainingSupply
          : Math.max(0, item.supply - 1);
      const spent = typeof response?.spent === 'number' ? response.spent : item.price;

      setItems((current) =>
        current.map((value) => (value.id === item.id ? { ...value, supply: nextSupply } : value))
      );

      if (typeof response?.stats?.beanz === 'number') {
        setBeanz(response.stats.beanz);
      } else {
        setBeanz((current) => Math.max(0, current - spent));
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Покупка не удалась');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <section className="screen screen-shop">
        <div className="screen-loading">Загрузка магазина…</div>
      </section>
    );
  }

  return (
    <section className="screen screen-shop">
      <div className="screen-scroll">
        <div className="tab-header">
          <div>
            <p className="header-label">SHOP</p>
            <h2 className="header-title">Items</h2>
            <p className="header-sub">Category: {activeLabel}</p>
          </div>

          <div className="beanz-card">
            <strong>{beanz}</strong>
            <span>BEANZ</span>
          </div>
        </div>

        <div className="row wrap gap-sm shop-tabs-row">
          {categories.map((category) => (
            <button
              key={category}
              className={`shop-tab ${activeType === category ? 'shop-tab-active' : ''}`}
              onClick={() => void onSelectCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="shop-search-row">
          <input
            className="shop-search-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по названию или файлу"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onApplySearch();
              }
            }}
          />

          <div className="shop-search-actions">
            <button className="shop-search-btn" onClick={() => void onApplySearch()}>Search</button>
            {searchQuery ? <button className="shop-clear-btn" onClick={() => void onResetSearch()}>Clear</button> : null}
          </div>
        </div>

        {itemsLoading ? <p className="screen-note">Обновляем товары...</p> : null}

        {items.length === 0 ? (
          <div className="empty-block">
            <p className="muted">В этой категории нет доступных предметов.</p>
            <p className="muted">Если ты всё купил - так и должно быть</p>
          </div>
        ) : (
          <div className="shop-grid">
            {items.map((item) => (
              <article key={item.id} className="shop-item-card">
                <div className="shop-thumb-wrap">
                  <img src={item.imageUrl} className="shop-thumb" alt={item.name} loading="lazy" />
                </div>

                <h3 className="shop-item-name">{item.name}</h3>
                <p className="shop-item-meta">{item.rarity} • {item.type} • {item.supply}</p>

                <div className="shop-price-row">
                  <span className="shop-price">{item.price} BEANZ</span>
                  <button
                    className="shop-buy-btn"
                    onClick={() => void onBuy(item)}
                    disabled={buyingId === item.id || item.supply <= 0 || beanz < item.price}
                  >
                    {item.supply <= 0 ? 'SOLD OUT' : buyingId === item.id ? '...' : 'BUY'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {note ? <p className="screen-note">{note}</p> : null}
      </div>
    </section>
  );
}
