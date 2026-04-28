/**
 * CoachMark — In-App guided tour overlay system
 * Shows an animated white hand pointing at real UI elements
 * with a circular spotlight cutout on a dark overlay.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Modal, Dimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle, Path, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SW, height: SH } = Dimensions.get('window');

const GOLD = '#A89060';
const DARK = '#1A1A1A';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type HandType = 'tap' | 'swipe-left' | 'swipe-right' | 'long-press';

export interface CoachStep {
  /** Absolute screen coordinates of the spotlight circle */
  spotlight: { cx: number; cy: number; r: number };
  /** Tooltip card content */
  tooltip:   { title: string; body: string; placement: 'above' | 'below' };
  /** Which hand gesture to show */
  hand: HandType;
}

interface CoachMarkProps {
  steps:     CoachStep[];
  storageKey: string;        // AsyncStorage key e.g. "coach_home_v1"
  onDone?:   () => void;
}

// ─── SVG: White Pointer Hand ───────────────────────────────────────────────────
// Classic mouse-cursor-style pointing hand (index finger up, rest curled)
const HAND_PATH =
  'M15.5 2 C13.5 2 11.5 3.8 11.5 6.5 L11.5 20.5 ' +
  'C10 19.5 8.5 19.5 7 20.5 C5.2 21.8 5.2 24.5 7 25.5 ' +
  'L10.5 28 L10.5 37.5 C10.5 41 12.5 44 16 44 L22 44 ' +
  'C25.5 44 27.5 41 27.5 37.5 L27.5 21.5 ' +
  'C27.5 18.5 25.5 16.5 22.5 16.5 L20 16.5 ' +
  'L20 6.5 C20 3.8 18 2 15.5 2 Z';

function WhiteHand({ type }: { type: HandType }) {
  const moveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation;

    if (type === 'tap') {
      // Quick bounce down and up, pause, repeat
      anim = Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(moveAnim, { toValue: 10, duration: 180, useNativeDriver: true }),
          Animated.timing(moveAnim, { toValue: 0,  duration: 180, useNativeDriver: true }),
          Animated.delay(900),
        ])
      );
    } else if (type === 'long-press') {
      // Press down slowly and hold, then release
      anim = Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(moveAnim,  { toValue: 8,   duration: 250,  useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 0.88,duration: 250,  useNativeDriver: true }),
          Animated.delay(1000),
          Animated.parallel([
            Animated.timing(moveAnim,  { toValue: 0, duration: 220, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          ]),
          Animated.delay(600),
        ])
      );
    } else if (type === 'swipe-left') {
      // Slide from right to left
      anim = Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(moveAnim, { toValue: -60, duration: 550, useNativeDriver: true }),
          Animated.timing(moveAnim, { toValue: 0,   duration: 0,   useNativeDriver: true }),
          Animated.delay(700),
        ])
      );
    } else {
      // swipe-right: slide from left to right
      anim = Animated.loop(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(moveAnim, { toValue: 60, duration: 550, useNativeDriver: true }),
          Animated.timing(moveAnim, { toValue: 0,  duration: 0,   useNativeDriver: true }),
          Animated.delay(700),
        ])
      );
    }

    anim.start();
    return () => anim.stop();
  }, [type]);

  const isSwipe = type === 'swipe-left' || type === 'swipe-right';

  const transform: any[] = isSwipe
    ? [{ translateX: moveAnim }, { scale: scaleAnim }]
    : [{ translateY: moveAnim }, { scale: scaleAnim }];

  return (
    <Animated.View style={{ transform }}>
      <Svg width={36} height={50} viewBox="0 0 36 50">
        {/* Drop shadow */}
        <G opacity={0.3} transform="translate(3, 4)">
          <Path d={HAND_PATH} fill={DARK} />
        </G>
        {/* White hand */}
        <Path d={HAND_PATH} fill="white" />
        {/* Subtle outline */}
        <Path d={HAND_PATH} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
      </Svg>
    </Animated.View>
  );
}

// ─── Glow Ring ─────────────────────────────────────────────────────────────────
function GlowRing({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOp    = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.25] });

  return (
    <>
      {/* Outer pulsing ring */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - r - 6,
          top:  cy - r - 6,
          width:  (r + 6) * 2,
          height: (r + 6) * 2,
          borderRadius: r + 6,
          borderWidth: 2.5,
          borderColor: GOLD,
          opacity: glowOp,
          transform: [{ scale: glowScale }],
        }}
      />
      {/* Inner solid ring */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: cx - r,
          top:  cy - r,
          width:  r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 2,
          borderColor: GOLD,
        }}
      />
    </>
  );
}

// ─── Main CoachMark Overlay ────────────────────────────────────────────────────
export default function CoachMark({ steps, storageKey, onDone }: CoachMarkProps) {
  const [visible, setVisible]     = useState(false);
  const [stepIdx, setStepIdx]     = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Check AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then(val => {
      if (val !== 'done') {
        // Small delay so screen renders first
        setTimeout(() => setVisible(true), 800);
      }
    });
  }, [storageKey]);

  // Animate tooltip in when step changes
  useEffect(() => {
    if (!visible) return;
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
    ]).start();
  }, [stepIdx, visible]);

  const next = useCallback(async () => {
    if (stepIdx < steps.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      await finish();
    }
  }, [stepIdx, steps.length]);

  const finish = useCallback(async () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(async () => {
      await AsyncStorage.setItem(storageKey, 'done');
      setVisible(false);
      setStepIdx(0);
      onDone?.();
    });
  }, [storageKey, onDone]);

  if (!visible || steps.length === 0) return null;

  const step = steps[stepIdx];
  const { cx, cy, r } = step.spotlight;
  const isAbove = step.tooltip.placement === 'above';

  // Hand position: near the spotlight
  const handX = cx - 18;
  const handY = step.hand === 'swipe-left' || step.hand === 'swipe-right'
    ? cy - 25
    : cy - r - 50;

  // Tooltip position
  const tooltipTop  = isAbove ? cy - r - 160 : cy + r + 20;
  const tooltipLeft = Math.max(16, Math.min(SW - 280, cx - 120));

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      {/* ── Dark overlay with circular spotlight (SVG Mask) ── */}
      <Svg
        width={SW}
        height={SH}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Mask id="spotlight">
            <Rect width={SW} height={SH} fill="white" />
            <Circle cx={cx} cy={cy} r={r + 4} fill="black" />
          </Mask>
        </Defs>
        <Rect
          width={SW}
          height={SH}
          fill="rgba(0,0,0,0.80)"
          mask="url(#spotlight)"
        />
      </Svg>

      {/* ── Glow ring around spotlight ── */}
      <GlowRing cx={cx} cy={cy} r={r} />

      {/* ── Animated white hand ── */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: handX, top: handY }}
      >
        <WhiteHand type={step.hand} />
      </View>

      {/* ── Skip all button ── */}
      <TouchableOpacity style={cm.skipBtn} onPress={finish} activeOpacity={0.7}>
        <Text style={cm.skipTxt}>Skip all</Text>
      </TouchableOpacity>

      {/* ── Tooltip card ── */}
      <Animated.View
        style={[
          cm.tooltip,
          {
            top:     tooltipTop,
            left:    tooltipLeft,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Caret pointing toward spotlight */}
        {isAbove && (
          <View style={[cm.caret, { bottom: -8, left: 24 }]} />
        )}
        {!isAbove && (
          <View style={[cm.caretUp, { top: -8, left: 24 }]} />
        )}

        <View style={cm.tooltipHeader}>
          <View style={cm.tooltipIconWrap}>
            <Ionicons name="bulb-outline" size={14} color={GOLD} />
          </View>
          <Text style={cm.tooltipTitle}>{step.tooltip.title}</Text>
          {/* Step counter */}
          <Text style={cm.stepCount}>{stepIdx + 1}/{steps.length}</Text>
        </View>

        <Text style={cm.tooltipBody}>{step.tooltip.body}</Text>

        <View style={cm.tooltipRow}>
          {/* Dot indicators */}
          <View style={cm.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[cm.dot, i === stepIdx && cm.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity style={cm.gotItBtn} onPress={next} activeOpacity={0.85}>
            <Text style={cm.gotItTxt}>
              {stepIdx < steps.length - 1 ? 'Got it  →' : 'Done  ✓'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Tap outside to advance */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onPress={next}
        activeOpacity={1}
      />
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const cm = StyleSheet.create({
  skipBtn: {
    position: 'absolute', top: 56, right: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  skipTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  tooltip: {
    position: 'absolute',
    width: 264,
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 16,
    borderWidth: 1, borderColor: 'rgba(168,144,96,0.2)',
    zIndex: 10,
  },
  caret: {
    position: 'absolute',
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  caretUp: {
    position: 'absolute',
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tooltipIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#FBF7EE', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F0E8D5',
  },
  tooltipTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: DARK },
  stepCount:    { fontSize: 11, color: '#AEACA8', fontWeight: '500' },
  tooltipBody:  { fontSize: 13, color: '#787774', lineHeight: 20, marginBottom: 14 },

  tooltipRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots:         { flexDirection: 'row', gap: 5 },
  dot:          { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(26,26,26,0.15)' },
  dotActive:    { width: 14, height: 5, borderRadius: 2.5, backgroundColor: GOLD },

  gotItBtn: {
    backgroundColor: DARK, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  gotItTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
