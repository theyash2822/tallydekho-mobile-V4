import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

// ─── Constants ────────────────────────────────────────────────────────────────
const TRACK_W  = 44;
const TRACK_H  = 26;
const THUMB    = 22;
const INSET    = 2;

// ─── Props ────────────────────────────────────────────────────────────────────
interface BrandSwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BrandSwitch({ value, onValueChange, disabled = false }: BrandSwitchProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value]);

  // Track color: brand beige (off) → brand black (on)
  const trackBg = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [COLORS.borderDefault, COLORS.brandPrimary],
  });

  // Thumb position: left inset (off) → right inset (on)
  const thumbX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [INSET, TRACK_W - THUMB - INSET],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={{ opacity: disabled ? 0.4 : 1 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View style={[bs.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[bs.thumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  track: {
    width:        TRACK_W,
    height:       TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  thumb: {
    position:     'absolute',
    width:        THUMB,
    height:       THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: COLORS.white,
    // subtle shadow so thumb lifts above track
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius:  2,
    elevation:     2,
  },
});
