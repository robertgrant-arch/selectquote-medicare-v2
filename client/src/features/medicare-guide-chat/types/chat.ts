/** Chatbot slice domain types. */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Marks an assistant turn that failed; renders the error treatment + retry. */
  error?: boolean;
}

/** Typed UI actions the assistant can request via inline [ACTION:{…}] tags. */
export type ChatAction =
  | { type: 'OPEN_DRUGS_DOCTORS_MODAL' }
  | { type: 'COLLECT_PHONE' }
  | { type: 'COLLECT_NAME' };
