# Device test script — Camera diagnostic (C2 → Sales → Stocks)

**Do not change code during this test.** Reload Expo once, then run in order.

## Setup
1. Expo Go connected to Metro on **8081** only (`exp://192.168.29.243:8081`).
2. Reload the app (shake → Reload).
3. Agent is collecting `[CameraDiag]` via `http://192.168.29.243:8099` → `/tmp/camera-diag-capture.log`.

## Test order

### 1) Bare camera (FIRST)
1. Open **Stocks → Barcode**.
2. Tap the blue button **“Camera diagnostic”** (dev only, under the header).
3. Allow camera if asked.
4. Answer: **Do you see moving live video?** YES / NO  
5. Leave open ~5 seconds, then Close.

### 2) Sales product scanner
1. Open **Sales → Create Invoice** (or Order) → product barcode scan.
2. Answer: **moving live video?** YES / NO  
3. Back out.

### 3) Stocks Jun 11 scanner
1. Stocks → Barcode → header **scan** icon (not the diagnostic button).
2. Answer: **moving live video?** YES / NO (Jun 11 strip chrome expected).

## Reply format
```
PROBE: YES/NO
SALES: YES/NO
STOCKS: YES/NO
```
Plus any Metro lines with `[CameraDiag]` if the collector missed them.
