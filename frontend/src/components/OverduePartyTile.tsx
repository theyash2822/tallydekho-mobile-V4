import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';
import { EntityListTile } from './EntityListTile';

type Props = {
  party: string;
  overdueLabel: string;
  amount: string;
  phone?: string;
  onPress?: () => void;
  onCall: (phone: string) => void;
  onWhatsApp: (phone: string) => void;
};

/** Overdue party card — swipe left for Call / WhatsApp, same as the Ledger tab. */
export function OverduePartyTile({ party, overdueLabel, amount, phone, onPress, onCall, onWhatsApp }: Props) {
  const { t } = useTranslation();

  const card = (
    <EntityListTile
      name={party}
      subtitle={overdueLabel}
      onPress={onPress}
      trailing={<Text style={s.amount}>{amount}</Text>}
    />
  );

  if (!phone) return <View>{card}</View>;

  return (
    <ReanimatedSwipeable
      renderRightActions={() => (
        <View style={s.actions}>
          <TouchableOpacity style={s.callAction} onPress={() => onCall(phone)} activeOpacity={0.85}>
            <Ionicons name="call" size={22} color="#fff" />
            <Text style={s.actionLabel}>{t('screens.tabsLedger.call')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.waAction} onPress={() => onWhatsApp(phone)} activeOpacity={0.85}>
            <FontAwesome5 name="whatsapp" size={22} color="#fff" />
            <Text style={s.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      )}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
      containerStyle={{ borderRadius: RADIUS.md, overflow: 'hidden' }}
    >
      {card}
    </ReanimatedSwipeable>
  );
}

const s = StyleSheet.create({
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.negative },
  actions: { flexDirection: 'row' },
  callAction: { width: 80, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center', gap: 5 },
  waAction: { width: 80, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionLabel: { fontSize: 11, fontWeight: '700', color: '#fff' },
});
