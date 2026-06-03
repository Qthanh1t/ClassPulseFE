/**
 * Central design tokens — single source of truth for the warm-neutral palette
 * with one desaturated ink-indigo accent. Mirrors the CSS variables in index.css
 * so inline styles (used throughout the codebase) can reference real values
 * instead of hardcoded hex. Change the accent here + in index.css to re-theme.
 */
export const color = {
  // Accent (single)
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  primaryLight: '#eceafd',

  // Warm-neutral surfaces
  bg: '#f7f6f3',
  surface: '#ffffff',
  surface2: '#f3f1ec',
  border: '#e7e3dc',
  borderStrong: '#d8d3c9',

  // Warm text ramp
  text: '#1c1917',
  textSecondary: '#57534e',
  textMuted: '#a8a29e',

  // Semantic
  emerald: '#0ea672',
  emeraldLight: '#e7f6ef',
  amber: '#e08c0b',
  amberLight: '#fbf0db',
  rose: '#e23d6d',
  roseLight: '#fceaef',
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(28,25,23,0.05)',
  md: '0 1px 2px rgba(28,25,23,0.05), 0 8px 24px rgba(79,70,229,0.06)',
  lg: '0 4px 12px rgba(28,25,23,0.06), 0 16px 40px rgba(79,70,229,0.09)',
} as const;

export const radius = {
  page: 16,
  card: 14,
  control: 8,
  tag: 6,
  pill: 999,
} as const;

export const mono =
  "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

/**
 * Returns horizontal/vertical page padding tuned per breakpoint.
 * Bottom padding is intentionally a touch larger (optical balance).
 */
export function pagePadding(isMobile: boolean, isTablet: boolean): string {
  if (isMobile) return '16px 16px 28px';
  if (isTablet) return '24px 24px 40px';
  return '28px 32px 48px';
}
