import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ScrollViewInstance,
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, BackHandler, useWindowDimensions,
  type DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { markGuideSeen, guideDestination } from '../src/utils/onboardingNav';
import { AuditerMark, AuditerWordmark } from '../src/components/AuditerLogo';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type MockProps = { active: boolean };

/** Every illustration gets the same frame, so titles sit at the same height on each slide. */
const MOCK_H = 268;
const ACTION_W = 58;
const PAIR_CODE = ['4', '8', '2', '9', '1', '7'];

/** "FY 2026-27" for today — the illustration's fallback before a year is picked. */
function currentFyLabel(d: Date = new Date()): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks — the app's own cards, pills and icon dots
// ─────────────────────────────────────────────────────────────────────────────

/** A ring round the control a slide is about; animates only on the visible slide. */
function Pulse({ active, radius = RADIUS.md, children }: {
  active: boolean; radius?: number; children: React.ReactNode;
}) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.delay(300),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[m.pulse, {
          borderRadius: radius + 4,
          opacity: v,
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
        }]}
      />
      {children}
    </View>
  );
}

/** Placeholder text line, as the app's loading rows draw it. */
function Line({ w, h = 8, color = COLORS.borderDefault }: { w: DimensionValue; h?: number; color?: string }) {
  return <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />;
}

function IconDot({ name, size = 30, bg = COLORS.pageBg, color = COLORS.textPrimary }: {
  name: IconName; size?: number; bg?: string; color?: string;
}) {
  return (
    <View style={[m.iconDot, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={name} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

function SwipeAction({ icon, label, bg }: { icon: IconName; label: string; bg: string }) {
  return (
    <View style={[m.action, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={16} color={COLORS.white} />
      <Text style={m.actionTxt} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide illustrations
// ─────────────────────────────────────────────────────────────────────────────

function WelcomeMock({ active }: MockProps) {
  const { t } = useTranslation();
  const rise = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (!active) return;
    rise.setValue(0);
    const anim = Animated.spring(rise, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 });
    anim.start();
    return () => anim.stop();
  }, [active, rise]);
  return (
    <View style={m.center}>
      <Animated.View
        style={[m.logoBox, {
          opacity: rise,
          transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}
      >
        <AuditerMark height={34} color={COLORS.white} />
      </Animated.View>
      <View style={{ marginTop: SPACING.md }}>
        <AuditerWordmark height={26} color={COLORS.textPrimary} />
      </View>
      <View style={m.flowRow}>
        <View style={m.flowPill}>
          <Ionicons name="desktop-outline" size={14} color={COLORS.textSecondary} />
          <Text style={m.flowTxt}>TallyPrime</Text>
        </View>
        <Ionicons name="sync-outline" size={16} color={COLORS.positive} />
        <View style={m.flowPill}>
          <Ionicons name="phone-portrait-outline" size={14} color={COLORS.textSecondary} />
          <Text style={m.flowTxt}>{t('onboarding.brand')}</Text>
        </View>
      </View>
    </View>
  );
}

function ConnectMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View style={m.stack}>
      <View style={m.card}>
        <View style={m.rowStart}>
          <IconDot name="desktop-outline" bg={COLORS.activeBg} />
          <Text style={m.cardTitle} numberOfLines={1}>{t('screens.settingsTallySync.desktopAgent')}</Text>
        </View>
        <View style={{ marginTop: SPACING.sm + 2 }}>
          <Pulse active={active}>
            <View style={m.codeRow}>
              {PAIR_CODE.map((d, i) => (
                <View key={i} style={m.codeBox}><Text style={m.codeTxt}>{d}</Text></View>
              ))}
            </View>
          </Pulse>
        </View>
      </View>
      <Ionicons name="arrow-down" size={18} color={COLORS.textTertiary} style={{ alignSelf: 'center' }} />
      <View style={[m.card, m.rowBetween]}>
        <View style={m.rowStart}>
          <IconDot name="home-outline" />
          <Line w={84} />
        </View>
        <View style={m.demoPill}>
          <Text style={m.demoTxt} numberOfLines={1}>{t('screens.settingsMyAccess.demoMode')}</Text>
        </View>
      </View>
    </View>
  );
}

function CompanyMock({ active }: MockProps) {
  const { t } = useTranslation();
  const { company, selectedFY, user } = useAuth();
  const companyName = company?.name || t('home.myCompany');
  const fyLabel = selectedFY?.label || currentFyLabel();
  const initial = (user?.name || companyName).trim().charAt(0).toUpperCase();
  return (
    <View style={m.stack}>
      <View style={[m.card, m.rowBetween]}>
        <View style={{ flex: 1, marginRight: SPACING.sm }}>
          <Pulse active={active} radius={RADIUS.sm}>
            <View style={m.rowStart}>
              <Text style={m.companyTxt} numberOfLines={1}>{companyName}</Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.brandPrimary} />
            </View>
          </Pulse>
          <View style={[m.rowStart, m.syncRow]}>
            <Ionicons name="sync-outline" size={11} color={COLORS.textTertiary} />
            <Text style={m.mutedTxt} numberOfLines={1}>{t('screens.componentsHeader.synced', { time: '10:42' })}</Text>
          </View>
        </View>
        <View style={m.rowStart}>
          <Pulse active={active} radius={RADIUS.sm}>
            <View style={m.fyPill}>
              <Text style={m.fyTxt}>{fyLabel}</Text>
              <Ionicons name="chevron-down" size={10} color={COLORS.brandPrimary} />
            </View>
          </Pulse>
          <Ionicons name="notifications-outline" size={18} color={COLORS.textPrimary} />
          <View style={m.avatar}><Text style={m.avatarTxt}>{initial}</Text></View>
        </View>
      </View>
      <View style={m.card}>
        <View style={m.listRow}>
          <Text style={m.listTxt} numberOfLines={1}>{companyName}</Text>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.brandPrimary} />
        </View>
        <View style={[m.listRow, m.listRowLast]}>
          <Line w="55%" />
        </View>
      </View>
    </View>
  );
}

function HomeMock({ active }: MockProps) {
  const { t } = useTranslation();
  const { formatAmountCompact } = useSettings();
  return (
    <View style={m.stack}>
      <View style={[m.card, m.rowBetween]}>
        <View style={m.rowStart}>
          <IconDot name="trending-up-outline" bg={COLORS.positiveBg} color={COLORS.positive} />
          <View>
            <Text style={m.mutedTxt}>{t('dashboard.totalSales')}</Text>
            <Text style={m.kpiValue}>{formatAmountCompact(482500)}</Text>
          </View>
        </View>
        <View style={m.trendPill}><Text style={m.trendTxt}>+12%</Text></View>
      </View>
      <View style={m.dotsRow}>
        <View style={[m.miniDot, m.miniDotOn]} />
        <View style={m.miniDot} />
        <View style={m.miniDot} />
      </View>
      <View style={m.periodRow}>
        {['7D', '1M', '3M', '6M'].map((p) => (
          <View key={p} style={[m.periodPill, p === '1M' && m.periodPillOn]}>
            <Text style={[m.periodTxt, p === '1M' && m.periodTxtOn]}>{p}</Text>
          </View>
        ))}
      </View>
      <View style={m.card}>
        <View style={m.rowBetween}>
          <View style={m.rowStart}>
            <IconDot name="analytics-outline" size={24} />
            <Text style={m.cardTitle} numberOfLines={1}>{t('dashboard.cashflow')}</Text>
          </View>
          <Pulse active={active} radius={RADIUS.sm}>
            <View style={m.squareBtn}><Ionicons name="expand-outline" size={14} color={COLORS.textSecondary} /></View>
          </Pulse>
        </View>
        <View style={[m.barTrack, { marginTop: SPACING.sm }]}>
          <View style={[m.barFill, { width: '72%', backgroundColor: COLORS.positive }]} />
        </View>
        <View style={[m.barTrack, { marginTop: 6 }]}>
          <View style={[m.barFill, { width: '46%', backgroundColor: COLORS.negative }]} />
        </View>
      </View>
    </View>
  );
}

const SEARCH_ROWS: { icon: IconName; w: DimensionValue }[] = [
  { icon: 'document-text-outline', w: '62%' },
  { icon: 'person-outline', w: '48%' },
  { icon: 'cube-outline', w: '55%' },
];

function VoiceMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View style={m.stack}>
      <View style={m.searchBar}>
        <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
        <Text style={m.searchTxt} numberOfLines={1}>{t('dashboard.searchPlaceholder')}</Text>
        <Pulse active={active} radius={RADIUS.full}>
          <View style={m.micBtn}><Ionicons name="mic" size={14} color={COLORS.white} /></View>
        </Pulse>
      </View>
      <View style={m.card}>
        {SEARCH_ROWS.map((r, i) => (
          <View key={r.icon} style={[m.listRow, i === SEARCH_ROWS.length - 1 && m.listRowLast]}>
            <IconDot name={r.icon} size={26} />
            <View style={m.lines}>
              <Line w={r.w} />
              <Line w="30%" h={6} />
            </View>
            <Ionicons name="chevron-forward" size={13} color={COLORS.textTertiary} />
          </View>
        ))}
      </View>
    </View>
  );
}

const CREATE_SECTIONS: { icon: IconName; key: string }[] = [
  { icon: 'receipt-outline', key: 'quickActions.sales' },
  { icon: 'bag-handle-outline', key: 'quickActions.purchase' },
  { icon: 'wallet-outline', key: 'quickActions.voucher' },
  { icon: 'layers-outline', key: 'quickActions.inventory' },
  { icon: 'book-outline', key: 'quickActions.ledgers' },
];

function CreateMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View>
      <View style={m.sheet}>
        <View style={m.sheetHandle} />
        <Text style={m.cardTitle} numberOfLines={1}>{t('quickActions.title')}</Text>
        {CREATE_SECTIONS.map((sec) => (
          <View key={sec.key} style={m.sheetRow}>
            <IconDot name={sec.icon} size={22} />
            <Text style={m.listTxt} numberOfLines={1}>{t(sec.key)}</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
          </View>
        ))}
      </View>
      <View style={m.plusWrap}>
        <Pulse active={active} radius={RADIUS.full}>
          <View style={m.plusBtn}><Ionicons name="add" size={26} color={COLORS.white} /></View>
        </Pulse>
      </View>
    </View>
  );
}

function SwipeMock({ active }: MockProps) {
  const { t } = useTranslation();
  const partyX = useState(() => new Animated.Value(0))[0];
  const stockX = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    partyX.setValue(0);
    stockX.setValue(0);
    if (!active) return;
    const move = (v: Animated.Value, toValue: number) =>
      Animated.timing(v, { toValue, duration: 420, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(500),
      move(partyX, -ACTION_W * 2), Animated.delay(1100), move(partyX, 0),
      Animated.delay(300),
      move(stockX, ACTION_W * 2), Animated.delay(1100), move(stockX, 0),
      Animated.delay(300),
      move(stockX, -ACTION_W), Animated.delay(1100), move(stockX, 0),
      Animated.delay(400),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, partyX, stockX]);

  return (
    <View style={m.stack}>
      {/* Party: swipe left for Call / WhatsApp */}
      <View style={m.swipeRow}>
        <View style={[m.actions, m.actionsRight]}>
          <SwipeAction icon="call" label={t('screens.tabsLedger.call')} bg={COLORS.brandPrimary} />
          <SwipeAction icon="logo-whatsapp" label="WhatsApp" bg={COLORS.positive} />
        </View>
        <Animated.View style={[m.swipeCard, { transform: [{ translateX: partyX }] }]}>
          <IconDot name="person-outline" size={28} />
          <View style={m.lines}><Line w="58%" /><Line w="34%" h={6} /></View>
        </Animated.View>
      </View>
      {/* Stock: right for Transfer / Adjust, left for Edit */}
      <View style={m.swipeRow}>
        <View style={[m.actions, m.actionsLeft]}>
          <SwipeAction icon="swap-horizontal-outline" label={t('screens.stocksTotalStock.transfer')} bg={COLORS.brandPrimary} />
          <SwipeAction icon="options-outline" label={t('screens.stocksTotalStock.adjust')} bg={COLORS.textSecondary} />
        </View>
        <View style={[m.actions, m.actionsRight]}>
          <SwipeAction icon="create-outline" label={t('common.edit')} bg={COLORS.textSecondary} />
        </View>
        <Animated.View style={[m.swipeCard, { transform: [{ translateX: stockX }] }]}>
          <IconDot name="cube-outline" size={28} />
          <View style={m.lines}><Line w="50%" /><Line w="28%" h={6} /></View>
        </Animated.View>
      </View>
      {/* Long-press: select many, share one PDF */}
      <View style={m.selectBar}>
        <View style={m.rowStart}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
          <Text style={m.selectTxt} numberOfLines={1}>{t('common.selected', { count: 3 })}</Text>
        </View>
        <View style={m.rowStart}>
          <Ionicons name="share-outline" size={14} color={COLORS.white} />
          <Text style={m.selectTxt} numberOfLines={1}>{t('pdf.sharePdf')}</Text>
        </View>
      </View>
    </View>
  );
}

const REPORT_TILES: { icon: IconName; key: string }[] = [
  { icon: 'stats-chart-outline', key: 'reports.financial' },
  { icon: 'receipt-outline', key: 'reports.gstReturns' },
  { icon: 'document-text-outline', key: 'reports.einvoices' },
  { icon: 'navigate-outline', key: 'reports.ewayBills' },
  { icon: 'git-branch-outline', key: 'reports.auditTrail' },
  { icon: 'sparkles-outline', key: 'reports.aiInsights' },
];

function ReportsMock() {
  const { t } = useTranslation();
  return (
    <View style={m.grid}>
      {REPORT_TILES.map((tile) => (
        <View key={tile.key} style={m.tile}>
          <Ionicons name={tile.icon} size={18} color={COLORS.textPrimary} />
          <Text style={m.tileTxt} numberOfLines={2}>{t(tile.key)}</Text>
        </View>
      ))}
    </View>
  );
}

const ALERT_ROWS: { icon: IconName; key: string; color: string; bg: string }[] = [
  { icon: 'cube-outline', key: 'notifications.filterStock', color: COLORS.warning, bg: COLORS.warningBg },
  { icon: 'time-outline', key: 'notifications.filterReceivables', color: COLORS.negative, bg: COLORS.negativeBg },
  { icon: 'shield-checkmark-outline', key: 'notifications.filterCompliance', color: COLORS.info, bg: COLORS.infoBg },
  { icon: 'sync-outline', key: 'notifications.sync', color: COLORS.textSecondary, bg: COLORS.activeBg },
];

function AlertsMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View style={m.stack}>
      <View style={m.card}>
        <View style={m.rowBetween}>
          <Text style={m.cardTitle} numberOfLines={1}>{t('notifications.title')}</Text>
          <Pulse active={active} radius={RADIUS.full}>
            <View style={m.bellWrap}>
              <Ionicons name="notifications-outline" size={18} color={COLORS.textPrimary} />
              <View style={m.badge}><Text style={m.badgeTxt}>4</Text></View>
            </View>
          </Pulse>
        </View>
        {ALERT_ROWS.map((r, i) => (
          <View key={r.key} style={[m.listRow, m.listRowTight, i === ALERT_ROWS.length - 1 && m.listRowLast]}>
            <IconDot name={r.icon} size={22} bg={r.bg} color={r.color} />
            <Text style={m.listTxt} numberOfLines={1}>{t(r.key)}</Text>
            <Line w={44} h={6} />
          </View>
        ))}
      </View>
      <View style={[m.card, m.rowBetween]}>
        <View style={[m.rowStart, m.shrink]}>
          <IconDot name="shield-checkmark-outline" size={22} bg={COLORS.activeBg} />
          <Text style={m.cardTitle} numberOfLines={1}>{t('screens.settings.requests')}</Text>
        </View>
        <View style={m.rowStart}>
          <View style={m.chip}><Text style={m.chipTxt} numberOfLines={1}>{t('screens.settingsApprovals.typeRestore')}</Text></View>
          <View style={m.chip}><Text style={m.chipTxt} numberOfLines={1}>{t('screens.settingsApprovals.typeHardSync')}</Text></View>
        </View>
      </View>
    </View>
  );
}

function WorkspaceMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View style={m.stack}>
      <View style={m.card}>
        <View style={m.listRow}>
          <IconDot name="business-outline" size={26} />
          <Text style={m.listTxt} numberOfLines={1}>{t('screens.settings.switchWorkspace')}</Text>
          <Pulse active={active} radius={RADIUS.full}>
            <View style={m.roundBtn}><Ionicons name="swap-horizontal-outline" size={14} color={COLORS.brandPrimary} /></View>
          </Pulse>
        </View>
        <View style={m.listRow}>
          <IconDot name="key-outline" size={26} />
          <Text style={m.listTxt} numberOfLines={1}>{t('screens.settings.myAccess')}</Text>
          <View style={m.chip}><Text style={m.chipTxt} numberOfLines={1}>{t('screens.settings.owner')}</Text></View>
        </View>
        <View style={[m.listRow, m.listRowLast]}>
          <IconDot name="card-outline" size={26} />
          <Text style={m.listTxt} numberOfLines={1}>{t('settings.license')}</Text>
          <Text style={m.creditTxt} numberOfLines={1}>120 {t('screens.settingsLicense.credits')}</Text>
        </View>
      </View>
      <View style={[m.card, m.rowBetween]}>
        <View style={m.rowStart}>
          <IconDot name="globe-outline" size={26} bg={COLORS.infoBg} color={COLORS.info} />
          <Line w={80} />
        </View>
        <View style={m.rowStart}>
          <Ionicons name="people-outline" size={16} color={COLORS.textSecondary} />
          <Ionicons name="receipt-outline" size={16} color={COLORS.textSecondary} />
        </View>
      </View>
    </View>
  );
}

function HelpMock({ active }: MockProps) {
  const { t } = useTranslation();
  return (
    <View style={m.stack}>
      <View style={m.card}>
        <View style={m.rowStart}>
          <IconDot name="sparkles-outline" size={26} bg={COLORS.brandPrimary} color={COLORS.white} />
          <Text style={m.cardTitle} numberOfLines={1}>{t('screens.settingsHelp.aiSupport')}</Text>
        </View>
        <View style={m.bubbleBot}>
          <Line w="85%" />
          <Line w="60%" />
        </View>
        <View style={m.bubbleUser}>
          <Line w={84} color={COLORS.inactiveNavText} />
        </View>
        <View style={m.askBar}>
          <Text style={m.searchTxt} numberOfLines={1}>{t('screens.settingsHelp.askFollowUp')}</Text>
          <Ionicons name="arrow-up-circle" size={20} color={COLORS.brandPrimary} />
        </View>
      </View>
      <Pulse active={active}>
        <View style={[m.card, m.rowBetween]}>
          <View style={m.rowStart}>
            <IconDot name="compass-outline" size={26} />
            <Text style={m.cardTitle} numberOfLines={1}>{t('settings.appGuide')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
        </View>
      </Pulse>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slides
// ─────────────────────────────────────────────────────────────────────────────
const SLIDES: {
  id: string;
  icon: IconName;
  titleKey: string;
  descKey: string;
  Mock: React.ComponentType<MockProps>;
}[] = [
  { id: 'welcome',   icon: 'sparkles-outline',        titleKey: 'onboarding.welcomeTitle',   descKey: 'onboarding.welcomeDesc',   Mock: WelcomeMock },
  { id: 'connect',   icon: 'link-outline',            titleKey: 'onboarding.connectTitle',   descKey: 'onboarding.connectDesc',   Mock: ConnectMock },
  { id: 'company',   icon: 'business-outline',        titleKey: 'onboarding.companyTitle',   descKey: 'onboarding.companyDesc',   Mock: CompanyMock },
  { id: 'home',      icon: 'home-outline',            titleKey: 'onboarding.homeTitle',      descKey: 'onboarding.homeDesc',      Mock: HomeMock },
  { id: 'voice',     icon: 'mic-outline',             titleKey: 'onboarding.voiceTitle',     descKey: 'onboarding.voiceDesc',     Mock: VoiceMock },
  { id: 'create',    icon: 'add-circle-outline',      titleKey: 'onboarding.createTitle',    descKey: 'onboarding.createDesc',    Mock: CreateMock },
  { id: 'swipe',     icon: 'swap-horizontal-outline', titleKey: 'onboarding.swipeTitle',     descKey: 'onboarding.swipeDesc',     Mock: SwipeMock },
  { id: 'reports',   icon: 'bar-chart-outline',       titleKey: 'onboarding.reportsTitle',   descKey: 'onboarding.reportsDesc',   Mock: ReportsMock },
  { id: 'alerts',    icon: 'notifications-outline',   titleKey: 'onboarding.alertsTitle',    descKey: 'onboarding.alertsDesc',    Mock: AlertsMock },
  { id: 'workspace', icon: 'people-outline',          titleKey: 'onboarding.workspaceTitle', descKey: 'onboarding.workspaceDesc', Mock: WorkspaceMock },
  { id: 'help',      icon: 'help-circle-outline',     titleKey: 'onboarding.helpTitle',      descKey: 'onboarding.helpDesc',      Mock: HelpMock },
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen — once after sign-in (navigateAfterAuth), or replayed from Settings → App Guide
// ─────────────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string; next?: string }>();
  const isReplay = params.replay === 'true';
  const { user } = useAuth();
  const { width: pageW } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [pageH, setPageH] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const finishingRef = useRef(false);

  const goToIndex = useCallback((idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * pageW, animated: true });
    setCurrentIndex(idx);
  }, [pageW]);

  // Finishing or skipping marks the guide seen; a replay never touches the flag.
  const finishGuide = useCallback(async () => {
    if (isReplay) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    await markGuideSeen(user?.id).catch(() => {});
    router.replace(guideDestination(params.next) as Href);
  }, [isReplay, router, user?.id, params.next]);

  const goNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) goToIndex(currentIndex + 1);
    else finishGuide();
  }, [currentIndex, goToIndex, finishGuide]);

  // Android back steps through the slides; on the first one it skips the guide.
  useEffect(() => {
    if (isReplay) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentIndex > 0) goToIndex(currentIndex - 1);
      else finishGuide();
      return true;
    });
    return () => sub.remove();
  }, [isReplay, currentIndex, goToIndex, finishGuide]);

  const onScrollEnd = useCallback((e: any) => {
    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / pageW));
  }, [pageW]);

  const isLast = currentIndex === SLIDES.length - 1;
  const ctaLabel = !isLast
    ? t('onboarding.next')
    : isReplay ? t('onboarding.done') : t('onboarding.getStarted');

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.topBar}>
        <Text style={s.stepTxt}>{currentIndex + 1} / {SLIDES.length}</Text>
        {!isLast && (
          <TouchableOpacity style={s.skipBtn} onPress={finishGuide} activeOpacity={0.7} accessibilityRole="button">
            <Text style={s.skipTxt}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
        style={s.pager}
        bounces={false}
      >
        {pageH > 0 && SLIDES.map((slide, i) => {
          const Mock = slide.Mock;
          return (
            <ScrollView
              key={slide.id}
              style={{ width: pageW, height: pageH }}
              contentContainerStyle={s.page}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <View style={s.mockFrame}>
                <Mock active={i === currentIndex} />
              </View>
              <View style={s.textBlock}>
                <View style={s.titleIcon}>
                  <Ionicons name={slide.icon} size={18} color={COLORS.brandPrimary} />
                </View>
                <Text style={s.title}>{t(slide.titleKey)}</Text>
                <Text style={s.desc}>{t(slide.descKey)}</Text>
              </View>
            </ScrollView>
          );
        })}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={s.bottomNav}>
        <View style={s.dotsRow}>
          {SLIDES.map((slide, i) => (
            <TouchableOpacity key={slide.id} onPress={() => goToIndex(i)} hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}>
              <View style={[s.dot, i === currentIndex && s.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.ctaBtn} onPress={goNext} activeOpacity={0.85} accessibilityRole="button">
          <Text style={s.ctaTxt}>{ctaLabel}</Text>
          <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md + 6,
  },
  stepTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary, marginTop: SPACING.sm + 2 },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 7, marginTop: SPACING.sm + 2,
    borderRadius: RADIUS.full, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  skipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },

  pager: { flex: 1 },
  page: {
    flexGrow: 1, justifyContent: 'center',
    paddingTop: SPACING.xxl + SPACING.sm, paddingBottom: SPACING.md, paddingHorizontal: SPACING.md + 6,
  },
  mockFrame: {
    height: MOCK_H, justifyContent: 'center', overflow: 'hidden',
    backgroundColor: COLORS.hoverBg, borderRadius: RADIUS.xl, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  textBlock: { paddingTop: SPACING.lg },
  titleIcon: {
    width: 36, height: 36, borderRadius: 18, marginBottom: SPACING.sm + 4,
    backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3, marginBottom: SPACING.sm },
  desc: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, lineHeight: 22 },

  bottomNav: {
    paddingHorizontal: SPACING.md + 6, paddingTop: SPACING.sm, paddingBottom: SPACING.sm + 4,
    backgroundColor: COLORS.pageBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: SPACING.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.borderStrong },
  dotActive: { width: 20, backgroundColor: COLORS.brandPrimary },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 15,
  },
  ctaTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});

const m = StyleSheet.create({
  pulse: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
    borderWidth: 2, borderColor: COLORS.info,
  },
  iconDot: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  stack: { gap: SPACING.sm },
  shrink: { flexShrink: 1 },
  lines: { flex: 1, gap: 5 },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm + 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: { flexShrink: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  mutedTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  listRowTight: { paddingVertical: 4 },
  listRowLast: { borderBottomWidth: 0 },
  listTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  chip: {
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },

  // Welcome
  logoBox: {
    width: 76, height: 76, borderRadius: RADIUS.xl, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  flowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.sm + 4, paddingVertical: 6, borderRadius: RADIUS.full,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  flowTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },

  // Connect
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  codeBox: {
    flex: 1, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderStrong, backgroundColor: COLORS.pageBg,
  },
  codeTxt: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  demoPill: {
    flexShrink: 1, paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full,
    backgroundColor: COLORS.warningBg, borderWidth: 1, borderColor: COLORS.warning,
  },
  demoTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.warning },

  // Company & year
  companyTxt: { flexShrink: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  syncRow: { gap: 4, marginTop: 4 },
  fyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderWidth: 1.5, borderColor: COLORS.borderStrong, borderStyle: 'dashed', borderRadius: RADIUS.sm,
  },
  fyTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  avatar: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.white },

  // Home
  kpiValue: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  trendPill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: COLORS.positiveBg },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.positive },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  miniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong },
  miniDotOn: { width: 14, backgroundColor: COLORS.brandPrimary },
  periodRow: {
    flexDirection: 'row', alignSelf: 'flex-start', gap: 2, padding: 3, borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  periodPill: { paddingHorizontal: SPACING.sm + 4, paddingVertical: 4, borderRadius: RADIUS.full },
  periodPillOn: { backgroundColor: COLORS.cardBg },
  periodTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  periodTxtOn: { fontWeight: '800', color: COLORS.textPrimary },
  squareBtn: {
    width: 28, height: 28, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  barTrack: { height: 8, backgroundColor: COLORS.borderDefault },
  barFill: { height: 8 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  micBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Create
  sheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 4, paddingTop: SPACING.sm, paddingBottom: SPACING.md + 4,
    borderWidth: 1, borderColor: COLORS.borderDefault, gap: 2,
  },
  sheetHandle: { width: 32, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 2 },
  plusWrap: { alignItems: 'center', marginTop: -22 },
  plusBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.hoverBg,
  },

  // Swipe & select
  swipeRow: { height: 52, borderRadius: RADIUS.md, overflow: 'hidden', justifyContent: 'center' },
  actions: { position: 'absolute', top: 0, bottom: 0, flexDirection: 'row' },
  actionsLeft: { left: 0 },
  actionsRight: { right: 0 },
  action: { width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  actionTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  swipeCard: {
    height: 52, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.sm + 2,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  selectBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm + 4, paddingVertical: 10,
  },
  selectTxt: { flexShrink: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },

  // Reports
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.sm },
  tile: {
    width: '31.5%', minHeight: 84, gap: 6, padding: SPACING.sm + 2,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tileTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },

  // Alerts
  bellWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 1, right: 1, minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3,
    backgroundColor: COLORS.negative, alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { fontSize: TYPOGRAPHY.xs - 2, fontWeight: '800', color: COLORS.white },

  // Workspace
  roundBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  creditTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.positive },

  // Help
  bubbleBot: {
    alignSelf: 'flex-start', width: '78%', gap: 6, marginTop: SPACING.sm, padding: SPACING.sm,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderTopLeftRadius: 2,
  },
  bubbleUser: {
    alignSelf: 'flex-end', marginTop: 6, padding: SPACING.sm,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, borderTopRightRadius: 2,
  },
  askBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm,
    paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
});
