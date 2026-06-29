/** Chatbot slice domain types. */

export interface RecommendedPlan {
  id: string;
  name: string;
  carrier: string;
  premium: number;
  type: string;
  stars?: number;
}

/** Structured recommendation handoff — replaces the plain CTA button when real plan data is available. */
export interface RecommendationHandoff {
  plans: RecommendedPlan[];
  ctaLabel: string;
  ctaHref: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Marks an assistant turn that failed; renders the error treatment + retry. */
  error?: boolean;
  /** Phase-based quick-reply chips attached to an assistant message. */
  chips?: string[];
  /** Plain CTA — used when no plan metadata is available (ZIP-only fallback). */
  cta?: { label: string; href: string };
  /** Structured plan recommendation handoff — rendered as a plan card with deep link. */
  recommendation?: RecommendationHandoff;
}

export type ConversationPhase =
  | 'welcome'
  | 'discovery'
  | 'plan_search'
  | 'comparison'
  | 'deep_dive'
  | 'enrollment'
  | 'confirmation';

/** A provider entity extracted from chat with high confidence. Written to quoteSessionProviders. */
export interface ValidatedProvider {
  name: string;
  specialty?: string;
  npi?: string;
}

/** A medication entity extracted from chat with high confidence. Written to quoteSessionMedications. */
export interface ValidatedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
}

export interface UserProfile {
  zipCode?: string;
  county?: string;
  /** Unstructured chat-only context: not persisted to PHI DB. */
  medications?: string[];
  doctors?: string[];
  budget?: string;
  /** Boolean flags used by CTA trigger logic — unstructured, not persisted as PHI. */
  hasDoctor?: string;
  hasMedication?: string;
  hasBudget?: string;
  /** Confidence-gated PHI entities — written to quoteSession DB via useQuoteSession.save(). */
  validatedProviders?: ValidatedProvider[];
  validatedMedications?: ValidatedMedication[];
}

/** Typed UI actions the assistant can request via inline [ACTION:{…}] tags. */
export type ChatAction =
  | { type: 'OPEN_DRUGS_DOCTORS_MODAL' }
  | { type: 'COLLECT_PHONE' }
  | { type: 'COLLECT_NAME' };
