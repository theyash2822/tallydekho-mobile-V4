
## [2026-06-06] QA Testing Agent — movement-analytics.tsx

### Bugs Fixed (QA inline)
- Removed unused `useRef` import (chartScrollRef was deleted but import remained)
- Removed unused `Dimensions` import (SW constant was deleted but import remained)
- Fixed `flex: 1` on tap-overlay TouchableOpacity (conflicted with `width: DAY_W` — Yoga would distribute space evenly instead of fixed 44px per column)

### Verified Clean
- TypeScript: `npx tsc --noEmit --skipLibCheck` → EXIT:0
- Y-axis Svg correctly pinned outside ScrollView
- Scrollable Svg + tap overlay correctly inside ScrollView
- Search filters `filtered` array, clears with X
- Auto-select first item on load
- tr=0 items show '—' not '0.0x'
