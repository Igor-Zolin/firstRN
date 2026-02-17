import { Link } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  ScrollView,
  Platform,
  FlatList,
} from 'react-native';

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
  energy: '#22D3EE',
  red: '#f33f32',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  glow: 'rgba(0, 212, 255, 0.35)',
  glowGold: 'rgba(251, 191, 36, 0.3)',
};

export default function Profile() {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const linkButtonStyle = StyleSheet.flatten([
    styles.linkButton,
    { borderColor: NFT.cyanDim },
  ]);
  const API_BASE =
    Platform.OS === 'web'
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : Platform.OS === 'ios'
        ? 'http://192.168.3.72:3000'
        : 'http://10.0.2.2:3000';

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/items`);

        console.log('status', res.status);
        console.log('content-type', res.headers.get('content-type'));

        const text = await res.text();
        console.log('raw', text);

        const json = JSON.parse(text);
        setData(json);
      } catch (e) {
        console.error('FETCH ERROR:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    console.log('data length:', data.length);
    if (data[0]) console.log('first item:', data[0]);
  }, [data]);

  const renderItem = ({ item }) => (
    <View style={{ paddingVertical: 10, width: '100%' }}>
      <Text style={{ color: NFT.text, fontSize: 16 }}>{item.name}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>COLLECTION</Text>
            <Text style={styles.headerTitle}>Shao</Text>
          </View>
          <Link href="/" dismissTo asChild>
            <TouchableOpacity style={linkButtonStyle}>
              <Text style={styles.linkText}>Домой</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.nftCardWrap}>
          {/* <View style={styles.nftCardGlow} /> */}
          <View style={styles.nftCard}>
            <View style={styles.rarityBadge}>
              <Text style={styles.rarityText}>#1</Text>
            </View>
            <TouchableOpacity
              // onPress={handleValueChange}
              activeOpacity={0.9}
              style={styles.petTouchArea}
            >
              <View style={styles.petFrame}>
                <View style={styles.petFrameInner}>
                  <Image
                    source={require('@/assets/images/Shao.png')}
                    style={styles.petImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <Text style={styles.tapHint}>TAP TO CHARGE</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.sectionTitle}>UPGRADES</Text>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          scrollEnabled={false}
          contentContainerStyle={{ width: '100%' }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NFT.bg,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: NFT.cyanDim,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: NFT.text,
  },
  linkButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: NFT.cyan,
  },
  nftCardWrap: {
    width: '100%',
    marginBottom: 20,
    position: 'relative',
    alignItems: 'center',
  },
  // nftCardGlow: {
  //   position: 'absolute',
  //   width: '92%',
  //   aspectRatio: 1,
  //   maxWidth: 320,
  //   borderRadius: 28,
  //   backgroundColor: NFT.glow,
  //   ...Platform.select({
  //     web: { boxShadow: `0 0 60px ${NFT.glow}` },
  //     default: {
  //       shadowColor: NFT.cyan,
  //       shadowOffset: { width: 0, height: 0 },
  //       shadowOpacity: 0.5,
  //       shadowRadius: 30,
  //       elevation: 12,
  //     },
  //   }),
  // },
  nftCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: NFT.cardBorder,
    backgroundColor: NFT.card,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: `0 0 60px ${NFT.glow}` },
      default: {
        shadowColor: NFT.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 12,
      },
    }),
  },
  rarityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    backgroundColor: NFT.purpleDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NFT.purple,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '800',
    color: NFT.text,
    letterSpacing: 1,
  },
  petTouchArea: {
    alignItems: 'center',
  },
  petFrame: {
    width: 240,
    height: 240,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: NFT.cyanDim,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  petFrameInner: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: NFT.surface,
  },
  petImage: {
    width: '100%',
    height: '100%',
  },
  tapHint: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: NFT.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: NFT.text,
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.cyanDim,
    marginTop: 4,
  },
  statLabelGold: {
    color: NFT.goldDim,
  },
  statLabelRed: {
    color: NFT.red,
  },
  statBar: {
    marginTop: 10,
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statBarEnergy: {},
  statBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  statBarFillEnergy: {
    backgroundColor: NFT.energy,
  },
  statBarFillGold: {
    backgroundColor: NFT.gold,
    width: '100%',
  },
  statBarFillRed: {
    backgroundColor: NFT.red,
    width: '100%',
  },
  progressSection: {
    width: '100%',
    backgroundColor: NFT.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 16,
    marginBottom: 24,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
  },
  progressNumbers: {
    fontSize: 14,
    fontWeight: '700',
    color: NFT.cyan,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: NFT.energy,
    ...Platform.select({
      web: { boxShadow: `0 0 12px ${NFT.cyan}` },
      default: {
        shadowColor: NFT.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
    }),
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: NFT.textMuted,
    marginBottom: 12,
    width: '100%',
    textAlign: 'left',
  },
  upgradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 28,
  },
  upgradeBtn: {
    width: '48%',
    minWidth: 130,
    backgroundColor: NFT.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NFT.cardBorder,
    padding: 14,
  },
  upgradeBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: NFT.text,
    letterSpacing: 0.5,
  },
  upgradeBtnSub: {
    fontSize: 12,
    fontWeight: '600',
    color: NFT.cyanDim,
    marginTop: 4,
  },
  resetBtn: {
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
});