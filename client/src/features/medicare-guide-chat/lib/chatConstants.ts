import type { Message } from '../types/chat';

export const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi there! I'm Medicare Guide, a high-powered AI assistant built by SelectQuote. I'm not a licensed agent or a human — I'm here to help guide you through your Medicare Advantage options and find the best plan for your needs.\n\nWhat's most important to you in a plan — keeping your doctors, lowering costs, better drug coverage, or extra benefits like dental, vision, or fitness?"
};

/** Intro-only quick replies — sent through the same path as typed input. */
export const SUGGESTED_PROMPTS = [
  'Keep my doctors',
  'Lower my costs',
  'Better drug coverage',
  'Extra benefits',
];

export const STORAGE_KEY = 'mqe_chat_v1';
export const MAX_INPUT_LENGTH = 2000;
export const MAX_PERSISTED_MESSAGES = 50;
/** Abort if the stream goes idle (no bytes) this long — catches true hangs
 *  without cutting off a slow-but-active response. */
export const CHAT_IDLE_TIMEOUT_MS = 30_000;
