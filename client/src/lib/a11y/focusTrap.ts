// client/src/lib/a11y/focusTrap.ts
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

export function nextFocusIdx(current: number, total: number, direction: 'forward' | 'backward'): number {
  if (total === 0) return 0;
  if (direction === 'forward') return (current + 1) % total;
  return (current - 1 + total) % total;
}

export function shouldTrap(currentIdx: number, total: number, shiftKey: boolean): boolean {
  if (total <= 1) return false;
  if (shiftKey && currentIdx === 0) return true;
  if (!shiftKey && currentIdx === total - 1) return true;
  return false;
}

export function starRatingLabel(rating: number, outOf = 5, suffix?: string): string {
  const rounded = Math.round(rating * 10) / 10;
  const base = `${rounded} out of ${outOf} stars`;
  return suffix ? `${base} — ${suffix}` : base;
}

export function inputAriaProps(opts: {
  id: string;
  errorId?: string;
  hasError: boolean;
  label: string;
}): {
  id: string;
  'aria-label': string;
  'aria-invalid': boolean | 'true' | 'false';
  'aria-describedby': string | undefined;
} {
  return {
    id: opts.id,
    'aria-label': opts.label,
    'aria-invalid': opts.hasError,
    'aria-describedby': opts.hasError && opts.errorId ? opts.errorId : undefined,
  };
}
