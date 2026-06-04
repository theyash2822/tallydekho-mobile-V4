# MOBILE_MAP.md — tallydekho-mobile-V4

## app/ (Expo Router screens)
All files here are screens. See NAVIGATION_MAP.md for full screen list.

## src/ (Shared source)

### src/services/
| File | Purpose |
|------|---------|
| api.ts | All HTTP calls (3500+ lines). Base: /api/*. No mock data. |
| socketService.ts | Socket.io client — sync events |
| pushNotifications.ts | Expo push notification registration + handlers |

### src/context/
| File | Purpose |
|------|---------|
| AuthContext.tsx | Auth state, token, company, FY, isPaired. fyInfoToParam() helper |
| SettingsContext.tsx | Currency, language, app preferences |

### src/hooks/
| File | Purpose |
|------|---------|
| useApiData.ts | Generic API fetch hook with loading/error/empty states |

### src/components/
| File | Purpose |
|------|---------|
| ApiStateViews.tsx | LoadingView, ErrorView, EmptyView — use on every screen |
| Header.tsx | Top header with company + FY switcher |
| FilterBottomSheet.tsx | Bottom sheet filter panel |
| DateRangePickerModal.tsx | Date range picker modal |
| QuickActionsModal.tsx | FAB quick actions |
| PairingBanner.tsx | "Not paired" banner |
| OfflineBadge.tsx | Offline state badge |
| CashflowCard.tsx | Dashboard cashflow chart |
| RecentActivity.tsx | Dashboard recent transactions |
| ShimmerPlaceholder.tsx | Shimmer loading animation |
| Skeleton.tsx | Skeleton placeholder |
| document/ | Document viewer components |
| forms/ | Reusable form input components |

### src/constants/
| File | Purpose |
|------|---------|
| colors.ts | App color palette — cream theme (#F5F4EF base) |

### src/data/ (MOCK DATA — do NOT use for live display)
| File | Notes |
|------|-------|
| mockData.ts | Legacy mock — do not use after pairing |
| mockDocuments.ts | Legacy mock documents |
| stockData.ts | May still be used in some stock screens — audit needed |

### src/types/
| File | Purpose |
|------|---------|
| document.ts | Document/voucher type definitions |

### src/utils/
| File | Purpose |
|------|---------|
| format.ts | Number/currency/date formatters |
| documentHelpers.ts | Document sharing/PDF helpers |
| toastConfig.tsx | Toast notification configuration |

### src/i18n/
| File | Purpose |
|------|---------|
| index.ts | i18n setup (i18next) |
| locales/ | Language JSON files |

## Root Config Files
| File | Purpose |
|------|---------|
| app.json | Expo app config (name, bundle ID, icons) |
| metro.config.js | Metro bundler config |
| tsconfig.json | TypeScript config |
| expo-env.d.ts | Expo type declarations |

## Ignored Directories (never scan)
- node_modules/
- android/build/
- ios/Pods/
- .metro-cache/
- .expo/cache/
- dist/
- assets/ (images/fonts only)
