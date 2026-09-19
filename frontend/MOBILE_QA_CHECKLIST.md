# Mobile QA checklist — 2026-09-19

Physical Android / Expo device. Automated tests cannot prove native touch.

## Company switcher (keep `/switch-company` FlatList)

- Open Company switcher repeatedly
- Close repeatedly
- Switch companies rapidly
- No freeze, no stuck spinner, no duplicate push

## FY selector (Header overlay — not RN Modal)

- Open FY selector repeatedly
- Close repeatedly
- Switch FY rapidly
- Switch company → FY → company → FY
- No frozen touch, no stuck spinner
- Visual chrome unchanged (pill, rows, colors, type)

## ABC / XYZ

User U:

- Workspace ABC = UNPAIRED → canonical Demo, private simulated entries, no XYZ data
- Workspace XYZ = PAIRED → real companies, real reports, no Demo
- Close Desktop → XYZ stays real/paired-offline. **No Demo fallback.**

## Demo Traders

Legitimate real Tally company named `Demo Traders` with `is_demo=false` must stay real. Name must not classify it.

## Logout isolation

User A creates an unfinished invoice draft, logs out. User B logs in on the same device.

Expected: no A draft, company, FY, logo cache, report data, or ledger cache.

Online logout: User A server session revoked (`POST /api/auth/logout`).

## Session

- Stay logged in >20 minutes
- Trigger 5 concurrent requests after access expiry → one refresh, all recover
- Force 403 → message, no logout
- Force 401 + refresh rejected → controlled logout

## Stock HSN

Create from full create screen and Add Item modal. Enter HSN + GST rate. Both persist after refresh.

## Private Demo entry

In canonical Demo: create goes to `/api/demo/entries`, not voucher writeback / write_queue / Tally.
