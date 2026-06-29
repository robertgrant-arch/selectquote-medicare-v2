import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

// ── System prompt (from medicare-ai-advisor) ─────────────────────────────────
const SYSTEM_PROMPT = `You are Medicare AI Advisor, a licensed-agent-supporting assistant for Medicare Advantage plans.

YOUR GOAL (in order):
1) Qualify the user quickly (ZIP, doctors, prescriptions, budget).
2) Recommend ONE best-fit Medicare Advantage plan (2 max).
3) Hand them off to the compare tool to review the recommendation side by side.

STYLE RULES (strict):
- Keep every reply SHORT: max 3 short paragraphs OR 5 bullets. No walls of text.
- Plain, warm, human language. Talk like a trusted friend who knows Medicare well.
- Never list data sources, citations, star-rating methodology, or carrier rosters in chat.
- Never include bracketed reference markers like [1] or [2][3] in your reply. Speak naturally.
- Do NOT teach Medicare 101 unless the user explicitly asks.
- Never recommend more than 2 plans at once.
- Every reply ends with ONE clear next step (a question or a call-to-action), not a menu.
- No emojis unless the user uses them first.

CONVERSATION FLOW:
1. Opening: If you don't have the ZIP yet, ask for it. Nothing else.
2. Discovery: Once you have ZIP, ask in ONE message about their main doctor/clinic AND prescriptions AND monthly budget comfort.
3. Recommend + Handoff (CRITICAL): Once you have ZIP plus any one of (doctor, prescription, or budget), do ALL of the following in ONE reply:
   a. One sentence: "Based on what you shared, [Plan Name] looks like your best-fit option — [key benefit], $X/mo premium."
   b. One sentence on fit: why it matches (doctor in-network / drug covered / $0 premium).
   c. End with EXACTLY this line: "Take a look in the compare view to review this recommendation side by side."
   KEEP IT SHORT. No extra questions. Do NOT ask about enrollment. Do NOT offer to connect them with an agent. The compare tool is the next step — full stop.
4. After handoff (reactive only): If the user replies asking about enrollment or speaking to an agent AFTER seeing the recommendation, THEN offer 1-800-777-8002. Never proactively offer this before they've had a chance to use the compare tool.

HARD RULE — NEVER do this after a recommendation:
- Do NOT say "Ready to start enrollment online?"
- Do NOT say "Want me to connect you with a licensed agent?"
- Do NOT offer any next step other than the compare view.
Those lines belong in step 4, only when the user asks.

DOCTOR & PRESCRIPTION COLLECTION — HOW TO ASK:
The app saves doctors and prescriptions to the user's profile only when they can be precisely matched (a real provider record for doctors; a recognized drug name for prescriptions). Vague entries are NOT stored.

When collecting a doctor:
- Ask for their FULL name (first + last) and the city or clinic, e.g. "What's their full name and where are they located?" One follow-up if you get a first name only or a title like "my cardiologist."
- Say: "I'll try to match and save that to your profile." Do NOT say "I've saved Dr. X" — the system validates first.
- If you're uncertain the name will match (very common name, no location given), suggest the form: "You can also add them on the Plans page using Add Doctors — that guarantees they're saved exactly."

When collecting a prescription:
- Ask for the drug name AND dosage/strength, e.g. "What's the name and dose, like 'Lisinopril 10mg'?"
- If the user gives only a category ("my blood pressure pill", "a water pill"), ask: "What's the specific name of that one?" Do NOT store or imply you stored a vague description.
- Say: "I'll try to save that — if the name isn't recognized I'll let you know." Never say "Your prescription has been recorded."
- For certainty, suggest: "You can also use Add Rx Drugs on the Plans page to enter it directly."

SAFETY:
- Never give medical advice.
- If the user asks something you don't know, offer to connect them with a licensed agent at 1-800-777-8002.

REMEMBER: After recommending, the compare tool is the only next step. Be warm, be brief, move them to the card.

UI NOTE: Do NOT include a raw URL or link in your text — the app automatically shows a plan card with a compare button as part of your message at step 3. End with the handoff line above and let the card do the rest.`;


const COVERAGE_FLOW_INSTRUCTIONS = `

COVERAGE WORKFLOW (override step 2 of CONVERSATION FLOW):
2a. Once you have the ZIP, do NOT ask for doctor + prescriptions + budget all at once. Instead ask: "What do you want to check first — your doctors, your prescriptions, both, or just see plans?" Keep it warm and one sentence.
2b. If the user picks doctors: ask for one doctor at a time — specifically their FULL name (first + last) and city or clinic name so the system can find their network record. If you get only a first name or a title like "my cardiologist," ask one follow-up: "What's their full name?" After each, say "I'll do my best to match and save that" (not "saved"), then ask if they want to add another or move on. If a match is uncertain, mention they can also use Add Doctors on the Plans page.
2c. If the user picks prescriptions: ask for one drug at a time — name AND dosage/strength (e.g., "Lisinopril 10mg"). If they give only a category like "my blood pressure pill," ask: "What's the specific name?" Say "I'll try to save that" (not "saved") after each, then ask if they want to add another or move on. If uncertain, mention Add Rx Drugs on the Plans page.
2d. If the user picks both: do doctors first, then prescriptions, using the same one-at-a-time pattern.
2e. If the user picks plans first: skip ahead to step 3 and recommend, but offer to verify doctors/prescriptions on whatever plan they like.
2f. Only ask about budget AFTER doctors and/or prescriptions are captured (or skipped). Keep it as one short question.
`;

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Input helpers ─────────────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 40;
const PHONE_RE = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

function sanitizeHistory(
  history: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  if (!history || history.length === 0) return [];
  const filtered: Array<{ role: string; content: string }> = [];
  for (const msg of history) {
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    const content = typeof msg.content === 'string'
      ? msg.content.replace(PHONE_RE, '[phone redacted]')
      : String(msg.content);
    // Merge consecutive same-role messages
    if (filtered.length > 0 && filtered[filtered.length - 1].role === msg.role) {
      filtered[filtered.length - 1].content += '\n' + content;
    } else {
      filtered.push({ role: msg.role, content });
    }
  }
  // Anthropic/Perplexity require first message is user
  while (filtered.length > 0 && filtered[0].role !== 'user') filtered.shift();
  // Remove trailing user message (the current turn is sent separately)
  if (filtered.length > 0 && filtered[filtered.length - 1].role === 'user') filtered.pop();
  return filtered;
}

// ── Top plans (passed from client after plans API fetch) ──────────────────────
interface TopPlan {
  id: string;
  name: string;
  carrier: string;
  premium: number;
  stars: number;
  type: string;
}

function buildPlansContext(topPlans: TopPlan[]): string {
  if (!topPlans.length) return '';
  const list = topPlans.slice(0, 3).map((p, i) =>
    `${i + 1}. ${p.carrier} ${p.name} (${p.type}) — $${p.premium}/mo, ${p.stars}★`
  ).join('\n');
  return `\n\nAVAILABLE PLANS FOR THIS USER'S AREA (use only these when recommending — they are real, current plans):\n${list}\nReference plans by carrier and name. Do not invent other plan names.`;
}

// ── Phase / chips ─────────────────────────────────────────────────────────────
type Phase = 'welcome' | 'discovery' | 'plan_search' | 'comparison' | 'deep_dive' | 'enrollment';

const COVERAGE_CHIPS_ENABLED = process.env.NEXT_PUBLIC_COVERAGE_CHIPS === '1';

function extractChips(phase?: string): string[] {
  const defaults: Record<string, string[]> = {
    welcome:     ['Find plans in my area', 'I know my ZIP'],
    discovery:   ['Show my best plan', 'I take prescriptions', 'I have a preferred doctor'],
    plan_search: ['Show my best match', 'Compare 2 plans'],
    comparison:  ['Start enrollment', 'Talk to an agent'],
    deep_dive:   ['Start enrollment', 'Talk to an agent'],
    enrollment:  ['Continue enrollment', 'Talk to an agent'],
  };
  if (COVERAGE_CHIPS_ENABLED && (phase === 'discovery' || phase === 'welcome')) {
    if (phase === 'welcome') return ['Find plans in my area', 'I know my ZIP'];
    return ['My doctors', 'My prescriptions', 'Both', 'Just show plans first'];
  }
  return defaults[phase ?? 'welcome'] ?? defaults.welcome;
}

function determinePhase(userMsg: string, currentPhase?: string): Phase {
  const msg = userMsg.toLowerCase();
  if (msg.includes('enroll') || msg.includes('sign up') || msg.includes('apply')) return 'enrollment';
  if (msg.includes('compare') || msg.includes('side by side') || msg.includes('difference')) return 'comparison';
  if (msg.includes('find plan') || msg.includes('search') || msg.includes('show me plans') ||
      msg.includes('what plan') || msg.includes('best plan') || msg.includes('recommend')) return 'plan_search';
  if (msg.includes('zip') || msg.includes('medication') || msg.includes('doctor') ||
      msg.includes('budget') || msg.includes('prescription') || msg.includes('afford')) return 'discovery';
  if (msg.includes('tell me more') || msg.includes('details') || msg.includes('coverage')) return 'deep_dive';
  // Advance from discovery to plan_search once the user is actively answering qualifying questions
  if (currentPhase === 'discovery') return 'plan_search';
  return (currentPhase as Phase) ?? 'welcome';
}

function extractProfileData(userMsg: string): Record<string, string> {
  const profile: Record<string, string> = {};
  const zipMatch = userMsg.match(/\b\d{5}\b/);
  if (zipMatch) profile.zipCode = zipMatch[0];

  const lower = userMsg.toLowerCase();

  if (
    /\b(doctor|dr\.|physician|specialist|hospital|clinic|pcp|provider|practice)\b/.test(lower) ||
    /\b(my doctor|my physician|my provider|see a doctor|see my)\b/.test(lower)
  ) profile.hasDoctor = '1';

  if (
    /\b(medication|prescription|drug|pill|tablet|capsule|mg)\b/.test(lower) ||
    // Natural "I take / I use / I'm on [drug name]" patterns
    /\bi (take|use|am on|get|need)\b/.test(lower) ||
    /\b(taking|prescribed|currently on|on a medication)\b/.test(lower)
  ) profile.hasMedication = '1';

  if (
    /\b(budget|afford|premium|cost|price|monthly|pay|spend|zero|free)\b/.test(lower) ||
    /\b(cheap|cheapest|low[- ]cost|low[- ]premium|no[- ]premium|affordable|dollar)\b/.test(lower) ||
    /\$\d/.test(userMsg)
  ) profile.hasBudget = '1';

  return profile;
}

// ── PHI entity extraction (confidence-gated) ──────────────────────────────────
// Only entities with a specific named referent pass — vague mentions
// ("I have a doctor", "I take medication") remain as hasDoctor / hasMedication flags.

interface PhiDoctor { name: string; specialty?: string; npi?: string }
interface PhiMedication { name: string; dosage?: string; frequency?: string }

const DOCTOR_NAME_STOPS = new Set([
  'doctor','physician','provider','specialist','surgeon','cardiologist','internist',
  'clinic','center','hospital','medical','health','office','group','associates',
]);

const DRUG_NAME_STOPS = new Set([
  'medication','medicine','prescription','drug','pill','tablet','capsule','vitamins',
  'supplements','something','this','that','some','daily','regular','dose','doses',
  'morning','night','generic','brand','oral','topical',
]);

function extractPhiEntities(userMsg: string): {
  doctors: PhiDoctor[];
  medications: PhiMedication[];
} {
  const doctors: PhiDoctor[] = [];
  const medications: PhiMedication[] = [];
  const seenDr = new Set<string>();
  const seenMed = new Set<string>();

  const drPatterns: RegExp[] = [
    /\bDr\.\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?)/g,
    /\b[Dd]octor\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?)/g,
    /\bmy\s+(?:doctor|physician|provider|specialist)\s+(?:is\s+)?(?:[Dd]r\.\s+)?([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?)/g,
    /\b(?:see|visit|go\s+to)\s+[Dd]r\.\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,})?)/g,
  ];
  for (const re of drPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(userMsg)) !== null) {
      const raw = m[1].trim();
      const key = raw.toLowerCase();
      if (raw.length < 2 || DOCTOR_NAME_STOPS.has(key) || seenDr.has(key)) continue;
      seenDr.add(key);
      doctors.push({ name: `Dr. ${raw}` });
    }
  }

  const dosageRe = /(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|cc|units?|iu|%))/i;
  const freqRe = /\b(once (?:a |per )?day|twice (?:a |per )?day|(?:one|two|three) times? (?:a |per )?(?:day|week)|daily|every (?:morning|night|day|evening)|weekly|monthly|\d+x\/(?:day|week)|at bedtime)\b/i;
  const drugVerbRe = /\b(?:take|taking|on|use|using|prescribed|started?\s+taking|currently\s+(?:take|use|on))\s+([A-Za-z][A-Za-z-]{2,})\b/gi;

  let dm: RegExpExecArray | null;
  while ((dm = drugVerbRe.exec(userMsg)) !== null) {
    const rawName = dm[1];
    const key = rawName.toLowerCase();
    if (
      rawName.length < 4 ||
      DRUG_NAME_STOPS.has(key) ||
      seenMed.has(key) ||
      /^(?:blood|heart|eye|ear|pain|sleep|mood|anti|high|low|some|oral|top)/i.test(rawName)
    ) continue;
    seenMed.add(key);
    const ctxEnd = Math.min(userMsg.length, dm.index + dm[0].length + 50);
    const ctx = userMsg.slice(dm.index, ctxEnd);
    const dosageMatch = dosageRe.exec(ctx);
    const freqMatch = freqRe.exec(ctx);
    medications.push({
      name: rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase(),
      dosage:    dosageMatch ? dosageMatch[1] : undefined,
      frequency: freqMatch   ? freqMatch[1]   : undefined,
    });
  }

  return { doctors, medications };
}

const CTA_PHASES = new Set(['plan_search', 'comparison', 'deep_dive', 'enrollment']);

// Detect when the bot's response itself contains a plan recommendation so the
// CTA fires even if the user's trigger message had no qualifying keywords.
function botIsRecommending(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('best fit') ||
    t.includes("i'd recommend") ||
    t.includes('i recommend') ||
    t.includes('recommend the') ||
    t.includes("here's your best") ||
    t.includes('best plan for you') ||
    t.includes('best match') ||
    t.includes('perfect fit') ||
    t.includes('strong match') ||
    t.includes('top pick') ||
    t.includes('fits your needs') ||
    t.includes('based on what you') ||
    t.includes('based on your zip') ||
    t.includes('based on your information') ||
    t.includes('click below') ||
    t.includes('compare all your options') ||
    // Additional system-prompt output patterns
    t.includes('looks like your best') ||
    t.includes('looks like a great') ||
    t.includes('would be a great fit') ||
    t.includes('would be your best') ||
    t.includes('stands out as') ||
    t.includes('is the best option') ||
    t.includes('is a strong choice') ||
    t.includes('would recommend') ||
    t.includes('would suggest') ||
    t.includes('your best option') ||
    t.includes('your top option') ||
    t.includes('lock in your plan') ||
    // New system-prompt closing line variants
    t.includes('compare view') ||
    t.includes('review this recommendation') ||
    t.includes('side by side') ||
    t.includes('best-fit option') ||
    t.includes('based on what you shared') ||
    // "Here are your top N plans" style
    /\btop\s+[123]\s+plans?\b/.test(t) ||
    /\brecommend\w*\s+the\s+\w/.test(t)
  );
}

interface CtaContext {
  hasDoctor?: unknown;
  hasMedication?: unknown;
}

function buildCta(
  phase: string,
  profileUpdate: Record<string, string>,
  userProfile?: Record<string, unknown>,
  historyLength?: number,
  topPlans?: TopPlan[],
): { label: string; href: string } | undefined {
  const zip = profileUpdate.zipCode || (userProfile?.zipCode as string | undefined);

  // ZIP is always required — no point linking to a compare page without it.
  if (!zip) return undefined;

  const hasDoctor =
    profileUpdate.hasDoctor || userProfile?.hasDoctor ||
    (userProfile?.doctors as unknown[] | undefined)?.length;
  const hasMedication =
    profileUpdate.hasMedication || userProfile?.hasMedication ||
    (userProfile?.medications as unknown[] | undefined)?.length;
  const hasBudget =
    profileUpdate.hasBudget || userProfile?.hasBudget || userProfile?.budget;

  const hasSecondary = hasDoctor || hasMedication || hasBudget;

  // Full qualification: ZIP + at least two distinct qualifiers → immediate handoff.
  const qualifierCount = [hasDoctor, hasMedication, hasBudget].filter(Boolean).length;
  const fullyQualified = qualifierCount >= 2;

  const enoughTurns = (historyLength ?? 0) >= 6;
  const ready = CTA_PHASES.has(phase) || hasSecondary || enoughTurns || fullyQualified;

  if (!ready) return undefined;

  return buildCtaLink(zip, topPlans, { hasDoctor, hasMedication });
}

// Priority routing rule:
//   1. plan IDs available  → /ai-compare?zip=…&plan1=…&plan2=…[&plan3=…]
//   2. ZIP only            → /plans?zip=…
//   3. nothing             → /plans (bare fallback)
// Doctor/prescription context is always encoded when present so the
// destination page can surface a contextual acknowledgement.
function buildCtaLink(
  zip: string | undefined,
  topPlans?: TopPlan[],
  context?: CtaContext,
): { label: string; href: string } {
  const params = new URLSearchParams({ from: 'chat' });
  if (zip) params.set('zip', zip);
  if (context?.hasDoctor) params.set('hasDoctors', '1');
  if (context?.hasMedication) params.set('hasMeds', '1');

  if (topPlans && topPlans.length > 0) {
    if (topPlans[0]) params.set('plan1', topPlans[0].id);
    if (topPlans[1]) params.set('plan2', topPlans[1].id);
    if (topPlans[2]) params.set('plan3', topPlans[2].id);
    const label = topPlans.filter(Boolean).length === 1
      ? 'See it in compare view'
      : 'Review this recommendation side by side';
    return { label, href: `/ai-compare?${params.toString()}` };
  }

  return {
    label: 'See plans in your area',
    href: zip ? `/plans?${params.toString()}` : '/plans?from=chat',
  };
}

// ── NPPES lookup for chat-extracted doctor names ──────────────────────────────
// Tries to resolve NPI + specialty for a name extracted from free text.
// Uses a short timeout so the meta event isn't held up if NPPES is slow.
async function tryResolveProviderNpi(
  doctorName: string,
  zip: string,
  baseUrl: string,
): Promise<{ npi?: string; specialty?: string } | null> {
  const searchName = doctorName.replace(/^Dr\.\s+/, '');
  try {
    const url = `${baseUrl}/api/doctors?name=${encodeURIComponent(searchName)}&zip=${encodeURIComponent(zip)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json() as { doctors?: Array<{ npi: string; specialty: string }> };
    const first = data.doctors?.[0];
    return first ? { npi: first.npi, specialty: first.specialty } : null;
  } catch {
    return null;
  }
}

// ── RxNorm drug name validation ───────────────────────────────────────────────
// Uses NIH's free RxNorm API to verify that an extracted drug name is a real
// medication. Returns false on timeout or API error so unrecognised names are
// never silently stored. 3-second ceiling keeps the meta event prompt.
async function tryValidateDrug(drugName: string): Promise<boolean> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}&search=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json() as { idGroup?: { rxnormId?: string[] } };
    return (data.idGroup?.rxnormId?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Server-side plans fetch (fallback when client topPlans not yet loaded) ────
async function fetchTopPlansServerSide(zip: string): Promise<TopPlan[]> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/plans?zip=${encodeURIComponent(zip)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      plans?: Array<{
        id: string; planName: string; carrier: string;
        premium: number; starRating?: { overall?: number }; planType?: string;
      }>;
    };
    return (data.plans ?? []).slice(0, 3).map(p => ({
      id: p.id,
      name: p.planName,
      carrier: p.carrier,
      premium: p.premium,
      stars: p.starRating?.overall ?? 0,
      type: p.planType ?? '',
    }));
  } catch {
    return [];
  }
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sendSSE(res: VercelResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string) ?? 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { message, history, userProfile, phase, topPlans } = (req.body ?? {}) as {
    message?: unknown;
    history?: unknown;
    userProfile?: Record<string, unknown>;
    phase?: string;
    topPlans?: TopPlan[];
  };

  if (typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message content required' });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: 'Message too long' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const contextMessage = userProfile && Object.keys(userProfile).length > 0
    ? `\n\nUser context: ${JSON.stringify(userProfile)}. Current phase: ${phase ?? 'welcome'}.`
    : '';

  const plansContext = Array.isArray(topPlans) && topPlans.length > 0
    ? buildPlansContext(topPlans)
    : '';

  const rawHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  const cleanHistory = sanitizeHistory(rawHistory as Array<{ role: string; content: string }>);

  const systemPrompt = SYSTEM_PROMPT + (COVERAGE_CHIPS_ENABLED ? COVERAGE_FLOW_INSTRUCTIONS : '') + contextMessage + plansContext;
  const messages = [
    ...cleanHistory,
    { role: 'user', content: message },
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      let errDetail = errText.slice(0, 300);
      try { const j = JSON.parse(errText); errDetail = j?.error?.message ?? errDetail; } catch { /* ignore */ }
      console.error(`[chat] Anthropic ${anthropicRes.status}:`, errDetail);
      sendSSE(res, 'error', { message: `AI API error: ${anthropicRes.status}` });
      res.end();
      return;
    }

    const reader = anthropicRes.body?.getReader();
    if (!reader) {
      sendSSE(res, 'error', { message: 'No response body from AI' });
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        try {
          const evt = JSON.parse(raw) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            fullText += evt.delta.text;
            sendSSE(res, 'delta', evt.delta.text);
          }
        } catch { /* skip malformed lines */ }
      }
    }

    // Send phase / chips / profileUpdate / cta as a single meta event
    const nextPhase = determinePhase(message, phase);
    const profileUpdate = extractProfileData(message);
    const phiEntities = extractPhiEntities(message);

    // zip must be declared before any NPPES / RxNorm calls that need it.
    const zip = profileUpdate.zipCode || (userProfile?.zipCode as string | undefined);

    // ── Doctor matching: only NPI-resolved providers enter the PHI store ────────
    // Unresolved names are surfaced to the user as follow-up guidance instead.
    const matchedDoctors: PhiDoctor[] = [];
    const unmatchedDoctorNames: string[] = [];

    if (phiEntities.doctors.length > 0) {
      if (zip) {
        const npiBase = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
        await Promise.all(
          phiEntities.doctors.map(async (doc) => {
            const resolved = await tryResolveProviderNpi(doc.name, zip, npiBase);
            if (resolved?.npi) {
              matchedDoctors.push({ ...doc, npi: resolved.npi, specialty: resolved.specialty ?? doc.specialty });
            } else {
              unmatchedDoctorNames.push(doc.name);
            }
          }),
        );
      } else {
        // No ZIP → cannot do NPPES geocode lookup; treat all as unmatched.
        for (const doc of phiEntities.doctors) unmatchedDoctorNames.push(doc.name);
      }
    }

    // ── Drug matching: only RxNorm-recognised names enter the PHI store ─────────
    const matchedMeds: PhiMedication[] = [];
    const unmatchedMedNames: string[] = [];

    await Promise.all(
      phiEntities.medications.map(async (med) => {
        const valid = await tryValidateDrug(med.name);
        if (valid) matchedMeds.push(med);
        else unmatchedMedNames.push(med.name);
      }),
    );

    // Build the profile update — only matched PHI reaches validatedProviders/Medications.
    // Unmatched names are sent separately so the client can show corrective messaging
    // without ever writing unverified data to the PHI store.
    const enrichedProfileUpdate: Record<string, unknown> = { ...profileUpdate };
    if (matchedDoctors.length > 0)      enrichedProfileUpdate.validatedProviders   = matchedDoctors;
    if (matchedMeds.length > 0)         enrichedProfileUpdate.validatedMedications = matchedMeds;
    if (unmatchedDoctorNames.length > 0) enrichedProfileUpdate.unmatchedProviders   = unmatchedDoctorNames;
    if (unmatchedMedNames.length > 0)    enrichedProfileUpdate.unmatchedMedications = unmatchedMedNames;

    // Accumulated context (current turn + prior profile) used for URL encoding.
    const ctaContext: CtaContext = {
      hasDoctor:
        profileUpdate.hasDoctor || userProfile?.hasDoctor ||
        (userProfile?.doctors as unknown[] | undefined)?.length ||
        phiEntities.doctors.length,
      hasMedication:
        profileUpdate.hasMedication || userProfile?.hasMedication ||
        (userProfile?.medications as unknown[] | undefined)?.length ||
        phiEntities.medications.length,
    };

    let resolvedPlans: TopPlan[] | undefined =
      Array.isArray(topPlans) && topPlans.length > 0 ? topPlans : undefined;

    // Primary trigger: phase + profile context from user's message
    let cta = buildCta(
      nextPhase, profileUpdate,
      userProfile as Record<string, unknown> | undefined,
      cleanHistory.length, resolvedPlans,
    );

    // Fallback trigger: bot's own response text contains recommendation language.
    // This fires even when the user's message had no qualifying keywords (e.g. "okay", "yes").
    if (!cta && botIsRecommending(fullText) && zip) {
      cta = buildCtaLink(zip, resolvedPlans, ctaContext);
    }

    // Timing gap fix: client plans fetch may not have returned yet on the turn
    // that first triggers a recommendation. Fetch server-side so the plan card
    // always has real data instead of falling back to a plain button.
    if (cta && !resolvedPlans && zip) {
      const fetched = await fetchTopPlansServerSide(zip);
      if (fetched.length > 0) {
        resolvedPlans = fetched;
        cta = buildCtaLink(zip, resolvedPlans, ctaContext);
      }
    }

    // Build structured recommendation handoff when real plan data is available.
    // Renders as a plan card with carrier/premium/stars + deep link to /ai-compare.
    const recommendation = cta && resolvedPlans
      ? {
          plans: resolvedPlans.slice(0, 2).map(p => ({
            id: p.id,
            name: p.name,
            carrier: p.carrier,
            premium: p.premium,
            type: p.type,
            stars: p.stars,
          })),
          ctaLabel: cta.label,
          ctaHref: cta.href,
        }
      : undefined;

    sendSSE(res, 'meta', {
      chips: extractChips(nextPhase),
      phase: nextPhase,
      ...(Object.keys(enrichedProfileUpdate).length > 0 ? { profileUpdate: enrichedProfileUpdate } : {}),
      ...(recommendation ? { recommendation } : cta ? { cta } : {}),
    });

    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    console.error('[chat] Error:', (err as Error)?.message);
    sendSSE(res, 'error', { message: (err as Error).message ?? 'Unknown error' });
    res.end();
  }
}


// Named exports for unit testing — these are pure/side-effect-free helpers.
export { extractPhiEntities, tryResolveProviderNpi, tryValidateDrug };
