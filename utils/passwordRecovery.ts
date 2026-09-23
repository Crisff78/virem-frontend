// Recovery credentials stay in memory: never URL params, logs or local storage.
let recovery: { email: string; ticket: string; expiresAt: number } | null = null;

export function saveRecoveryTicket(email: string, ticket: string): void {
  recovery = {
    email: email.trim().toLowerCase(),
    ticket,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

export function getRecoveryTicket(email: string): string | null {
  if (recovery && recovery.expiresAt <= Date.now()) recovery = null;
  return recovery?.email === email.trim().toLowerCase() ? recovery.ticket : null;
}

export function clearRecoveryTicket(): void {
  recovery = null;
}
