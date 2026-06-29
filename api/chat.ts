import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { maxDuration: 60 };

// ── System prompt (from medicare-ai-advisor) ─────────────────────────────────
const SYSTEM_PROMPT = `You are Medicare AI Advisor, a licensed-agent-supporting sales assistant for Medicare Advantage plans.

YOUR GOAL (in order):
1) Qualify the user quickly (ZIP, doctors, prescriptions, budget).
2) Recommend ONE best-fit Medicare Advantage plan (2 max).
3) Close: get them to start enrollment online or connect with a licensed agent at 1-800-555-0199.

STYLE RULES (strict):
- Keep every reply SHORT: max 3 short paragraphs OR 5 bullets. No walls of text.
- Plain, warm, human language. Talk like a trusted friend who sells Medicare.
- Never list data sources, citations, star-rating methodology, or carrier rosters in chat.
- Never include bracketed reference markers like [1] or [2][3] in your reply. Speak naturally.
- Do NOT teach Medicare 101 unless the user explicitly asks.
- Never recommend more than 2 plans at once.
- Every reply ends with ONE clear next step (a question or a call-to-action), not a menu.
- No emojis unless the user uses them first.

CONVERSATION FLOW:
1. Opening: If you don't have the ZIP yet, ask for it. Nothing else.
2. Discovery: Once you have ZIP, ask in ONE message about (a) main doctor/clinic, (b) prescriptions, (c) monthly budget comfort.
3. Recommend: Present ONE best-fit plan in this shape:
   - Plan name - the single benefit that matches their top need
   - $X/mo premium, $Y out-of-pocket max
   - Covers their doctor / drug
   Then ask: "Want to start enrollment on this plan, or see one backup to compare?"
4. Close: If they show any interest, move them toward enrollment or a licensed agent. Do not re-explain.

SAFETY:
- Never give medical advice.
- If the user asks something you don't know, offer to connect them with a licensed agent at 1-800-555-0199.

REMEMBER: You are selling. Be confident, concise, and always moving toward the next step.`;

const COVERAGE_FLOW_INSTRUCTIONS = `

COVERAGE WORKFLOW (override step 2 of CONVERSATION FLOW):
2a. Once you have the ZIP, do NOT ask for doctor + prescriptions + budget all at once. Instead ask: "What do you want to check first — your doctors, your prescriptions, both, or just see plans?" Keep it warm and one sentence.
2b. If the user picks doctors: ask for one doctor name at a time. Confirm specialty/clinic if ambiguous. After each, ask if they want to add another or move on.
2c. If the user picks prescriptions: ask for one drug name at a time. Confirm strength/form if ambiguous. After each, ask if they want to add another or move on.
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
  if (msg.includes('find plan') || msg.includes('search') || msg.includes('show me plans')) return 'plan_search';
  if (msg.includes('zip') || msg.includes('medication') || msg.includes('doctor') || msg.includes('budget')) return 'discovery';
  if (msg.includes('tell me more') || msg.includes('details') || msg.includes('coverage')) return 'deep_dive';
  return (currentPhase as Phase) ?? 'welcome';
}

function extractProfileData(userMsg: string): Record<string, string> {
  const profile: Record<string, string> = {};
  const zipMatch = userMsg.match(/\b\d{5}\b/);
  if (zipMatch) profile.zipCode = zipMatch[0];
  return profile;
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

  const { message, history, userProfile, phase } = (req.body ?? {}) as {
    message?: unknown;
    history?: unknown;
    userProfile?: Record<string, unknown>;
    phase?: string;
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

  const rawHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
  const cleanHistory = sanitizeHistory(rawHistory as Array<{ role: string; content: string }>);

  const systemPrompt = SYSTEM_PROMPT + (COVERAGE_CHIPS_ENABLED ? COVERAGE_FLOW_INSTRUCTIONS : '') + contextMessage;
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
        model: 'claude-3-5-haiku-20241022',
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
      console.error(`[chat] Anthropic error ${anthropicRes.status}:`, errText.slice(0, 2000));
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

    // Send phase / chips / profileUpdate as a single meta event
    const nextPhase = determinePhase(message, phase);
    const profileUpdate = extractProfileData(message);
    sendSSE(res, 'meta', {
      chips: extractChips(nextPhase),
      phase: nextPhase,
      ...(Object.keys(profileUpdate).length > 0 ? { profileUpdate } : {}),
    });

    sendSSE(res, 'done', {});
    res.end();
  } catch (err) {
    console.error('[chat] Error:', (err as Error)?.message);
    sendSSE(res, 'error', { message: (err as Error).message ?? 'Unknown error' });
    res.end();
  }
}
