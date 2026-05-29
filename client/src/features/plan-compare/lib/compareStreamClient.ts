// Streaming client for /api/compare-stream.
// Handles timeout, SSE event/data parsing, abort, and error recovery.

import type { MedicarePlan } from '@/lib/types';

export const COMPARE_STREAM_TIMEOUT_MS = 30_000; // 30s — never hangs silently

export type CompareStreamPhase =
  | 'idle'
  | 'loading'      // waiting for first byte
  | 'streaming'    // receiving tokens
  | 'done'
  | 'error'
  | 'timeout';

export interface CompareStreamCallbacks {
  onPhaseChange: (phase: CompareStreamPhase) => void;
  onToken:       (token: string) => void;
  onDone:        (fullText: string) => void;
  onError:       (message: string, isTimeout: boolean) => void;
}

function normalizePlanForApi(p: MedicarePlan) {
  return {
    id: p.id,
    carrier: p.carrier,
    planName: p.planName,
    planType: p.planType,
    snpType: p.snpType,
    premium: p.premium,
    deductible: p.deductible,
    maxOutOfPocket: p.maxOutOfPocket,
    partBPremiumReduction: p.partBPremiumReduction ?? 0,
    starRating: {
      overall: p.starRating.overall,
      customerService: undefined,
      drugPlan: undefined,
      memberComplaints: undefined,
    },
    copays: {
      primaryCare: p.copays.primaryCare,
      specialist: p.copays.specialist,
      urgentCare: p.copays.urgentCare,
      emergency: p.copays.emergency,
      inpatientHospital: p.copays.inpatientHospital,
      outpatientSurgery: p.copays.outpatientSurgery,
    },
    rxDrugs: {
      tier1: p.rxDrugs.tier1,
      tier2: p.rxDrugs.tier2,
      tier3: p.rxDrugs.tier3,
      tier4: p.rxDrugs.tier4,
      deductible: p.rxDrugs.deductible,
      gap: p.rxDrugs.gap,
    },
    extraBenefits: {
      dental:         { covered: p.extraBenefits.dental.covered,         details: p.extraBenefits.dental.details },
      vision:         { covered: p.extraBenefits.vision.covered,         details: p.extraBenefits.vision.details },
      hearing:        { covered: p.extraBenefits.hearing.covered,        details: p.extraBenefits.hearing.details },
      otc:            { covered: p.extraBenefits.otc.covered,            details: p.extraBenefits.otc.details },
      fitness:        { covered: p.extraBenefits.fitness.covered,        details: p.extraBenefits.fitness.details },
      transportation: { covered: p.extraBenefits.transportation.covered, details: p.extraBenefits.transportation.details },
      telehealth:     { covered: p.extraBenefits.telehealth.covered,     details: p.extraBenefits.telehealth.details },
      meals:          { covered: p.extraBenefits.meals.covered,          details: p.extraBenefits.meals.details },
    },
    networkSize: p.networkSize,
    enrollmentPeriod: p.enrollmentPeriod,
    effectiveDate: p.effectiveDate,
    isBestMatch: p.isBestMatch,
    isMostPopular: p.isMostPopular,
    contractId: p.contractId,
    planId: p.planId,
  };
}

export function buildRequestBody(plans: MedicarePlan[]): object {
  if (plans.length < 2 || plans.length > 3) throw new Error('Need 2 or 3 plans');
  return {
    currentPlan: normalizePlanForApi(plans[0]),
    newPlan:     normalizePlanForApi(plans[1]),
    thirdPlan:   plans[2] ? normalizePlanForApi(plans[2]) : undefined,
  };
}

/** Parse a full SSE block into { event, data } */
export function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = '';
  let data  = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    if (line.startsWith('data: '))  data  = line.slice(6).trim();
  }
  if (!data) return null;
  return { event: event || 'delta', data };
}

export async function streamCompare(
  plans: MedicarePlan[],
  callbacks: CompareStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const { onPhaseChange, onToken, onDone, onError } = callbacks;

  // Client-side timeout — server has 120s but we cap at 30s UX-wise
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();

  const combinedSignal = signal
    ? (AbortSignal as any).any?.([signal, controller.signal]) ?? controller.signal
    : controller.signal;

  timeoutId = setTimeout(() => {
    controller.abort();
    onPhaseChange('timeout');
    onError('The AI comparison timed out. Please try again.', true);
  }, COMPARE_STREAM_TIMEOUT_MS);

  const clearTO = () => { if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; } };

  onPhaseChange('loading');

  try {
    const body = buildRequestBody(plans);
    const res = await fetch('/api/compare-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });

    if (!res.ok) {
      clearTO();
      const errText = await res.text().catch(() => '');
      // Friendly message for unconfigured env
      const msg = res.status === 500 && errText.includes('not configured')
        ? 'AI comparison is not available right now. Please try again later.'
        : `Comparison failed (${res.status}). Please try again.`;
      onPhaseChange('error');
      onError(msg, false);
      return;
    }

    onPhaseChange('streaming');

    const reader = res.body?.getReader();
    if (!reader) {
      clearTO();
      onPhaseChange('error');
      onError('No response body. Please try again.', false);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE blocks are separated by double newlines
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const parsed = parseSseBlock(block);
        if (!parsed) continue;

        if (parsed.event === 'done') {
          clearTO();
          onPhaseChange('done');
          onDone(fullText);
          return;
        }

        if (parsed.event === 'error') {
          clearTO();
          const msg = parsed.data.replace(/^"|"$/g, ''); // strip JSON quotes
          onPhaseChange('error');
          onError(msg || 'Comparison failed. Please try again.', false);
          return;
        }

        if (parsed.event === 'delta' || parsed.event === '') {
          try {
            const chunk = JSON.parse(parsed.data) as string;
            if (typeof chunk === 'string' && chunk.length > 0) {
              fullText += chunk;
              onToken(chunk);
              // Reset timeout on each token — we're still receiving data
              if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                  controller.abort();
                  onPhaseChange('timeout');
                  onError('The AI comparison timed out. Please try again.', true);
                }, COMPARE_STREAM_TIMEOUT_MS);
              }
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    }

    // Stream ended without explicit done event — treat as done
    clearTO();
    onPhaseChange('done');
    onDone(fullText);
  } catch (err) {
    clearTO();
    if ((err as Error).name === 'AbortError') return;
    onPhaseChange('error');
    onError((err as Error).message || 'An unexpected error occurred. Please try again.', false);
  }
}
