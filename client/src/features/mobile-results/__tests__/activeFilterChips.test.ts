import { describe, test, expect } from 'vitest';
import { computeActiveChips, removeChip, chipCount } from '../lib/activeFilterChips';

const empty = { planType:[], carriers:[], premiumRange:[0,500], benefits:[], snpCategories:[] };
const full  = { planType:['HMO','PPO'], carriers:['Humana'], benefits:['dental','vision'], snpCategories:['DSNP'], premiumRange:[0,50] };

describe('computeActiveChips', () => {
  test('empty → no chips', () => expect(computeActiveChips(empty)).toHaveLength(0));
  test('planType chips', () => expect(computeActiveChips({...empty,planType:['HMO','PPO']}).filter(c=>c.filterKey==='planType')).toHaveLength(2));
  test('SNP uses short label', () => {
    const chip = computeActiveChips({...empty,snpCategories:['DSNP']}).find(c=>c.filterKey==='snpCategories');
    expect(chip?.label).toBe('D-SNP');
  });
  test('premium cap chip when < 500', () => expect(computeActiveChips({...empty,premiumRange:[0,50]}).some(c=>c.filterKey==='premiumRange')).toBe(true));
  test('no premium chip at default', () => expect(computeActiveChips(empty).some(c=>c.filterKey==='premiumRange')).toBe(false));
  test('all IDs unique', () => { const chips = computeActiveChips(full); expect(new Set(chips.map(c=>c.id)).size).toBe(chips.length); });
  test('long carrier truncated', () => {
    const chip = computeActiveChips({...empty,carriers:['UnitedHealthcareLongName']}).find(c=>c.filterKey==='carriers')!;
    expect(chip.label).toContain('…');
  });
});

describe('removeChip', () => {
  test('removes planType', () => {
    const f = {...empty, planType:['HMO','PPO']};
    const chip = computeActiveChips(f).find(c=>c.value==='HMO')!;
    expect(removeChip(f,chip).planType).not.toContain('HMO');
  });
  test('does not mutate original', () => {
    const f = {...empty, planType:['HMO']};
    const chip = computeActiveChips(f)[0];
    removeChip(f, chip);
    expect(f.planType).toContain('HMO');
  });
  test('round-trip removes all', () => {
    let f = {...full};
    let chips = computeActiveChips(f);
    while (chips.length > 0) { f = removeChip(f, chips[0]); chips = computeActiveChips(f); }
    expect(chipCount(f)).toBe(0);
  });
});
