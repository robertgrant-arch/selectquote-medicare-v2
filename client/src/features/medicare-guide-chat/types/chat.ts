/** Chatbot slice domain types. */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Marks an assistant turn that failed; renders the error treatment + retry. */
  error?: boolean;
  /** Phase-based quick-reply chips attached to an assistant message. */
  chips?: string[];
}

export type ConversationPhase =
  | 'welcome'
  | 'discovery'
  | 'plan_search'
  | 'comparison'
  | 'deep_dive'
  | 'enrollment'
  | 'confirmation';

export interface UserProfile {
  zipCode?: string;
  county?: string;
  medications?: string[];
  doctors?: string[];
  budget?: string;
}

/** Typed UI actions the assistant can request via inline [ACTION:{…}] tags. */
export type ChatAction =
  | { type: 'OPEN_DRUGS_DOCTORS_MODAL' }
  | { type: 'COLLECT_PHONE' }
  | { type: 'COLLECT_NAME' };
