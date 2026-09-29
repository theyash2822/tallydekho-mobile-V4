/**
 * June 11 (ab4df78f) spatial hit-test for expo-camera barcode bounds.
 *
 * ExpoCameraView.kt / AVFoundation: when the preview is sized, bounds are in
 * **screen/window dp** (same unit as measureInWindow).
 *
 * iOS printed labels often report a centre slightly outside the thin UI strip
 * even when the user aims at the brackets. We inflate the **hit rect only on
 * iOS** (UI brackets unchanged). Android keeps a tight match to the overlay.
 *
 * Invalid / zero bounds → 'unknown' for June dedup fallback.
 */

import { Platform } from 'react-native';

export type Rect = { x: number; y: number; width: number; height: number };

export type BarcodeBoundsLike = {
  origin: { x: number; y: number };
  size: { width: number; height: number };
};

export type FrameHit = 'inside' | 'outside' | 'unknown';

/**
 * Invisible hit-zone inflate around the measured UI frame (iOS only).
 * UI brackets stay Jun 11 / standard sizes; only acceptance grows.
 * Printed CODE128 centres often sit well outside the thin 130 strip.
 */
export const IOS_HIT_INFLATE = { top: 110, bottom: 110, left: 36, right: 36 };

function hitFrameForPlatform(frame: Rect): Rect {
  if (Platform.OS !== 'ios') return frame;
  const i = IOS_HIT_INFLATE;
  return {
    x: frame.x - i.left,
    y: frame.y - i.top,
    width: frame.width + i.left + i.right,
    height: frame.height + i.top + i.bottom,
  };
}

/**
 * @param padding extra dp tolerance around the (possibly inflated) hit frame
 */
export function barcodeCenterInFrame(opts: {
  bounds?: BarcodeBoundsLike | null;
  frame: Rect | null;
  padding?: number;
}): FrameHit {
  const { bounds, frame, padding } = opts;
  // iOS: a bit more jitter tolerance on top of the inflated hit rect
  const pad = padding ?? (Platform.OS === 'ios' ? 16 : 8);
  if (!bounds || !frame) return 'unknown';
  // June guard: size must be ≥1dp (un-transformed / zero frames)
  if (bounds.size.width < 1 || bounds.size.height < 1) return 'unknown';

  const hit = hitFrameForPlatform(frame);
  const cx = bounds.origin.x + bounds.size.width / 2;
  const cy = bounds.origin.y + bounds.size.height / 2;
  const inside =
    cx >= hit.x - pad
    && cx <= hit.x + hit.width + pad
    && cy >= hit.y - pad
    && cy <= hit.y + hit.height + pad;

  return inside ? 'inside' : 'outside';
}
