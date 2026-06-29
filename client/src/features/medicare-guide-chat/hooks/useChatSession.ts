import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, ConversationPhase, UserProfile, ValidatedProvider, ValidatedMedication } from '../types/chat';
import { streamChat, chatErrorMessage, type TopPlan } from '../lib/chatStreamClient';
import { parseActionTags, dispatchChatActions } from '../lib/chatActions';
import { loadPersisted, savePersisted } from '../lib/chatStorage';
import { useQuoteSession } from '../../quote-session/hooks/useQuoteSession';

export function useChatSession() {
  const persisted = useRef(loadPersisted());
  const [isOpen, setIsOpen] = useState(persisted.current.isOpen);
  const [messages, setMessages] = useState<Message[]>(persisted.current.messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [phase, setPhase] = useState<ConversationPhase>('welcome');
  const [userProfile, setUserProfile] = useState<Partial<UserProfile>>({});
  const [topPlans, setTopPlans] = useState<TopPlan[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks prior validated PHI counts to detect new entities without triggering
  // an infinite loop when the save function reference changes between renders.
  const prevPhiCountRef = useRef({ providers: 0, meds: 0 });
  const { save: saveQuoteSession } = useQuoteSession();
  const saveQuoteSessionRef = useRef(saveQuoteSession);
  saveQuoteSessionRef.current = saveQuoteSession;

  useEffect(() => () => abortRef.current?.abort(), []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    atBottomRef.current = atBottom;
    if (atBottom) setShowScrollPill(false);
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
    else setShowScrollPill(true);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isLoading && inputRef.current) inputRef.current.focus();
  }, [isOpen, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isLoading) return;
    savePersisted(messages, isOpen);
  }, [messages, isOpen, isLoading]);

  // Write confidence-gated PHI to the quote session when new validated entities arrive.
  // Full-replace semantics in the repository mean we always send the complete accumulated list.
  useEffect(() => {
    const providers = userProfile.validatedProviders ?? [];
    const meds = userProfile.validatedMedications ?? [];
    if (
      providers.length === prevPhiCountRef.current.providers &&
      meds.length === prevPhiCountRef.current.meds
    ) return;
    prevPhiCountRef.current = { providers: providers.length, meds: meds.length };
    if (providers.length === 0 && meds.length === 0) return;
    saveQuoteSessionRef.current({
      zip: userProfile.zipCode,
      providers: providers.map(p => ({ name: p.name, npi: p.npi, specialty: p.specialty })),
      medications: meds.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
    });

    // Mirror to sessionStorage so Plans.tsx (mqe_doctors / mqe_rxDrugs) reflects
    // chat-collected data without requiring the user to re-enter it in the modals.
    try {
      if (providers.length > 0) {
        const existing: Array<{ id: string; name: string; npi: string; specialty: string; address: string }> =
          JSON.parse(sessionStorage.getItem('mqe_doctors') ?? '[]');
        const merged = [...existing];
        for (const p of providers) {
          const npi = p.npi ?? `chat-${p.name.toLowerCase().replace(/\s+/g, '-')}`;
          if (!merged.some(d => d.npi === npi || d.name.toLowerCase() === p.name.toLowerCase())) {
            merged.push({ id: npi, name: p.name, npi, specialty: p.specialty ?? '', address: '' });
          }
        }
        sessionStorage.setItem('mqe_doctors', JSON.stringify(merged));
      }
      if (meds.length > 0) {
        const existing: Array<{ id: string; name: string; dosage: string; frequency: string; isGeneric: boolean }> =
          JSON.parse(sessionStorage.getItem('mqe_rxDrugs') ?? '[]');
        const merged = [...existing];
        for (const m of meds) {
          if (!merged.some(d => d.name.toLowerCase() === m.name.toLowerCase())) {
            const id = `rx-${m.name}-${m.dosage ?? 'unknown'}`.toLowerCase().replace(/\s+/g, '-');
            merged.push({ id, name: m.name, dosage: m.dosage ?? '', frequency: m.frequency ?? 'Once daily', isGeneric: false });
          }
        }
        sessionStorage.setItem('mqe_rxDrugs', JSON.stringify(merged));
      }
    } catch { /* sessionStorage unavailable (SSR guard) */ }
  }, [userProfile.validatedProviders, userProfile.validatedMedications, userProfile.zipCode]);

  // Fetch real plan IDs when ZIP becomes available so the CTA can deep-link
  // into /ai-compare with plans pre-selected.
  useEffect(() => {
    const zip = userProfile.zipCode;
    if (!zip) return;
    const controller = new AbortController();
    fetch(`/api/plans?zip=${zip}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: { plans?: Array<{ id: string; planName: string; carrier: string; premium: number; starRating?: { overall?: number }; planType?: string }> }) => {
        const plans: TopPlan[] = (data.plans ?? []).slice(0, 3).map(p => ({
          id: p.id,
          name: p.planName,
          carrier: p.carrier,
          premium: p.premium,
          stars: p.starRating?.overall ?? 0,
          type: p.planType ?? '',
        }));
        setTopPlans(plans);
      })
      .catch(() => { /* non-fatal — CTA falls back to /plans */ });
    return () => controller.abort();
  }, [userProfile.zipCode]);

  const runCompletion = useCallback(async (history: Message[]) => {
    setIsLoading(true);
    atBottomRef.current = true;
    setShowScrollPill(false);
    setMessages([...history, { role: 'assistant', content: '' }]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Send only {role, content} pairs; skip the initial greeting
      const apiMessages = history.slice(1).map(({ role, content }) => ({ role, content }));

      const { text: fullText, meta } = await streamChat(
        apiMessages,
        (accumulated) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: accumulated };
            return updated;
          });
        },
        controller,
        phase,
        userProfile,
        topPlans.length > 0 ? topPlans : undefined,
      );

      // Apply action tags (strips them from displayed text)
      const { cleanText, actions } = parseActionTags(fullText);
      if (actions.length > 0) dispatchChatActions(actions);

      // Apply meta: chips, phase update, profile update
      if (meta.phase) setPhase(meta.phase);
      if (meta.profileUpdate) {
        const update = meta.profileUpdate;
        setUserProfile((prev) => {
          // Merge validated PHI arrays — accumulate across turns without name duplicates.
          // Scalar fields (zipCode, hasDoctor, etc.) are overwritten as before.
          const incomingProviders = (update.validatedProviders as ValidatedProvider[] | undefined) ?? [];
          const incomingMeds = (update.validatedMedications as ValidatedMedication[] | undefined) ?? [];
          const mergedProviders = [...(prev.validatedProviders ?? [])];
          for (const p of incomingProviders) {
            if (!mergedProviders.some(ep => ep.name.toLowerCase() === p.name.toLowerCase())) {
              mergedProviders.push(p);
            }
          }
          const mergedMeds = [...(prev.validatedMedications ?? [])];
          for (const m of incomingMeds) {
            if (!mergedMeds.some(em => em.name.toLowerCase() === m.name.toLowerCase())) {
              mergedMeds.push(m);
            }
          }
          return {
            ...prev,
            ...update,
            validatedProviders: mergedProviders,
            validatedMedications: mergedMeds,
          };
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: actions.length > 0 ? cleanText : fullText,
          chips: meta.chips,
          cta: meta.recommendation ? undefined : meta.cta,
          recommendation: meta.recommendation,
        };
        return updated;
      });
    } catch (err) {
      const message = chatErrorMessage(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: message, error: true };
        return updated;
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [phase, userProfile, topPlans]);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    setInput('');
    runCompletion([...messages, { role: 'user', content: text }]);
  }, [messages, isLoading, runCompletion]);

  const retry = useCallback(() => {
    if (isLoading) return;
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUser = i; break; }
    }
    if (lastUser < 0) return;
    runCompletion(messages.slice(0, lastUser + 1));
  }, [messages, isLoading, runCompletion]);

  return {
    isOpen, setIsOpen,
    messages, input, setInput,
    isLoading, showScrollPill,
    scrollRef, inputRef,
    handleScroll, scrollToBottom,
    send, retry,
  };
}
