let _gen = 0;
let _id: string | null = null;

export function setWorkspaceGeneration(id: string | null): number {
  const next = id ? String(id) : null;
  if (_id !== next) {
    _gen += 1;
    _id = next;
  }
  return _gen;
}

export function getWorkspaceGeneration(): number {
  return _gen;
}

export function isCurrentWorkspaceGeneration(gen: number, workspaceId: string | null): boolean {
  const id = workspaceId ? String(workspaceId) : null;
  return _gen === gen && _id === id;
}

export function captureWorkspaceGeneration(): { gen: number; workspaceId: string | null } {
  return { gen: _gen, workspaceId: _id };
}
