export interface ScoreTier {
  label: string; min: number; max: number;
  color: string; bgColor: string; borderColor: string; barColor: string;
}
export interface MissingDataNotice {
  factor: string; factorKey: string; message: string;
  severity: 'warn' | 'info'; actionLabel: string; actionEvent: string;
}
export interface MatchScoreContext { hasRxDrugs: boolean; hasDoctors: boolean; }
export interface MatchScoreAnalyticsEvent {
  kind: 'panel_opened'|'panel_closed'|'improve_cta_clicked'|'improve_action_fired';
  planId: string; planName: string; score: number; tierLabel: string;
  actionEvent?: string; sessionId: string; timestamp: number;
}
