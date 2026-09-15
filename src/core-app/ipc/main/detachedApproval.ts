export interface DetachedApproval {
  id: string;
  command: string;
  method: string;
  path: string;
  body: unknown;
}

const detached = new Map<string, DetachedApproval>();

export const DETACH_REASON = 'downlodr:detach-prompt';

export function registerDetachedApproval(record: DetachedApproval): void {
  detached.set(record.id, record);
}

export function takeDetachedApproval(id: string): DetachedApproval | null {
  const record = detached.get(id) ?? null;
  if (record) detached.delete(id);
  return record;
}

export function peekDetachedApproval(id: string): DetachedApproval | null {
  return detached.get(id) ?? null;
}

export function dropDetachedApproval(id: string): void {
  detached.delete(id);
}

export function detachedApprovalCount(): number {
  return detached.size;
}

export function clearDetachedApprovals(): void {
  detached.clear();
}

export function describeDetachedWait(command: string): string {
  return (
    `"${command}" has not been answered yet, so this call stopped waiting. The ` +
    `confirmation card is still open and the user can answer it whenever they ` +
    `like — approving it runs the command and picks this work back up. Do not ` +
    `re-issue the command and do not raise another card: tell the user the card ` +
    `is waiting for them, then stop.`
  );
}
