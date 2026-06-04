# AGENTS.md — tallydekho-mobile-V4 (Mobile App)

## Repo Boundary
You are working ONLY inside `/tallydekho-mobile-V4/frontend`.
Do NOT read or modify: td-backend, td-web-portal, td-source/desktop, td-website.

## First Steps (Every Session)
1. Read this file
2. Read BLUEPRINT.md
3. Read NAVIGATION_MAP.md
4. Read only the source files listed for your task

## Full Scan Rule
Full codebase scan is FORBIDDEN by default.
Only allowed when user explicitly says: **DO FULL CODEBASE REVIEW**

## Before Touching Code
- Read BLUEPRINT.md + TASK_ROUTING.md first
- Never scan android/build/, ios/Pods/, node_modules/, .metro-cache/, dist/
- Identify exact screen/component for the task

## Coding Rules
- Make the smallest production-safe patch
- Do not refactor unrelated code
- Do not rename files or change navigation structure
- STRICT: No mock/fallback data after pairing — throw errors, callers handle empty/error states
- All API calls go through `src/services/api.ts`
- All data fetching uses `src/hooks/useApiData.ts`
- Use `fyInfoToParam(fy)` to convert FY to backend format (e.g. "2025-2026")
- Always add ErrorBanner + proper loading/empty states
- All modals: `animationType="slide"`, `justifyContent:'flex-end'`, KAV wraps only sheet
- Do not expose secrets (.env, tokens)

## After Every Change
- Update CHANGELOG_AGENT.md
- Update API_USAGE.md if a new endpoint is called
- Update NAVIGATION_MAP.md if a new screen is added

## Output Format
Return:
1. Files changed
2. What changed and why
3. How to test
4. Risks / follow-up
