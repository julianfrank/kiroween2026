import { useEffect } from 'react';
import type { Rupees } from '../money/money';

/** The three looks of the app, chosen only by net worth (ADR: theme follows Net Worth State). */
export type NetWorthState = 'light' | 'twilight' | 'dark';

/** Twilight covers net worth within this share of total assets, on either side of zero. */
export const TWILIGHT_BAND = 0.05;

/**
 * Light when net worth is clearly positive, Dark when clearly negative, Twilight when it is within
 * ±5% of total assets of zero. There is no hysteresis: the state is a pure function of the two numbers.
 */
export function netWorthState(netWorth: Rupees, totalAssets: Rupees): NetWorthState {
  const band = Math.max(0, totalAssets) * TWILIGHT_BAND;
  if (Math.abs(netWorth) <= band) return 'twilight';
  return netWorth > 0 ? 'light' : 'dark';
}

export const STATE_TEXT: Record<NetWorthState, { title: string; line: string }> = {
  light: { title: 'In the black', line: 'Net worth is comfortably positive.' },
  twilight: { title: 'Dusk', line: 'Net worth is close to zero.' },
  dark: { title: 'Lights out', line: 'Net worth is below zero.' },
};

/** Sets the theme on the page. The change is immediate: there is no transition. */
export function useTheme(state: NetWorthState) {
  useEffect(() => {
    document.documentElement.dataset.theme = state;
  }, [state]);
}
