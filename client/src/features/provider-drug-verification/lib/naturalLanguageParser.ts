export interface ParsedEntry { id: string; kind: 'doctor'|'drug'; rawText: string; parsedName: string; parsedDetail: string; confidence: 'high'|'medium'|'low'; }
export interface NLParseResult { entries: ParsedEntry[]; unrecognized: string[]; }

export const KNOWN_DRUGS = new Set(['lisinopril','losartan','amlodipine','metoprolol','carvedilol','hydrochlorothiazide','furosemide','atorvastatin','simvastatin','rosuvastatin','warfarin','clopidogrel','aspirin','metformin','glipizide','levothyroxine','omeprazole','pantoprazole','sertraline','escitalopram','fluoxetine','gabapentin','pregabalin','tramadol','hydrocodone','acetaminophen','ibuprofen','naproxen','celecoxib','albuterol','tiotropium','fluticasone','montelukast','insulin','glargine','ozempic','semaglutide','jardiance','empagliflozin','eliquis','apixaban','xarelto','rivaroxaban','humira','adalimumab','quetiapine','risperidone','olanzapine','clonazepam','lorazepam','alprazolam','zolpidem','trazodone','bupropion','venlafaxine','duloxetine','mirtazapine','atenolol','propranolol','diltiazem','nifedipine','ramipril','enalapril']);

const DOSAGE_RE = /\b(\d+\.?\d*\s*(?:mg|mcg|ml|units?|iu))\b/i;
const SPECIALTY_WORDS = ['cardiologist','neurologist','oncologist','dermatologist','endocrinologist','urologist','ophthalmologist','gastroenterologist','rheumatologist','pulmonologist','nephrologist','psychiatrist','orthopedist','podiatrist'];
let _seq = 0;
const nextId = () => `pe-${++_seq}`;

function extractDrugs(text: string): ParsedEntry[] {
  const res: ParsedEntry[] = []; const seen = new Set<string>();
  const lower = text.toLowerCase();
  for (const token of lower.split(/[\s,;.]+/)) {
    const clean = token.replace(/[^a-z0-9]/g,'');
    if (clean.length < 4 || seen.has(clean)) continue;
    if (KNOWN_DRUGS.has(clean)) {
      seen.add(clean);
      const dm = DOSAGE_RE.exec(text.slice(lower.indexOf(clean)));
      res.push({ id:nextId(), kind:'drug', rawText:clean, parsedName:clean.charAt(0).toUpperCase()+clean.slice(1), parsedDetail:dm?dm[1]:'', confidence:'high' });
    } else if (clean.length >= 6) {
      const m = [...KNOWN_DRUGS].find(d => d.startsWith(clean.slice(0,6)));
      if (m && !seen.has(m)) { seen.add(m); const dm = DOSAGE_RE.exec(text.slice(lower.indexOf(clean))); res.push({ id:nextId(), kind:'drug', rawText:clean, parsedName:m.charAt(0).toUpperCase()+m.slice(1), parsedDetail:dm?dm[1]:'', confidence:'medium' }); }
    }
  }
  return res;
}

function extractDoctors(text: string): ParsedEntry[] {
  const res: ParsedEntry[] = []; const seen = new Set<string>();
  const specMatch = SPECIALTY_WORDS.find(s => text.toLowerCase().includes(s)) ?? '';
  const re = /\bdr\.?\s+([a-z]+(?:\s+[a-z]+)?)/gi; let m: RegExpExecArray|null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].replace(/\b\w/g,c=>c.toUpperCase()).trim();
    if (!seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); res.push({ id:nextId(), kind:'doctor', rawText:m[0], parsedName:`Dr. ${name}`, parsedDetail:specMatch, confidence:'high' }); }
  }
  return res;
}

export function parseNaturalLanguage(text: string): NLParseResult {
  if (!text || text.trim().length < 3) return { entries:[], unrecognized:[] };
  const drugs = extractDrugs(text); const doctors = extractDoctors(text);
  const entries = [...doctors, ...drugs];
  const used = new Set(entries.map(e => e.rawText.toLowerCase()));
  const unrecognized = text.split(/[\s,;.]+/).filter(t => t.length > 4 && !used.has(t.toLowerCase()) && !/^(and|the|my|for|with|take|taking|i|a|an|to|from|of|or|dr\.?)$/i.test(t));
  return { entries, unrecognized };
}
export function hasParseableContent(text: string): boolean { if (!text || text.trim().length<3) return false; return parseNaturalLanguage(text).entries.length > 0; }
export function looksLikeDrugText(text: string): boolean { return /\b(?:i take|taking|prescribed|on|using)\b/i.test(text) || extractDrugs(text).length>0; }
export function looksLikeDoctorText(text: string): boolean { return /\bdr\.?\b/i.test(text) || SPECIALTY_WORDS.some(s=>text.toLowerCase().includes(s)); }
