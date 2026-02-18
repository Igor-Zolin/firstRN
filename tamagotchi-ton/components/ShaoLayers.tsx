import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Equipped = {
  backgroundItemId: number | null;
  weaponItemId: number | null;
  eyesItemId: number | null;
  clothItemId: number | null;
  hatItemId: number | null;
};

type InventoryItem = {
  item_id: number;
  type: 'background' | 'weapon' | 'eyes' | 'cloth' | 'hat' | string;
  imageUrl: string; // у тебя уже отдаётся с бэка в /api/inventory/me и /api/shop/items
};

function pickImageUrl(inventory: InventoryItem[], itemId: number | null) {
  if (!itemId) return null;
  const found = inventory.find((x) => x.item_id === itemId);
  return found?.imageUrl ?? null;
}

export function ShaoLayers({
  equipped,
  inventory,
}: {
  equipped: Equipped;
  inventory: InventoryItem[];
}) {
  const layers = useMemo(() => {
    const bg = pickImageUrl(inventory, equipped.backgroundItemId);
    const weapon = pickImageUrl(inventory, equipped.weaponItemId);
    const eyes = pickImageUrl(inventory, equipped.eyesItemId);
    const cloth = pickImageUrl(inventory, equipped.clothItemId);
    const hat = pickImageUrl(inventory, equipped.hatItemId);

    // порядок важен: снизу вверх
    return [bg, weapon, eyes, cloth, hat ].filter(Boolean) as string[];
  }, [equipped, inventory]);

  return (
    <View style={layerStyles.layerBox}>
      {layers.map((uri, idx) => (
        <Image
          key={`${uri}-${idx}`}
          source={{ uri }}
          style={layerStyles.layerImage}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

const layerStyles = StyleSheet.create({
  layerBox: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  layerImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
});