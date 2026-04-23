import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import QuickActionsModal from '../../src/components/QuickActionsModal';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabDef {
  name: string;
  title: string;
  icon: IoniconName;
  iconOutline: IoniconName;
}

const TAB_DEFS: TabDef[] = [
  { name: 'index',   title: 'Home',    icon: 'home',      iconOutline: 'home-outline'      },
  { name: 'ledger',  title: 'Ledger',  icon: 'journal',   iconOutline: 'journal-outline'   },
  { name: 'stocks',  title: 'Stocks',  icon: 'cube',      iconOutline: 'cube-outline'      },
  { name: 'reports', title: 'Reports', icon: 'bar-chart', iconOutline: 'bar-chart-outline' },
];

interface Route {
  key: string;
  name: string;
}

interface CustomTabBarProps {
  state: { index: number; routes: Route[] };
  navigation: any;
  descriptors: any;
}

function CustomTabBar({ state, navigation }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [showActions, setShowActions] = useState(false);
  const bottomPad = Math.max(insets.bottom, 4);

  const routes = state.routes;
  const leftRoutes = routes.slice(0, 2);
  const rightRoutes = routes.slice(2);

  const handleTabPress = (route: Route, idx: number) => {
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
    const def = TAB_DEFS.find(t => t.name === route.name);
    if (!def) return null;
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
          {def.title}
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
            onPress={() => setShowActions(true)}
            activeOpacity={0.85}
            accessibilityLabel="Quick actions"
          >
            <Ionicons name="add" size={30} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Right tabs: Ledger, Reports */}
        <View style={styles.tabSide}>
          {rightRoutes.map((r, i) => renderTab(r, i + 2))}
        </View>
      </View>

      <QuickActionsModal
        visible={showActions}
        onClose={() => setShowActions(false)}
      />
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      sceneContainerStyle={{ backgroundColor: COLORS.pageBg }}
      tabBar={(props: any) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ledger" />
      <Tabs.Screen name="stocks" />
      <Tabs.Screen name="reports" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.navBg,
    paddingTop: 8,
    elevation: 10,
    boxShadow: '0 -3px 10px rgba(0, 0, 0, 0.3)',
    alignItems: 'flex-end',
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
