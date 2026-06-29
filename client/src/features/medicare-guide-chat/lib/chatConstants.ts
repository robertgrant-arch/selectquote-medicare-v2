import type { Message } from '../types/chat';

export const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi, I'm your Medicare AI Advisor. I'll help you find a Medicare Advantage plan that fits your doctors, prescriptions, and budget.\n\nWhat's your ZIP code?",
  chips: ['Find plans in my area', 'I know my ZIP'],
};

/** Fallback prompts shown before first reply — overridden per-turn by API chips. */
export const SUGGESTED_PROMPTS = [
  'Find plans in my area',
  'I know my ZIP',
  'Check my doctors',
  'Compare drug costs',
];

export const STORAGE_KEY = 'mqe_chat_v1';
export const MAX_INPUT_LENGTH = 2000;
export const MAX_PERSISTED_MESSAGES = 50;
/** Abort if the stream goes idle (no bytes) this long — catches true hangs
 *  without cutting off a slow-but-active response. */
export const CHAT_IDLE_TIMEOUT_MS = 30_000;
