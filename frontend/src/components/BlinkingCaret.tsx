import React, { useEffect, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

/** Caret for code boxes (OTP / PIN): shown alone in the empty focused box so its parent centres it; blinks like the system caret. */
export function BlinkingCaret({ style }: { style?: StyleProp<ViewStyle> }) {
  // Lazy useState (not useRef.current) so the React Compiler lint allows reading it during render.
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 1, duration: 1, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
}
