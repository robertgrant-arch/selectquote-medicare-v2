import { describe, test, expect } from 'vitest';
import { toggleSection, isExpanded, collapseAll, expandAll, SECTION_LABELS } from '../lib/cardExpansionState';
import { isMobileWidth } from '../lib/useIsMobile';
describe('collapseAll/expandAll', () => {
  test('collapseAll → empty', () => expect(collapseAll().size).toBe(0));
  test('expandAll → 3', () => { const s = expandAll(); expect(isExpanded(s,'copays')).toBe(true); expect(isExpanded(s,'drugs')).toBe(true); expect(isExpanded(s,'benefits')).toBe(true); });
});
describe('toggleSection', () => {
  test('toggle closed → open', () => expect(isExpanded(toggleSection(collapseAll(),'copays'),'copays')).toBe(true));
  test('toggle open → closed', () => expect(isExpanded(toggleSection(expandAll(),'copays'),'copays')).toBe(false));
  test('does not mutate', () => { const o = expandAll(); toggleSection(o,'copays'); expect(isExpanded(o,'copays')).toBe(true); });
  test('double toggle = original', () => expect(isExpanded(toggleSection(toggleSection(collapseAll(),'drugs'),'drugs'),'drugs')).toBe(false));
  test('independent sections', () => { const s = toggleSection(collapseAll(),'benefits'); expect(isExpanded(s,'benefits')).toBe(true); expect(isExpanded(s,'copays')).toBe(false); });
});
describe('SECTION_LABELS', () => { test('all 3 have labels', () => { expect(SECTION_LABELS.copays.length).toBeGreaterThan(0); expect(SECTION_LABELS.drugs.length).toBeGreaterThan(0); expect(SECTION_LABELS.benefits.length).toBeGreaterThan(0); }); });
describe('isMobileWidth', () => {
  test('375 → mobile', () => expect(isMobileWidth(375)).toBe(true));
  test('767 → mobile', () => expect(isMobileWidth(767)).toBe(true));
  test('768 → not mobile', () => expect(isMobileWidth(768)).toBe(false));
  test('1440 → not mobile', () => expect(isMobileWidth(1440)).toBe(false));
});
