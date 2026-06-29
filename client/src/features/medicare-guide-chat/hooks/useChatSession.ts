import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message } from '../types/chat';
import { streamChat, chatErrorMessage } from '../lib/chatStreamClient';
import { parseActionTags, dispatchChatActions } from '../lib/chatActions';
import { loadPersisted, savePersisted } from '../lib/chatStorage';

/**
 * Orchestration hook for the chat slice: owns conversation state, the single
 * request runner (used by first sends, quick replies, and retries), scroll
 * coordination, focus, and session persistence. Holds no view markup.
 */
export function useChatSession() {
  const persisted = useRef(loadPersisted());
  const [isOpen, setIsOpen] = useState(persisted.current.isOpen);
  const [messages, setMessages] = useState<Message[]>(persisted.current.messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request when the chat unmounts.
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

  // Follow the stream only when already at the bottom; otherwise surface a pill.
  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
    else setShowScrollPill(true);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isLoading && inputRef.current) inputRef.current.focus();
  }, [isOpen, isLoading]);

  // Escape closes the panel (standard dialog affordance).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Persist only stable states (never an in-flight empty/streaming bubble).
  useEffect(() => {
    if (isLoading) return;
    savePersisted(messages, isOpen);
  }, [messages, isOpen, isLoading]);

  // Single request path: `history` ends with the user turn to answer.
  const runCompletion = useCallback(async (history: Message[]) => {
    setIsLoading(true);
    atBottomRef.current = true;
    setShowScrollPill(false);
    setMessages([...history, { role: 'assistant', content: '' }]);

    // Replace any prior controller; this turn owns cancellation from here.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // API contract unchanged: only { role, content }, greeting excluded.
      const apiMessages = history.slice(1).map(({ role, content }) => ({ role, content }));
      const fullText = await streamChat(apiMessages, (accumulated) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }, controller);

      // Success: process action tags and strip them from the displayed text.
      const { cleanText, actions } = parseActionTags(fullText);
      if (actions.length > 0) {
        dispatchChatActions(actions);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: cleanText };
          return updated;
        });
      }
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
  }, []);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    setInput('');
    runCompletion([...messages, { role: 'user', content: text }]);
  }, [messages, isLoading, runCompletion]);

  // Retry drops the failed assistant turn and regenerates from the last user message.
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
    isOpen,
    setIsOpen,
    messages,
    input,
    setInput,
    isLoading,
    showScrollPill,
    scrollRef,
    inputRef,
    handleScroll,
    scrollToBottom,
    send,
    retry,
  };
}
