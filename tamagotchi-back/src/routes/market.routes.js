function registerMarketRoutes(app, deps) {
  const { db, authenticateToken, game } = deps;
  const { nowSec, applyTick, countEquippedCopies } = game;
  const STARTER_ITEM_IDS = new Set([37, 84, 70, 97]);

  app.get('/api/market/sellable', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const base = `${req.protocol}://${req.get('host')}`;

    db.all(
      `SELECT i.item_id, i.quantity,
              it.name, it.type, it.model_name, it.rarity
       FROM inventory i
       JOIN items it ON it.id = i.item_id
       WHERE i.user_id = ?
       ORDER BY it.type ASC, it.rarity DESC, it.name ASC`,
      [userId],
      (e1, rows) => {
        if (e1) return res.status(500).json({ error: 'Failed to fetch inventory' });

        db.get(
          `SELECT background_item_id, weapon_item_id, eyes_item_id, cloth_item_id, hat_item_id
           FROM user_equipped
           WHERE user_id = ?`,
          [userId],
          (e2, equipped) => {
            if (e2) return res.status(500).json({ error: 'Failed to fetch equipped' });

            const sellable = rows
              .map((r) => {
                const lockedByEquip = countEquippedCopies(equipped, Number(r.item_id));
                const maxListable = Math.max(0, Number(r.quantity || 0) - lockedByEquip);
                return {
                  ...r,
                  imageUrl: `${base}/static/items/${r.model_name}`,
                  lockedByEquip,
                  maxListable,
                };
              })
              .filter((r) => r.maxListable > 0 && !STARTER_ITEM_IDS.has(Number(r.item_id)));

            return res.json(sellable);
          }
        );
      }
    );
  });

  app.get('/api/market/listings', authenticateToken, (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const base = `${req.protocol}://${req.get('host')}`;

    db.all(
      `SELECT l.id, l.seller_user_id, l.item_id, l.price_per_unit, l.quantity_total, l.quantity_left,
              l.status, l.created_at, l.updated_at,
              u.username AS seller_username,
              it.name, it.type, it.model_name, it.rarity
       FROM market_listings l
       JOIN users u ON u.id = l.seller_user_id
       JOIN items it ON it.id = l.item_id
       WHERE l.status = 'active' AND l.quantity_left > 0
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch listings' });

        const out = rows.map((r) => ({
          ...r,
          imageUrl: `${base}/static/items/${r.model_name}`,
          isMine: Number(r.seller_user_id) === Number(req.user.id),
        }));
        return res.json(out);
      }
    );
  });

  app.get('/api/market/my-listings', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const offset = Math.max(0, Number(req.query.offset || 0));
    const base = `${req.protocol}://${req.get('host')}`;

    db.all(
      `SELECT l.id, l.seller_user_id, l.item_id, l.price_per_unit, l.quantity_total, l.quantity_left,
              l.status, l.created_at, l.updated_at,
              it.name, it.type, it.model_name, it.rarity
       FROM market_listings l
       JOIN items it ON it.id = l.item_id
       WHERE l.seller_user_id = ? AND l.status = 'active' AND l.quantity_left > 0
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch my listings' });
        const out = rows.map((r) => ({
          ...r,
          imageUrl: `${base}/static/items/${r.model_name}`,
        }));
        return res.json(out);
      }
    );
  });

  app.post('/api/market/listings', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const itemId = Math.floor(Number(req.body?.itemId));
    const quantity = Math.floor(Number(req.body?.quantity));
    const pricePerUnit = Math.floor(Number(req.body?.pricePerUnit ?? req.body?.price));

    if (!itemId) return res.status(400).json({ error: 'Invalid itemId' });
    if (STARTER_ITEM_IDS.has(itemId)) {
      return res.status(400).json({ error: 'Starter items cannot be listed on market' });
    }
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Quantity must be >= 1' });
    if (!pricePerUnit || pricePerUnit < 1) return res.status(400).json({ error: 'Price must be >= 1' });

    const now = nowSec();
    const base = `${req.protocol}://${req.get('host')}`;
    const rollback = (status, payload) => db.run('ROLLBACK', () => res.status(status).json(payload));

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (eBegin) => {
        if (eBegin) return res.status(500).json({ error: 'Failed to begin transaction' });

        db.get(`SELECT id, name, type, model_name, rarity FROM items WHERE id = ?`, [itemId], (e1, item) => {
          if (e1) return rollback(500, { error: 'Failed to fetch item' });
          if (!item) return rollback(404, { error: 'Item not found' });

          db.get(
            `SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?`,
            [userId, itemId],
            (e2, invRow) => {
              if (e2) return rollback(500, { error: 'Failed to fetch inventory' });
              if (!invRow) return rollback(400, { error: 'You do not own this item' });

              db.get(
                `SELECT background_item_id, weapon_item_id, eyes_item_id, cloth_item_id, hat_item_id
                 FROM user_equipped
                 WHERE user_id = ?`,
                [userId],
                (e3, equipped) => {
                  if (e3) return rollback(500, { error: 'Failed to fetch equipped' });

                  const lockedByEquip = countEquippedCopies(equipped, itemId);
                  const maxListable = Math.max(0, Number(invRow.quantity || 0) - lockedByEquip);

                  if (quantity > maxListable) {
                    return rollback(400, {
                      error: `Not enough sellable quantity. Max available: ${maxListable}`,
                      maxListable,
                    });
                  }

                  const remaining = Number(invRow.quantity) - quantity;
                  const updateInventory = (cb) => {
                    if (remaining > 0) {
                      db.run(
                        `UPDATE inventory SET quantity = ? WHERE user_id = ? AND item_id = ?`,
                        [remaining, userId, itemId],
                        (eInv) => cb(eInv || null)
                      );
                      return;
                    }

                    db.run(
                      `DELETE FROM inventory WHERE user_id = ? AND item_id = ?`,
                      [userId, itemId],
                      (eDel) => cb(eDel || null)
                    );
                  };

                  updateInventory((eInv) => {
                    if (eInv) return rollback(500, { error: 'Failed to reserve inventory' });

                    db.run(
                      `INSERT INTO market_listings
                        (seller_user_id, item_id, price_per_unit, quantity_total, quantity_left, status, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
                      [userId, itemId, pricePerUnit, quantity, quantity, now, now],
                      function onListingCreated(e4) {
                        if (e4) return rollback(500, { error: 'Failed to create listing' });

                        db.run('COMMIT', (eCommit) => {
                          if (eCommit) return rollback(500, { error: 'Failed to commit listing' });
                          return res.json({
                            ok: true,
                            listing: {
                              id: this.lastID,
                              seller_user_id: userId,
                              item_id: itemId,
                              price_per_unit: pricePerUnit,
                              quantity_total: quantity,
                              quantity_left: quantity,
                              status: 'active',
                              created_at: now,
                              updated_at: now,
                              name: item.name,
                              type: item.type,
                              rarity: item.rarity,
                              imageUrl: `${base}/static/items/${item.model_name}`,
                            },
                          });
                        });
                      }
                    );
                  });
                }
              );
            }
          );
        });
      });
    });
  });

  app.post('/api/market/listings/:id/cancel', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const listingId = Math.floor(Number(req.params.id));
    if (!listingId) return res.status(400).json({ error: 'Invalid listing id' });

    const now = nowSec();
    const rollback = (status, payload) => db.run('ROLLBACK', () => res.status(status).json(payload));

    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION', (eBegin) => {
        if (eBegin) return res.status(500).json({ error: 'Failed to begin transaction' });

        db.get(
          `SELECT id, item_id, quantity_left
           FROM market_listings
           WHERE id = ? AND seller_user_id = ? AND status = 'active'`,
          [listingId, userId],
          (e1, listing) => {
            if (e1) return rollback(500, { error: 'Failed to fetch listing' });
            if (!listing) return rollback(404, { error: 'Active listing not found' });

            const qtyToReturn = Math.max(0, Number(listing.quantity_left || 0));

            db.run(
              `UPDATE market_listings
               SET status = 'cancelled', quantity_left = 0, updated_at = ?
               WHERE id = ?`,
              [now, listingId],
              (e2) => {
                if (e2) return rollback(500, { error: 'Failed to cancel listing' });

                const finish = () => {
                  db.run('COMMIT', (eCommit) => {
                    if (eCommit) return rollback(500, { error: 'Failed to commit cancel' });
                    return res.json({ ok: true, listingId, returnedQuantity: qtyToReturn });
                  });
                };

                if (qtyToReturn <= 0) return finish();

                db.run(
                  `INSERT INTO inventory (user_id, item_id, quantity)
                   VALUES (?, ?, ?)
                   ON CONFLICT(user_id, item_id)
                   DO UPDATE SET quantity = quantity + excluded.quantity`,
                  [userId, listing.item_id, qtyToReturn],
                  (e3) => {
                    if (e3) return rollback(500, { error: 'Failed to return inventory' });
                    finish();
                  }
                );
              }
            );
          }
        );
      });
    });
  });

  app.post('/api/market/buy', authenticateToken, (req, res) => {
    const buyerId = req.user.id;
    const listingId = Math.floor(Number(req.body?.listingId));
    const quantity = Math.floor(Number(req.body?.quantity || 1));
    if (!listingId) return res.status(400).json({ error: 'Invalid listing id' });
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Quantity must be >= 1' });

    applyTick(buyerId, (tickErr) => {
      if (tickErr) return res.status(500).json({ error: 'Failed to refresh buyer stats' });

      const now = nowSec();
      const rollback = (status, payload) => db.run('ROLLBACK', () => res.status(status).json(payload));

      db.serialize(() => {
        db.run('BEGIN IMMEDIATE TRANSACTION', (eBegin) => {
          if (eBegin) return res.status(500).json({ error: 'Failed to begin transaction' });

          db.get(
            `SELECT l.id, l.seller_user_id, l.item_id, l.price_per_unit, l.quantity_left,
                    it.name, it.type, it.rarity, it.model_name
             FROM market_listings l
             JOIN items it ON it.id = l.item_id
             WHERE l.id = ? AND l.status = 'active' AND l.quantity_left > 0`,
            [listingId],
            (e1, listing) => {
              if (e1) return rollback(500, { error: 'Failed to fetch listing' });
              if (!listing) return rollback(404, { error: 'Listing not found' });
              if (Number(listing.seller_user_id) === Number(buyerId)) {
                return rollback(400, { error: 'You cannot buy your own listing' });
              }
              if (quantity > Number(listing.quantity_left)) {
                return rollback(400, { error: 'Not enough quantity left in listing' });
              }

              const total = Number(listing.price_per_unit) * quantity;
              if (total <= 0) return rollback(400, { error: 'Bad listing price' });

              db.run(
                `UPDATE user_stats
                 SET beanz = beanz - ?, updated_at = ?
                 WHERE user_id = ? AND beanz >= ?`,
                [total, now, buyerId, total],
                function onBuyerCharged(e2) {
                  if (e2) return rollback(500, { error: 'Failed to charge buyer' });
                  if (this.changes === 0) return rollback(400, { error: 'Not enough beanz' });

                  db.run(
                    `UPDATE user_stats
                     SET beanz = beanz + ?, updated_at = ?
                     WHERE user_id = ?`,
                    [total, now, listing.seller_user_id],
                    function onSellerRewarded(e3) {
                      if (e3) return rollback(500, { error: 'Failed to reward seller' });
                      if (this.changes === 0) return rollback(500, { error: 'Seller stats not found' });

                      db.run(
                        `INSERT INTO inventory (user_id, item_id, quantity)
                         VALUES (?, ?, ?)
                         ON CONFLICT(user_id, item_id)
                         DO UPDATE SET quantity = quantity + excluded.quantity`,
                        [buyerId, listing.item_id, quantity],
                        (e4) => {
                          if (e4) return rollback(500, { error: 'Failed to add inventory' });

                          const nextLeft = Number(listing.quantity_left) - quantity;
                          const nextStatus = nextLeft > 0 ? 'active' : 'closed';

                          db.run(
                            `UPDATE market_listings
                             SET quantity_left = ?, status = ?, updated_at = ?
                             WHERE id = ?`,
                            [nextLeft, nextStatus, now, listingId],
                            (e5) => {
                              if (e5) return rollback(500, { error: 'Failed to update listing' });

                              db.get(
                                `SELECT beanz FROM user_stats WHERE user_id = ?`,
                                [buyerId],
                                (e6, buyerStats) => {
                                  if (e6) return rollback(500, { error: 'Failed to fetch buyer stats' });

                                  db.run('COMMIT', (eCommit) => {
                                    if (eCommit) return rollback(500, { error: 'Failed to commit purchase' });

                                    return res.json({
                                      ok: true,
                                      listingId,
                                      spent: total,
                                      quantityBought: quantity,
                                      newQuantityLeft: nextLeft,
                                      status: nextStatus,
                                      buyerBeanz: buyerStats?.beanz ?? null,
                                      item: {
                                        id: listing.item_id,
                                        name: listing.name,
                                        type: listing.type,
                                        rarity: listing.rarity,
                                        modelName: listing.model_name,
                                      },
                                    });
                                  });
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  });
}

module.exports = { registerMarketRoutes };
