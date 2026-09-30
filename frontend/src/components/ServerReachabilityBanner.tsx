import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { subscribeServerReachability } from '../services/apiErrors';

/** Short blips stay silent; the banner appears only once an outage lasts this long. */
const SHOW_AFTER_MS = 10_000;

export default function ServerReachabilityBanner() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribeServerReachability((since) => {
      if (timer) { clearTimeout(timer); timer = null; }
      if (since == null) {
        setVisible(false);
        return;
      }
      const wait = Math.max(0, SHOW_AFTER_MS - (Date.now() - since));
      timer = setTimeout(() => setVisible(true), wait);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[s.wrap, { top: insets.top + SPACING.xs }]}>
      <View style={s.pill}>
        <Ionicons name="cloud-offline-outline" size={14} color={COLORS.white} />
        <Text style={s.txt}>{t('screens.componentsServerReachabilityBanner.cantReachServer')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1001 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    opacity: 0.92,
  },
  txt: { color: COLORS.white, fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
});
