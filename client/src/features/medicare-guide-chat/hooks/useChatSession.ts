import { useState, useRef, useEffect, useCallback } from 'react';
import type { Message, ConversationPhase, UserProfile } from '../types/chat';
import { streamChat, chatErrorMessage } from '../lib/chatStreamClient';
import { parseActionTags, dispatchChatActions } from '../lib/chatActions';
import { loadPersisted, savePersisted } from '../lib/chatStorage';

export function useChatSession() {
  const persisted = useRef(loadPersisted());
  const [isOpen, setIsOpen] = useState(persisted.current.isOpen);
  const [messages, setMessages] = useState<Message[]>(persisted.current.messages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollPill, setShowScrollPill] = useState(false);
  const [phase, setPhase] = useState<ConversationPhase>('welcome');
  const [userProfile, setUserProfile] = useState<Partial<UserProfile>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const atBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

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
      );

      // Apply action tags (strips them from displayed text)
      const { cleanText, actions } = parseActionTags(fullText);
      if (actions.length > 0) dispatchChatActions(actions);

      // Apply meta: chips, phase update, profile update
      if (meta.phase) setPhase(meta.phase);
      if (meta.profileUpdate) setUserProfile((prev) => ({ ...prev, ...meta.profileUpdate }));

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: actions.length > 0 ? cleanText : fullText,
          chips: meta.chips,
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
  }, [phase, userProfile]);

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
