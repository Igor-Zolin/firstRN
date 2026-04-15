import { useCallback, useEffect, useMemo, useState } from 'react';
import { buyFromMarket, cancelMarketListing, getMarketSnapshot } from '../../api/client';
import type { MarketListing } from '../../types';

export function MarketPage() {
  const [loading, setLoading] = useState(true);
  const [beanz, setBeanz] = useState(0);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const publicListings = useMemo(() => listings.filter((listing) => !listing.isMine), [listings]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setNote('');
    try {
      const snapshot = await getMarketSnapshot({ mode: 'focus' });
      setBeanz(snapshot?.stats?.beanz ?? 0);
      setListings(Array.isArray(snapshot?.listings) ? snapshot.listings : []);
      setMyListings(Array.isArray(snapshot?.myListings) ? snapshot.myListings : []);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось загрузить рынок');
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
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshListings().catch(() => {});
    }, 10000);

    return () => window.clearInterval(id);
  }, [refreshListings]);

  const onCancelListing = async (listing: MarketListing) => {
    if (cancelingId) return;

    if (!window.confirm(`Отменить лот?\n\n${listing.name}\nВернётся в инвентарь: ${listing.quantity_left}`)) return;

    setCancelingId(listing.id);
    setNote('');
    try {
      await cancelMarketListing(listing.id);
      await refreshListings();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Не удалось отменить лот');
    } finally {
      setCancelingId(null);
    }
  };

  const onBuyOne = async (listing: MarketListing) => {
    if (buyingId) return;

    if (!window.confirm(`Купить предмет?\n\n${listing.name}\nЦена: ${listing.price_per_unit} BEANZ\nКоличество: 1`)) return;

    setBuyingId(listing.id);
    setNote('');
    try {
      const result = await buyFromMarket(listing.id, 1);
      if (typeof result?.buyerBeanz === 'number') {
        setBeanz(result.buyerBeanz);
      }
      await refreshListings();
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Покупка не удалась');
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <section className="screen screen-market">
        <div className="screen-loading">Загрузка рынка...</div>
      </section>
    );
  }

  return (
    <section className="screen screen-market">
      <div className="screen-scroll">
        <div className="tab-header">
          <div>
            <p className="header-label">SECONDARY MARKET</p>
            <h2 className="header-title">P2P Listings</h2>
          </div>

          <div className="beanz-card">
            <strong>{beanz}</strong>
            <span>BEANZ</span>
          </div>
        </div>

        <p className="market-mode">Settlement: BEANZ</p>

        <p className="section-title">Мои лоты</p>
        {myListings.length === 0 ? (
          <p className="muted">Активных лотов нет</p>
        ) : (
          <div className="market-grid">
            {myListings.map((listing) => (
              <article key={`my-${listing.id}`} className="market-card">
                <div className="market-thumb-wrap">
                  <img src={listing.imageUrl} className="market-thumb" alt={listing.name} loading="lazy" />
                </div>
                <h3 className="market-name">{listing.name}</h3>
                <p className="market-meta">{listing.price_per_unit} BEANZ · Осталось: {listing.quantity_left}</p>
                <button className="market-btn" disabled={cancelingId === listing.id} onClick={() => void onCancelListing(listing)}>
                  {cancelingId === listing.id ? '...' : 'Снять'}
                </button>
              </article>
            ))}
          </div>
        )}

        <p className="section-title">Лоты игроков</p>
        {publicListings.length === 0 ? (
          <p className="muted">Пока нет доступных лотов</p>
        ) : (
          <div className="market-grid">
            {publicListings.map((listing) => (
              <article key={`pub-${listing.id}`} className="market-card">
                <div className="market-thumb-wrap">
                  <img src={listing.imageUrl} className="market-thumb" alt={listing.name} loading="lazy" />
                </div>
                <h3 className="market-name">{listing.name}</h3>
                <p className="market-meta">Продавец: {listing.seller_username ?? `#${listing.seller_user_id}`}</p>
                <p className="market-meta">{listing.price_per_unit} BEANZ · Осталось: {listing.quantity_left}</p>
                <button
                  className="market-btn"
                  disabled={buyingId === listing.id || beanz < listing.price_per_unit}
                  onClick={() => void onBuyOne(listing)}
                >
                  {buyingId === listing.id ? '...' : 'Купить 1'}
                </button>
              </article>
            ))}
          </div>
        )}

        {note ? <p className="screen-note">{note}</p> : null}
      </div>
    </section>
  );
}
