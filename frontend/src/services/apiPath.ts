/**
 * Path-segment encoding for API URLs (SEC-033).
 *
 * Ids that reach `api.ts` can come from deep links (`auditor://ledger/<id>`,
 * `?id=`), so every value interpolated into a path must be percent-encoded —
 * otherwise `../` or `?` in an id rewrites the request. Pure module, node-testable.
 */
export function seg(value: string | number | null | undefined): string {
  // `String(undefined)` on purpose: a missing id keeps hitting `/x/undefined` (404)
  // as before, rather than collapsing to the collection route `/x/`.
  return encodeURIComponent(String(value));
}
