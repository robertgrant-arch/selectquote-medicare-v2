import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// VoiceWidget.tsx — "Talk to Aria" voice assistant for Medicare
// Uses Vapi Web SDK for real-time STT → LLM → TTS
// ============================================================

const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '';
const VAPI_ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID || '';

type VoiceStatus = 'idle' | 'connecting' | 'active' | 'error';

interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
}

export default function VoiceWidget() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [volume, setVolume] = useState(0);
  const vapiRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lazy-load Vapi SDK
  const getVapi = useCallback(async () => {
    if (vapiRef.current) return vapiRef.current;
    const { default: Vapi } = await import('@vapi-ai/web');
    const instance = new Vapi(VAPI_PUBLIC_KEY);
    vapiRef.current = instance;
    return instance;
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript, currentSpeech]);

  const startCall = async () => {
    if (!VAPI_PUBLIC_KEY || !VAPI_ASSISTANT_ID) {
      setStatus('error');
      return;
    }
    try {
      setStatus('connecting');
      setTranscript([]);
      setCurrentSpeech('');
      const vapi = await getVapi();

      // Wire up event listeners
      vapi.on('call-start', () => setStatus('active'));
      vapi.on('call-end', () => {
        setStatus('idle');
        setCurrentSpeech('');
      });
      vapi.on('error', () => setStatus('error'));
      vapi.on('volume-level', (v: number) => setVolume(v));

      vapi.on('message', (msg: any) => {
        if (msg.type === 'transcript') {
          if (msg.transcriptType === 'final') {
            setTranscript(prev => [...prev, { role: msg.role, text: msg.transcript }]);
            setCurrentSpeech('');
          } else {
            setCurrentSpeech(msg.transcript);
          }
        }
      });

      await vapi.start(VAPI_ASSISTANT_ID);
    } catch {
      setStatus('error');
    }
  };

  const endCall = async () => {
    try {
      const vapi = vapiRef.current;
      if (vapi) {
        vapi.stop();
        vapi.removeAllListeners();
      }
    } catch { /* ignore */ }
    setStatus('idle');
    setCurrentSpeech('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
      vapiRef.current?.removeAllListeners();
    };
  }, []);

  // ---------- Styles ----------
  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '100px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: status === 'active'
      ? 'linear-gradient(135deg, #16a34a, #15803d)'
      : 'linear-gradient(135deg, #00859A, #00353E)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    boxShadow: status === 'active'
      ? `0 0 ${12 + volume * 30}px rgba(22,163,74,${0.4 + volume * 0.4})`
      : '0 4px 20px rgba(124,58,237,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    zIndex: 9998,
    transition: 'all 0.3s ease',
    transform: status === 'active' ? `scale(${1 + volume * 0.15})` : 'scale(1)',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '170px',
    right: '24px',
    width: '360px',
    maxHeight: '420px',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
    background: '#fff',
    border: '1px solid #e2e8f0',
    zIndex: 9998,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => {
          if (status === 'active') {
            endCall();
          } else if (status === 'idle' || status === 'error') {
            setIsOpen(true);
            startCall();
          }
        }}
        style={fabStyle}
        aria-label={status === 'active' ? 'End voice call' : 'Talk to Aria'}
      >
        {status === 'connecting' ? '...' : status === 'active' ? '🎙' : '🎤'}
      </button>

      {/* Transcript panel */}
      {isOpen && (status === 'active' || status === 'connecting' || transcript.length > 0) && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{
            background: status === 'active'
              ? 'linear-gradient(135deg, #16a34a, #15803d)'
              : 'linear-gradient(135deg, #00859A, #00353E)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background 0.3s',
          }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '15px' }}>
              {status === 'connecting' ? 'Connecting to Aria...' :
               status === 'active' ? 'Speaking with Aria' : 'Call Ended'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {status === 'active' && (
                <button
                  onClick={endCall}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >End</button>
              )}
              <button
                onClick={() => { setIsOpen(false); if (status === 'active') endCall(); }}
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: 'none',
                  color: '#fff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close voice panel"
              >✕</button>
            </div>
          </div>

          {/* Live volume indicator */}
          {status === 'active' && (
            <div style={{
              height: '3px',
              background: '#e2e8f0',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(volume * 100, 100)}%`,
                background: '#16a34a',
                transition: 'width 0.1s',
              }} />
            </div>
          )}

          {/* Transcript */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: '#f8fafc',
              maxHeight: '300px',
            }}
          >
            {transcript.length === 0 && status === 'connecting' && (
              <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                Connecting you to Aria...
              </div>
            )}
            {transcript.map((t, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: t.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: t.role === 'user' ? '#7c3aed' : '#fff',
                  color: t.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  {t.text}
                </div>
              </div>
            ))}
            {currentSpeech && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: '14px 14px 14px 4px',
                  background: '#fff',
                  color: '#94a3b8',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  fontStyle: 'italic',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  {currentSpeech}...
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#94a3b8',
            background: '#fff',
            borderTop: '1px solid #f1f5f9',
          }}>
            SelectQuote AI · Not a licensed advisor · <a href="tel:1-800-777-8002" style={{ color: '#EF7000' }}>1-800-777-8002</a>
          </div>
        </div>
      )}
    </>
  );
}
