/** Per-workspace AsyncStorage keys for company + FY (MD §6 / §10). */
export function wsCompanyKey(workspaceId: string | null | undefined): string {
  return workspaceId ? `ws:${workspaceId}:company_data` : 'company_data';
}

export function wsFyKey(workspaceId: string | null | undefined): string {
  return workspaceId ? `ws:${workspaceId}:selected_fy` : 'selected_fy';
}
