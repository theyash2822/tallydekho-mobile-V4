import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../src/constants/colors';
import QuickActionsModal from '../../src/components/QuickActionsModal';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import Toast from 'react-native-toast-message';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabDef {
  name: string;
  titleKey: string;
  icon: IoniconName;
  iconOutline: IoniconName;
  capability?: string;
}

const TAB_DEFS: TabDef[] = [
  { name: 'index',   titleKey: 'nav.home',    icon: 'home',      iconOutline: 'home-outline',      capability: 'dashboard.view' },
  { name: 'ledger',  titleKey: 'nav.ledger',  icon: 'journal',   iconOutline: 'journal-outline',   capability: 'ledgers.view' },
  { name: 'stocks',  titleKey: 'nav.stocks',  icon: 'cube',      iconOutline: 'cube-outline',      capability: 'inventory.view' },
  { name: 'reports', titleKey: 'nav.reports', icon: 'bar-chart', iconOutline: 'bar-chart-outline', capability: 'financials.view' },
];

interface Route {
  key: string;
  name: string;
}

interface CustomTabBarProps {
  state: { index: number; routes: Route[] };
  navigation: any;
  descriptors: any;
  onFabPress: () => void;
}

function CustomTabBar({ state, navigation, onFabPress }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { hasCapability } = useWorkspace();
  const bottomPad = Math.max(insets.bottom, 4);

  const routes = state.routes;
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  const handleTabPress = (route: Route, idx: number) => {
    const def = TAB_DEFS.find(tab => tab.name === route.name);
    if (def?.capability && !hasCapability(def.capability)) {
      Toast.show({ type: 'error', text1: 'Not allowed', text2: 'You do not have access to this module' });
      return;
    }
    const isFocused = state.index === idx;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const renderTab = (route: Route, idx: number) => {
    const def = TAB_DEFS.find(tab => tab.name === route.name);
    if (!def) return null;
    const allowed = !def.capability || hasCapability(def.capability);
    if (!allowed) return <View key={route.key} style={styles.tabItem} />;
    const isFocused = state.index === idx;
    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tabItem}
        onPress={() => handleTabPress(route, idx)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
      >
        <Ionicons
          name={isFocused ? def.icon : def.iconOutline}
          size={22}
          color={isFocused ? COLORS.navText : COLORS.inactiveNavText}
        />
        <Text style={[styles.tabLabel, { color: isFocused ? COLORS.navText : COLORS.inactiveNavText }]}>
          {t(def.titleKey)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
        {/* Left tabs: Home, Stocks */}
        <View style={styles.tabSide}>
          {leftRoutes.map((r, i) => renderTab(r, i))}
        </View>

        {/* Center FAB */}
        <View style={styles.fabWrap}>
          <TouchableOpacity
            testID="central-fab"
            style={styles.fab}
            onPress={onFabPress}
            activeOpacity={0.85}
            accessibilityLabel={t('nav.quickActions')}
          >
            <Ionicons name="add" size={30} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Right tabs: Ledger, Reports */}
        <View style={styles.tabSide}>
          {rightRoutes.map((r, i) => renderTab(r, i + 2))}
        </View>
      </View>
    </>
  );
}

export default function TabsLayout() {
  const [showActions, setShowActions] = useState(false);
  const { hasCapability, loading } = useWorkspace();
  const handleFabPress = useCallback(() => setShowActions(true), []);
  const handleModalClose = useCallback(() => setShowActions(false), []);
  // Memoize the tabBar renderer so React Navigation never sees a prop change
  // and never remounts CustomTabBar (which would reset any internal state)
  const renderTabBar = useCallback(
    (props: any) => <CustomTabBar {...props} onFabPress={handleFabPress} />,
    [handleFabPress],
  );

  const tabHref = (cap?: string) => {
    if (!cap) return undefined;
    // Fail closed while loading / missing view cap — hide from Expo Router tab list
    if (loading || !hasCapability(cap)) return null;
    return undefined;
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={renderTabBar}
      >
        <Tabs.Screen name="index" options={{ href: tabHref('dashboard.view') }} />
        <Tabs.Screen name="ledger" options={{ href: tabHref('ledgers.view') }} />
        <Tabs.Screen name="stocks" options={{ href: tabHref('inventory.view') }} />
        <Tabs.Screen name="reports" options={{ href: tabHref('financials.view') }} />
      </Tabs>
      {/* Modal lives outside Tabs so navigation re-renders never affect it */}
      <QuickActionsModal visible={showActions} onClose={handleModalClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',   // float over content — removes React Nav auto-padding gap
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.navBg,
    paddingTop: 8,
    elevation: 10,
    boxShadow: '0 -3px 10px rgba(0, 0, 0, 0.3)',
    alignItems: 'flex-end',
    overflow: 'visible',    // allow FAB (marginTop: -20) to protrude & receive touches
  },
  tabSide: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 4,
    minHeight: 52,
    justifyContent: 'flex-end',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  fabWrap: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    overflow: 'visible',    // allow FAB to extend above tabBar and receive touch
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    borderWidth: 3,
    borderColor: '#F5F4EF',
    elevation: 8,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
  },
});
