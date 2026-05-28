import { describe, test, expect } from 'vitest';
import { parseNaturalLanguage, looksLikeDrugText, looksLikeDoctorText, hasParseableContent, KNOWN_DRUGS } from '../lib/naturalLanguageParser';

describe('parseNaturalLanguage — drugs', () => {
  test('known drug → entry', () => expect(parseNaturalLanguage('I take lisinopril').entries.some(e=>e.kind==='drug'&&e.parsedName.toLowerCase().includes('lisinopril'))).toBe(true));
  test('drug + dosage → detail captured', () => { const e = parseNaturalLanguage('lisinopril 10mg').entries.find(e=>e.kind==='drug')!; expect(e.parsedDetail).toMatch(/10\s*mg/i); });
  test('multiple drugs', () => expect(parseNaturalLanguage('I take lisinopril and metoprolol').entries.filter(e=>e.kind==='drug').length).toBeGreaterThanOrEqual(2));
  test('no duplicate entries', () => { const d = parseNaturalLanguage('lisinopril lisinopril').entries.filter(e=>e.parsedName.toLowerCase().includes('lisinopril')); expect(d.length).toBe(1); });
  test('unknown drug → no entry', () => expect(parseNaturalLanguage('I take Zfluxanamine50mg').entries.filter(e=>e.kind==='drug')).toHaveLength(0));
  test('empty → no entries', () => expect(parseNaturalLanguage('').entries).toHaveLength(0));
});

describe('parseNaturalLanguage — doctors', () => {
  test('"Dr. Smith" → doctor entry', () => { const d = parseNaturalLanguage('I see Dr. Smith').entries.find(e=>e.kind==='doctor'); expect(d?.parsedName).toContain('Smith'); });
  test('specialty extracted', () => { const d = parseNaturalLanguage('Dr. Johnson is my cardiologist').entries.find(e=>e.kind==='doctor'); expect(d?.parsedDetail.toLowerCase()).toMatch(/cardiol/); });
  test('no Dr prefix → no entry', () => expect(parseNaturalLanguage('hello world foo bar').entries.filter(e=>e.kind==='doctor')).toHaveLength(0));
});

describe('predicates', () => {
  test('looksLikeDrugText drug text', () => expect(looksLikeDrugText('I take metoprolol')).toBe(true));
  test('looksLikeDoctorText dr text', () => expect(looksLikeDoctorText('Dr. Smith')).toBe(true));
  test('hasParseableContent known drug', () => expect(hasParseableContent('lisinopril')).toBe(true));
  test('hasParseableContent empty → false', () => expect(hasParseableContent('')).toBe(false));
});

describe('KNOWN_DRUGS', () => {
  test('size >= 50', () => expect(KNOWN_DRUGS.size).toBeGreaterThanOrEqual(50));
  test('all lowercase', () => [...KNOWN_DRUGS].forEach(d => expect(d).toBe(d.toLowerCase())));
  test('contains common drugs', () => ['lisinopril','metformin','atorvastatin','levothyroxine','warfarin'].forEach(d => expect(KNOWN_DRUGS.has(d)).toBe(true)));
});
