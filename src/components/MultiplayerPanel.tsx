import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  Link2,
  Lock,
  MessageSquare,
  Navigation,
  Radio,
  Rocket,
  Send,
  User,
  Users,
  X,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import { getSpacecraftPreset } from '../data/hangarCatalog';
import {
  MultiplayerChatMessage,
  MultiplayerConnectionStatus,
  RemotePlayerState,
} from '../types/astronomy';
import {
  buildRoomInviteUrl,
  generatePrivateRoomCode,
  sanitizeRoomCodeClient,
} from '../utils/multiplayerClient';

interface MultiplayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  status: MultiplayerConnectionStatus;
  roomCode: string;
  isGlobalRoom: boolean;
  localPlayerId: string;
  localCallsign: string;
  onChangeCallsign: (next: string) => void;
  onSwitchRoom: (roomCode: string) => void;
  remotePlayers: RemotePlayerState[];
  chatMessages: MultiplayerChatMessage[];
  onSendChat: (text: string) => void;
  onRendezvousWithPlayer: (player: RemotePlayerState) => void;
}

const BODY_NAME_MAP: Record<string, string> = ALL_CELESTIAL_BODIES.reduce((acc, b) => {
  acc[b.id] = b.name;
  return acc;
}, {} as Record<string, string>);

export const MultiplayerPanel: React.FC<MultiplayerPanelProps> = ({
  isOpen,
  onClose,
  status,
  roomCode,
  isGlobalRoom,
  localPlayerId,
  localCallsign,
  onChangeCallsign,
  onSwitchRoom,
  remotePlayers,
  chatMessages,
  onSendChat,
  onRendezvousWithPlayer,
}) => {
  const [callsignDraft, setCallsignDraft] = useState(localCallsign);
  const [roomInput, setRoomInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [copiedMode, setCopiedMode] = useState<'none' | 'code' | 'link'>('none');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCallsignDraft(localCallsign);
  }, [localCallsign]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, isOpen]);

  if (!isOpen) return null;

  const totalOnline = remotePlayers.length + (status === 'CONNECTED' ? 1 : 0);

  const copyText = (text: string, kind: 'code' | 'link') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedMode(kind);
    window.setTimeout(() => setCopiedMode('none'), 2000);
  };

  const handleCreatePrivateRoom = () => {
    const code = generatePrivateRoomCode();
    onSwitchRoom(code);
    setRoomInput('');
  };

  const handleJoinCustomRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRoomCodeClient(roomInput);
    if (!cleaned) return;
    onSwitchRoom(cleaned);
    setRoomInput('');
  };

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setChatInput('');
  };

  const statusBadge =
    status === 'CONNECTED'
      ? { label: 'CONECTADO', cls: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200', dot: 'bg-emerald-400' }
      : status === 'CONNECTING' || status === 'RECONNECTING'
        ? { label: 'CONECTANDO...', cls: 'bg-amber-500/20 border-amber-400/50 text-amber-200', dot: 'bg-amber-400 animate-pulse' }
        : { label: 'OFFLINE', cls: 'bg-rose-500/20 border-rose-400/50 text-rose-200', dot: 'bg-rose-400' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-sm"
      data-testid="multiplayer-modal"
      onClick={onClose}
    >
      <div
        className="menu-glass-surface w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border border-sky-300/45 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-400/45 flex items-center justify-center text-sky-300 shrink-0">
              {isGlobalRoom ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5 text-amber-300" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-display font-bold text-white truncate">
                  {isGlobalRoom ? 'Mundo Global Compartilhado' : `Sala Privada · ${roomCode}`}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${statusBadge.cls}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {isGlobalRoom
                  ? 'Todos os jogadores voam, mineram e exploram o mesmo universo em tempo real.'
                  : 'Sala isolada por código — compartilhe o código ou link para convidar amigos.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors shrink-0"
            title="Fechar Multiplayer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 1. Pilot Callsign + Room Switcher */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Callsign card */}
            <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300 font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Seu Nome de Piloto (Callsign)</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onChangeCallsign(callsignDraft);
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  maxLength={22}
                  value={callsignDraft}
                  onChange={(e) => setCallsignDraft(e.target.value)}
                  placeholder="Ex: Cmdt. Douker"
                  className="flex-1 min-w-0 bg-slate-950/85 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/50 text-sky-100 text-xs font-semibold shrink-0 transition-colors"
                >
                  Salvar
                </button>
              </form>
              <div className="text-[10px] font-mono text-slate-400">
                ID da Sessão: <span className="text-slate-200">{localPlayerId || '—'}</span> · Online na sala:{' '}
                <span className="text-emerald-300 font-bold">{totalOnline}</span>
              </div>
            </div>

            {/* Room Mode Switcher (Global vs Private Room) */}
            <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>Mundo Global ou Sala Privada</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onSwitchRoom('GLOBAL')}
                  className={`py-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isGlobalRoom
                      ? 'bg-sky-500/25 border-sky-400 text-white shadow'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Mundo Global</span>
                </button>
                <button
                  onClick={handleCreatePrivateRoom}
                  className="py-1.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Criar Privada</span>
                </button>
              </div>

              <form onSubmit={handleJoinCustomRoom} className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={24}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  placeholder="Código da sala (ex: ORBITA-482)"
                  className="flex-1 min-w-0 bg-slate-950/85 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono uppercase text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-100 text-xs font-semibold shrink-0 transition-colors"
                >
                  Entrar
                </button>
              </form>

              {!isGlobalRoom && (
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/10 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-bold tracking-wide">
                    {roomCode}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyText(roomCode, 'code')}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 flex items-center gap-1"
                    >
                      {copiedMode === 'code' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMode === 'code' ? 'Copiado' : 'Código'}</span>
                    </button>
                    <button
                      onClick={() => copyText(buildRoomInviteUrl(roomCode), 'link')}
                      className="px-2 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/40 text-sky-100 flex items-center gap-1"
                    >
                      {copiedMode === 'link' ? <Check className="w-3 h-3 text-emerald-300" /> : <Link2 className="w-3 h-3" />}
                      <span>{copiedMode === 'link' ? 'Link Copiado!' : 'Convidar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Online Pilots in Room + 1-Click Rendezvous */}
          <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Pilotos Nesta Sala ({totalOnline})</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Veios Sísmicos [F] são compartilhados com todos na mesma órbita!
              </span>
            </div>

            {remotePlayers.length === 0 ? (
              <div className="py-4 px-3 rounded-xl bg-slate-950/60 border border-white/5 text-center text-xs text-slate-400">
                Você é o único piloto conectado nesta sala no momento.{' '}
                {isGlobalRoom
                  ? 'Qualquer jogador que abrir o jogo aparecerá aqui automaticamente!'
                  : `Envie o código "${roomCode}" ou o Link de Convite para amigos entrarem com você.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {remotePlayers.map((rp) => {
                  const ship = getSpacecraftPreset(rp.shipId);
                  const planetName = BODY_NAME_MAP[rp.anchorBodyId] || rp.anchorBodyId;
                  return (
                    <div
                      key={rp.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: ship.accentHex,
                            boxShadow: `0 0 8px ${ship.accentHex}`,
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{rp.callsign}</span>
                            <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-sky-200 shrink-0">
                              {rp.mode === 'EVA' ? 'EVA' : rp.mode === 'SPACECRAFT' ? 'Nave' : 'Câmera'}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate flex items-center gap-1">
                            <Navigation className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                            <span className="truncate">{planetName}</span>
                            {rp.mining && (
                              <span className="text-cyan-300 font-bold">· Minerando</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onRendezvousWithPlayer(rp);
                          onClose();
                        }}
                        className="shrink-0 px-2.5 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-100 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                        title={`Ir imediatamente para a órbita de ${rp.callsign} em ${planetName}`}
                      >
                        <Rocket className="w-3 h-3" />
                        <span>Encontrar</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Real-Time Space Chat */}
          <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300 font-bold flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Rádio Espacial da Sala ({isGlobalRoom ? 'Global' : roomCode})</span>
            </div>

            <div className="h-36 overflow-y-auto rounded-xl bg-slate-950/75 border border-white/5 p-2.5 space-y-1.5 text-xs">
              {chatMessages.length === 0 ? (
                <div className="text-[11px] text-slate-500 font-mono">
                  Canal aberto. Envie uma mensagem para os pilotos da sala...
                </div>
              ) : (
                chatMessages.map((m) => (
                  <div key={m.id} className="leading-snug">
                    {m.system ? (
                      <span className="text-[11px] font-mono text-emerald-300/90">
                        • {m.text}
                      </span>
                    ) : (
                      <>
                        <span className="font-mono font-bold text-sky-300 mr-1.5">
                          {m.callsign}:
                        </span>
                        <span className="text-slate-100 break-words">{m.text}</span>
                      </>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                maxLength={180}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Enviar mensagem pelo rádio espacial..."
                className="flex-1 bg-slate-950/85 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={status !== 'CONNECTED' || !chatInput.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/40 disabled:opacity-40 border border-sky-400/50 text-sky-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
