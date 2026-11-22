import { useSyncExternalStore } from 'react';

export const SCARY_TITLE = 'Scary Money Manager';
export const HAPPY_TITLE = 'My Money Manager';

/** "My Money Manager" while net worth is above zero, otherwise (or before the books are open) the scary name. */
export function appTitle(netWorth: number | null): string {
  return netWorth !== null && netWorth > 0 ? HAPPY_TITLE : SCARY_TITLE;
}

// A tiny shared value so the header (outside App) shows the title App works out from the books.
let current = SCARY_TITLE;
const listeners = new Set<() => void>();

export function setAppTitle(title: string) {
  if (title === current) return;
  current = title;
  document.title = title;
  listeners.forEach((l) => l());
}

export function useAppTitle(): string {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}
