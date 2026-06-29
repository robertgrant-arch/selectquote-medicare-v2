import { useEffect, useRef, useCallback } from 'react';
import { FOCUSABLE_SELECTOR, nextFocusIdx } from './focusTrap';

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  onEscape: () => void,
): React.RefObject<T | null> {
  const containerRef = useRef<T>(null);

  const getFocusables = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.closest('[aria-hidden="true"]'));
  }, []);

  useEffect(() => {
    if (!active) return;
    const focusables = getFocusables();
    if (focusables.length > 0) {
      setTimeout(() => focusables[0].focus(), 20);
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onEscape(); return; }
      if (e.key !== 'Tab') return;
      const focusables = getFocusables();
      if (focusables.length === 0) return;
      const currentIdx = focusables.indexOf(document.activeElement as HTMLElement);
      const direction = e.shiftKey ? 'backward' : 'forward';
      const atStart = currentIdx <= 0;
      const atEnd = currentIdx >= focusables.length - 1;
      if ((direction === 'backward' && atStart) || (direction === 'forward' && atEnd)) {
        e.preventDefault();
        const next = nextFocusIdx(currentIdx === -1 ? 0 : currentIdx, focusables.length, direction);
        focusables[next].focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [active, onEscape, getFocusables]);

  return containerRef;
}
