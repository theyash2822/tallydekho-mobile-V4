import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/colors';
import { useTranslation } from 'react-i18next';
import FilterBottomSheet, { FilterCheckRow, FilterRadioRow, filterSheetContentStyles as fm } from './FilterBottomSheet';

export type ArApView = 'bills' | 'settlements';

export function arApActiveFilterCount(view: ArApView, overdueOnly: boolean): number {
  return (view === 'settlements' ? 1 : 0) + (view === 'bills' && overdueOnly ? 1 : 0);
}

export default function ArApFilterSheet({
  visible,
  onClose,
  view,
  overdueOnly,
  settlementsLabel,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  view: ArApView;
  overdueOnly: boolean;
  /** "Receipts" on Receivables, "Payments" on Payables */
  settlementsLabel: string;
  onApply: (view: ArApView, overdueOnly: boolean) => void;
}) {
  const { t } = useTranslation();
  const [localView, setLocalView] = useState<ArApView>(view);
  const [localOverdue, setLocalOverdue] = useState(overdueOnly);
  const [wasVisible, setWasVisible] = useState(visible);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setLocalView(view);
      setLocalOverdue(overdueOnly);
    }
  }

  const overdueDisabled = localView === 'settlements';

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('common.filter')}
      activeCount={arApActiveFilterCount(localView, localOverdue)}
      onClear={() => { setLocalView('bills'); setLocalOverdue(false); }}
      onApply={() => onApply(localView, overdueDisabled ? false : localOverdue)}
      applyLabel={t('screens.componentsArApFilterSheet.applyFilters')}
      heightFraction={0.5}
    >
      <Text style={s.sectionLbl}>{t('screens.componentsArApFilterSheet.show')}</Text>
      <View style={fm.panel}>
        <FilterRadioRow
          label={t('screens.componentsArApFilterSheet.outstandingBills')}
          selected={localView === 'bills'}
          onPress={() => setLocalView('bills')}
        />
        <FilterRadioRow
          label={settlementsLabel}
          selected={localView === 'settlements'}
          onPress={() => { setLocalView('settlements'); setLocalOverdue(false); }}
        />
      </View>

      <Text style={s.sectionLbl}>{t('screens.componentsArApFilterSheet.status')}</Text>
      <View style={[fm.panel, overdueDisabled && s.disabled]} pointerEvents={overdueDisabled ? 'none' : 'auto'}>
        <FilterCheckRow
          label={t('screens.componentsArApFilterSheet.overdueOnly')}
          selected={!overdueDisabled && localOverdue}
          onPress={() => setLocalOverdue((v) => !v)}
        />
        {overdueDisabled && (
          <Text style={s.note}>{t('screens.componentsArApFilterSheet.notApplicableTo', { label: settlementsLabel.toLowerCase() })}</Text>
        )}
      </View>
    </FilterBottomSheet>
  );
}

const s = StyleSheet.create({
  sectionLbl: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 4,
  },
  disabled: { opacity: 0.4 },
  note: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, paddingHorizontal: SPACING.md, paddingTop: 2 },
});
