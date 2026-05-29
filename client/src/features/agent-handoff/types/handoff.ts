export type DataCompleteness = 'complete'|'partial'|'minimal';
export interface HandoffPlanSummary { rank:number; planId:string; planName:string; carrier:string; planType:string; premiumMonthly:number; maxOutOfPocket:number; starRating:number; matchScore:number; topReasons:string[]; isTopPick:boolean; }
export interface UnresolvedItem { id:string; category:string; message:string; agentAction:string; }
export interface DisclosureEvent { kind:string; timestamp:string; detail?:string; }
export interface ContactPreference { method:'phone'|'email'|'schedule'; phoneNumber?:string; email?:string; preferredTimeSlot?:string; ttyRequired?:boolean; }
export interface HandoffPayload {
  version:'1.0'; sessionId:string; createdAt:string;
  zip:string; county:string; state:string;
  isDualEligible:boolean; hasChronicConditions:string[]; isInstitutional:boolean;
  enrollmentPeriodLabel?:string; currentPlanName?:string; currentPlanCarrier?:string;
  doctors:{name:string;specialty:string;networkStatus:string}[];
  hasDoctorVerification:boolean;
  prescriptions:{name:string;dosage?:string;coverageStatus:string}[];
  hasRxVerification:boolean;
  topPlans:HandoffPlanSummary[];
  viewedPlanIds:string[];
  aiModelId:string; inferredPriorities:string[]; aiRationale:string[];
  unresolvedItems:UnresolvedItem[];
  contactPreference:ContactPreference;
  consentTimestamp:string; disclosureHistory:DisclosureEvent[];
  checklistCompletionPct?:number; checklistHasBlockingRisk?:boolean; aiDisclosureConfirmed?:boolean;
  dataCompleteness:DataCompleteness; missingFields:string[];
}
// Context assembled by Plans.tsx — handoff slice does NOT read sessionStorage directly
export interface HandoffContext {
  zip:string; county:string; state?:string;
  rxDrugs:{name:string;dosage?:string}[];
  doctors:{name:string;specialty:string;npi?:string}[];
  guidedProfile?:any;
  aiScores?:any[];
  aiModelId?:string;
  verificationSummaries?:Record<string,any>;
  viewedPlanIds?:string[];
  enrollmentPeriodLabel?:string;
  checklistPayload?:any;  // readCRMFromSession(planId) called by Plans.tsx
  contactPreference?:ContactPreference;
  disclosureHistory?:DisclosureEvent[];
  sessionId?:string;
}
export interface AgentBriefing { openingScript:string; contextSummary:string; topPlans:HandoffPlanSummary[]; missingVerificationTasks:string[]; unresolvedItems:UnresolvedItem[]; disclosureHistory:DisclosureEvent[]; suggestedFirstQuestion:string; }
