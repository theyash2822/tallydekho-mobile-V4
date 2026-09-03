import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const { width: SW } = Dimensions.get('window');
const BANNER_W = SW - SPACING.md * 2;
const BANNER_RED = '#E53935';

export type AlertBannerItem = {
  id: string;
  bold: string;
  sub: string;
  action: string;
  onAction?: () => void;
};

export type AlertBannerCarouselProps = {
  banners: AlertBannerItem[];
  autoRotateMs?: number;
  bottomInset?: number;
};

export function AlertBannerCarousel({
  banners,
  autoRotateMs = 4000,
  bottomInset = 8,
}: AlertBannerCarouselProps) {
  const bannerRef = useRef<FlatList>(null);
  const [bannerIdx, setBannerIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, autoRotateMs);
    return () => clearInterval(id);
  }, [banners.length, autoRotateMs]);

  if (banners.length === 0) return null;

  return (
    <View style={[s.wrap, { paddingBottom: bottomInset }]}>
      <FlatList
        ref={bannerRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={b => b.id}
        scrollEnabled={false}
        snapToInterval={BANNER_W + 10}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: BANNER_W + 10, offset: (BANNER_W + 10) * index, index })}
        onScrollToIndexFailed={() => {}}
        contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 10 }}
        renderItem={({ item: b }) => (
          <View style={s.card}>
            <View style={s.left}>
              <View style={s.iconWrap}>
                <Ionicons name="warning-outline" size={15} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bold} numberOfLines={1}>{b.bold}</Text>
                <Text style={s.sub} numberOfLines={1}>{b.sub}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.actionBtn} activeOpacity={0.85} onPress={b.onAction}>
              <Text style={s.actionTxt}>{b.action}</Text>
              <Ionicons name="chevron-forward" size={11} color={BANNER_RED} />
            </TouchableOpacity>
          </View>
        )}
      />
      {banners.length > 1 && (
        <View style={s.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[s.dot, i === bannerIdx && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: COLORS.pageBg, paddingTop: SPACING.sm },
  card: {
    width: BANNER_W,
    backgroundColor: BANNER_RED,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bold: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  sub: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  actionTxt: { fontSize: 10, fontWeight: '700', color: BANNER_RED },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingTop: 6,
    paddingBottom: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 14, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
});
