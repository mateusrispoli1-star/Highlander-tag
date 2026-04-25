import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getSocket } from '../hooks/useSocket';
import { Player, GameSettings, PlayerRole, LocationAccuracy } from '../types';
import { getDistance } from '../utils/distance';
import { useLanguage } from '../i18n/LanguageContext';
import { NavProp, NavParams } from '../App';

interface Props {
  navigation: NavProp;
  route: { params: NavParams['Game'] };
}

interface StreakEvent {
  hunterName: string;
  count: number;
  label: string;
}

const ACCURACY_CONFIG: Record<LocationAccuracy, PositionOptions> = {
  precise:     { enableHighAccuracy: true,  maximumAge: 500,   timeout: 10000 },
  normal:      { enableHighAccuracy: true,  maximumAge: 2000,  timeout: 10000 },
  approximate: { enableHighAccuracy: false, maximumAge: 5000,  timeout: 10000 },
  vague:       { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 },
};

// ── Map icons ────────────────────────────────────────────────────────────────

function coloredPin(color: string, size = 16) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.55)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });
}

const userIcon   = coloredPin('#007aff', 18);
const runnerIcon = coloredPin('#34c759');
const frozenIcon = coloredPin('#4488ff');
const oobIcon    = coloredPin('#ff9f0a');

// ── Keeps the map centred on the user ────────────────────────────────────────

function MapCenterFollower({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  const initialised = useRef(false);
  useEffect(() => {
    if (!pos) return;
    if (!initialised.current) {
      map.setView([pos.lat, pos.lng], 18, { animate: false });
      initialised.current = true;
    } else {
      map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    }
  }, [pos]);
  return null;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GameScreen({ route, navigation }: Props) {
  const { code, initialRole, initialPlayers, initialSettings, startTime } = route.params;
  const socket = getSocket();
  const { t } = useLanguage();

  const [myRole, setMyRole] = useState<PlayerRole>(initialRole);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(
    initialSettings.timeLimit > 0 ? initialSettings.timeLimit * 60 : null
  );
  const [headStartLeft, setHeadStartLeft] = useState(
    initialSettings.headStart > 0 ? initialSettings.headStart : 0
  );
  const [toast, setToast] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [streak, setStreak] = useState<StreakEvent | null>(null);
  const [streakPhase, setStreakPhase] = useState<'in' | 'out' | null>(null);

  const playersRef   = useRef<Player[]>(initialPlayers);
  const myRoleRef    = useRef<PlayerRole>(initialRole);
  const watchIdRef   = useRef<number | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const headStartRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePlayers = (ps: Player[]) => {
    playersRef.current = ps;
    setPlayers(ps);
  };

  // ── Killstreak animation ──────────────────────────────────────────────────

  const showStreakAnnouncement = useCallback((event: StreakEvent) => {
    setStreak(event);
    setStreakPhase('in');
    setTimeout(() => setStreakPhase('out'), 2800);
    setTimeout(() => { setStreak(null); setStreakPhase(null); }, 3400);
  }, []);

  // ── Head-start countdown ──────────────────────────────────────────────────

  useEffect(() => {
    if (headStartLeft <= 0) return;
    headStartRef.current = setInterval(() => {
      setHeadStartLeft(prev => {
        if (prev <= 1) { clearInterval(headStartRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (headStartRef.current) clearInterval(headStartRef.current); };
  }, []);

  // ── Game timer ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!initialSettings.timeLimit) return;
    const endMs = startTime + initialSettings.timeLimit * 60 * 1000;
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) clearInterval(timerRef.current!);
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Socket listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    socket.on('position-update', ({ playerId, lat, lng, isOutOfBounds: oob, isFrozen }: any) => {
      updatePlayers(
        playersRef.current.map(p =>
          p.id === playerId ? { ...p, position: { lat, lng }, isOutOfBounds: oob, isFrozen } : p
        )
      );
    });

    socket.on('player-tagged', ({ taggedPlayerId, taggedName, taggerId, taggerName, players: ps }: any) => {
      updatePlayers(ps);
      const me = ps.find((p: Player) => p.id === socket.id);
      if (me) { myRoleRef.current = me.role; setMyRole(me.role); }
      if (taggedPlayerId === socket.id) {
        navigator.vibrate?.([80, 40, 80]);
        showToast(t('toastYouWereTaggedBy', { name: taggerName }));
      } else if (taggerId === socket.id) {
        navigator.vibrate?.(200);
        showToast(t('toastYouTagged', { name: taggedName }));
      } else {
        showToast(t('toastFeedTagged', { tagger: taggerName, tagged: taggedName }));
      }
    });

    socket.on('infection-streak', (event: StreakEvent) => showStreakAnnouncement(event));
    socket.on('player-unfrozen', ({ players: ps }: any) => updatePlayers(ps));
    socket.on('out-of-bounds', () => setIsOutOfBounds(true));
    socket.on('player-left', ({ playerId }: any) => {
      updatePlayers(playersRef.current.filter(p => p.id !== playerId));
    });
    socket.on('game-over', ({ winners, reason }: any) => {
      cleanup();
      navigation.replace('GameOver', { winners, reason: reason ?? '', myRole: myRoleRef.current });
    });

    return cleanup;
  }, []);

  // ── Geolocation tracking ──────────────────────────────────────────────────

  useEffect(() => {
    const opts = ACCURACY_CONFIG[initialSettings.locationAccuracy];

    const onError = (err: GeolocationPositionError) => {
      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        setLocationDenied(true);
      }
      setMapReady(true);
    };

    navigator.geolocation.getCurrentPosition(
      pos => {
        setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMapReady(true);
      },
      onError,
      { enableHighAccuracy: true, timeout: 8000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPos(p);
        setMapReady(true);
        socket.emit('update-position', p);
        if (initialSettings.boundary) {
          setIsOutOfBounds(getDistance(p, initialSettings.boundary.center) > initialSettings.boundary.radius);
        }
      },
      onError,
      opts
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const cleanup = useCallback(() => {
    socket.off('position-update');
    socket.off('player-tagged');
    socket.off('infection-streak');
    socket.off('player-unfrozen');
    socket.off('out-of-bounds');
    socket.off('player-left');
    socket.off('game-over');
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current)    clearInterval(timerRef.current);
    if (headStartRef.current) clearInterval(headStartRef.current);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const confirmTaggedBy = (hunterId: string) => {
    setTagSubmitting(true);
    socket.emit('report-tag', { hunterId }, ({ error }: any) => {
      setTagSubmitting(false);
      setShowTagModal(false);
      if (error) alert(error);
    });
  };

  const attemptUnfreeze = (targetId: string) => {
    socket.emit('attempt-unfreeze', { targetId }, ({ error }: any) => {
      if (error) showToast(error);
      else showToast(t('toastUnfrozen'));
    });
  };

  const endGame = () => {
    if (window.confirm(t('endGameConfirm'))) {
      socket.emit('end-game', {}, ({ error }: any) => {
        if (error) showToast(error);
      });
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const myPlayer    = players.find(p => p.id === socket.id);
  const isFrozen    = myPlayer?.isFrozen ?? false;
  const runners     = players.filter(p => p.role === 'runner' && !p.isFrozen);
  const hunters     = players.filter(p => p.role === 'hunter');
  const frozenCount = players.filter(p => p.isFrozen).length;

  const streakColor =
    !streak             ? '#ff3b30'
    : streak.count >= 7 ? '#ff2d55'
    : streak.count >= 5 ? '#ff6b00'
    : streak.count >= 3 ? '#ff9f0a'
    : '#34c759';

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // FIX: explicit three-way so null phase never falls through to 'out' animation
  const streakAnimation =
    streakPhase === 'in'  ? 'streakIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
    : streakPhase === 'out' ? 'streakOut 0.6s ease forwards'
    : 'none';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', backgroundColor: '#111' }}>

      {/* Loading overlay */}
      {!mapReady && (
        <div style={s.loadingOverlay}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, marginBottom: 16 }} />
          <p style={{ color: '#888', fontSize: 14 }}>{t('gettingLocation')}</p>
        </div>
      )}

      {/* Location denied error */}
      {mapReady && locationDenied && (
        <div style={s.loadingOverlay}>
          <p style={{ color: '#ff3b30', fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '0 32px', lineHeight: 1.5 }}>
            {t('locationDenied')}
          </p>
        </div>
      )}

      {/* Map */}
      {mapReady && !locationDenied && (
        <MapContainer
          center={myPos ? [myPos.lat, myPos.lng] : [0, 0]}
          zoom={18}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            maxZoom={20}
          />
          <MapCenterFollower pos={myPos} />

          {myPos && <Marker position={[myPos.lat, myPos.lng]} icon={userIcon} />}

          {players
            .filter(p => p.role === 'runner' && p.position && p.id !== socket.id)
            .map(p => (
              <Marker
                key={p.id}
                position={[p.position!.lat, p.position!.lng]}
                icon={p.isFrozen ? frozenIcon : p.isOutOfBounds ? oobIcon : runnerIcon}
                eventHandlers={{
                  click: () => {
                    if (myRole === 'runner' && p.isFrozen && initialSettings.gameMode === 'freeze') {
                      attemptUnfreeze(p.id);
                    }
                  },
                }}
              />
            ))}

          {initialSettings.boundary && (
            <Circle
              center={[initialSettings.boundary.center.lat, initialSettings.boundary.center.lng]}
              radius={initialSettings.boundary.radius}
              pathOptions={{ color: 'rgba(255,59,48,0.85)', fillColor: '#ff3b30', fillOpacity: 0.04, weight: 2 }}
            />
          )}
        </MapContainer>
      )}

      {/* ── HUD overlay ───────────────────────────────────────────────────── */}
      <div style={s.hud}>
        <div style={{ height: 'env(safe-area-inset-top)' }} />

        {/* Top bar */}
        <div style={s.topBar}>
          <div style={{
            ...s.rolePill,
            backgroundColor: myRole === 'hunter' ? '#ff3b30' : isFrozen ? '#4488ff' : '#34c759',
          }}>
            <span style={s.rolePillTxt}>
              {isFrozen ? t('roleFrozen') : myRole === 'hunter' ? t('roleHunter') : t('roleRunner')}
            </span>
          </div>

          {timeLeft !== null && (
            <div style={{ ...s.darkPill, ...(timeLeft < 60 ? s.timerWarning : {}) }}>
              <span style={s.pillTxt}>{formatTime(timeLeft)}</span>
            </div>
          )}

          <div style={s.darkPill}>
            <span style={{ ...s.pillTxt, fontSize: 11 }}>
              {frozenCount > 0
                ? t('playerCountFrozen', { run: runners.length, hunt: hunters.length, frz: frozenCount })
                : t('playerCount', { run: runners.length, hunt: hunters.length })}
            </span>
          </div>
        </div>

        {/* Head-start banner */}
        {headStartLeft > 0 && myRole === 'hunter' && (
          <div style={s.headStartBanner}>
            <span style={s.headStartTxt}>{t('headStartBanner', { n: headStartLeft })}</span>
          </div>
        )}

        {/* Out-of-bounds */}
        {isOutOfBounds && (
          <div style={s.oobBanner}>
            <span style={s.oobTxt}>{t('outOfBounds')}</span>
          </div>
        )}

        {/* Toast — in normal flow, alignSelf:center works fine here */}
        {!!toast && (
          <div style={s.toast}>
            <span style={s.toastTxt}>{toast}</span>
          </div>
        )}

        {/* Freeze hint */}
        {myRole === 'runner' && !isFrozen && initialSettings.gameMode === 'freeze' && (
          <div style={s.hintBanner}>
            <span style={s.hintTxt}>{t('freezeHint')}</span>
          </div>
        )}

        {/* Frozen overlay — FIX: left+translateX centering, safe-area bottom */}
        {isFrozen && (
          <div style={s.frozenBanner}>
            <span style={s.frozenBannerTxt}>{t('youAreFrozen')}</span>
            <span style={s.frozenBannerSub}>{t('frozenSub')}</span>
          </div>
        )}

        {/* TAGGED button — FIX: left+translateX centering, safe-area bottom */}
        {myRole === 'runner' && !isFrozen && (
          <button style={s.taggedBtn} className="tagged-btn-pulse" onClick={() => setShowTagModal(true)}>
            <span style={s.taggedBtnTxt}>{t('taggedBtn')}</span>
            <span style={s.taggedBtnSub}>{t('taggedBtnSub')}</span>
          </button>
        )}

        {/* Killstreak announcer — FIX: left:50% centering, three-way animation state */}
        {streak && (
          <div style={{ ...s.streakBanner, borderColor: streakColor, animation: streakAnimation }}>
            <span style={{ ...s.streakName, color: streakColor }}>{streak.hunterName}</span>
            <span style={s.streakLabel}>{streak.label}</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'center' }}>
              {Array.from({ length: Math.min(streak.count, 9) }).map((_, i) => (
                <span key={i} style={{ color: streakColor, fontSize: 10 }}>●</span>
              ))}
            </div>
          </div>
        )}

        {/* End button — FIX: safe-area bottom */}
        <button style={s.endBtn} onClick={endGame}>
          <span style={s.endBtnTxt}>{t('endGameBtn')}</span>
        </button>
      </div>

      {/* "Who tagged you?" modal */}
      {showTagModal && (
        <div style={s.modalOverlay}>
          <div style={s.modalBox}>
            <p style={s.modalTitle}>{t('tagModalTitle')}</p>
            <p style={s.modalSub}>{t('tagModalSub')}</p>

            {hunters.length === 0 ? (
              <p style={s.modalEmpty}>{t('tagModalEmpty')}</p>
            ) : (
              hunters.map(h => (
                <button
                  key={h.id}
                  style={s.hunterRow}
                  onClick={() => confirmTaggedBy(h.id)}
                  disabled={tagSubmitting}
                >
                  <span style={s.hunterRowTxt}>{h.name}</span>
                </button>
              ))
            )}

            <button
              style={{ ...s.modalCancelBtn, opacity: tagSubmitting ? 0.5 : 1 }}
              onClick={() => setShowTagModal(false)}
              disabled={tagSubmitting}
            >
              <span style={s.modalCancelTxt}>{t('cancel')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  loadingOverlay: {
    position: 'absolute', inset: 0, zIndex: 500,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f0f0f',
  },
  hud: {
    position: 'absolute', inset: 0, zIndex: 1000,
    pointerEvents: 'none', display: 'flex', flexDirection: 'column',
  },
  topBar: {
    display: 'flex', flexDirection: 'row', padding: '12px 12px 0',
    gap: 8, flexWrap: 'wrap', alignItems: 'flex-start',
  },
  rolePill: { borderRadius: 20, padding: '7px 14px' },
  rolePillTxt: { color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: 0.5 },
  darkPill: { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 20, padding: '7px 14px' },
  pillTxt: { color: '#fff', fontWeight: 700, fontSize: 14 },
  timerWarning: { backgroundColor: '#ff3b30' },

  headStartBanner: {
    backgroundColor: '#ff9f0a', margin: '4px 12px 0', borderRadius: 10,
    padding: '10px 0', display: 'flex', justifyContent: 'center',
  },
  headStartTxt: { color: '#000', fontWeight: 800, fontSize: 13, letterSpacing: 1 },

  oobBanner: {
    backgroundColor: '#ff3b30', margin: '6px 12px 0', borderRadius: 10,
    padding: '8px 0', display: 'flex', justifyContent: 'center',
  },
  oobTxt: { color: '#fff', fontWeight: 800, letterSpacing: 2, fontSize: 13 },

  toast: {
    backgroundColor: 'rgba(0,0,0,0.82)', margin: '8px 40px 0', borderRadius: 12,
    padding: '10px 20px', display: 'flex', justifyContent: 'center', alignSelf: 'center',
  },
  toastTxt: { color: '#fff', fontWeight: 600, fontSize: 14 },

  hintBanner: {
    backgroundColor: 'rgba(68,136,255,0.85)', margin: '6px 12px 0', borderRadius: 10,
    padding: '8px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center',
  },
  hintTxt: { color: '#fff', fontSize: 12 },

  // FIX: absolute elements can't use alignSelf; left+translateX centers them correctly
  frozenBanner: {
    position: 'absolute',
    bottom: 'calc(140px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(68,136,255,0.92)', borderRadius: 16,
    padding: '20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    pointerEvents: 'none', whiteSpace: 'nowrap',
  },
  frozenBannerTxt: { color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: 2 },
  frozenBannerSub: { color: '#cce', fontSize: 12, marginTop: 6, textAlign: 'center', whiteSpace: 'normal', maxWidth: 240 },

  // FIX: same centering fix + safe-area
  taggedBtn: {
    position: 'absolute',
    bottom: 'calc(60px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1c1c1e', borderRadius: 20, border: '2px solid #ff3b30',
    padding: '18px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    cursor: 'pointer', pointerEvents: 'auto', whiteSpace: 'nowrap',
    boxShadow: '0 0 20px rgba(255,59,48,0.4)',
  },
  taggedBtnTxt: { color: '#ff3b30', fontSize: 22, fontWeight: 900, letterSpacing: 2 },
  taggedBtnSub: { color: '#666', fontSize: 11, marginTop: 3 },

  // FIX: left:50% so CSS keyframe translate(-50%,-50%) centres it correctly
  streakBanner: {
    position: 'absolute',
    top: '35%',
    left: '50%',
    backgroundColor: 'rgba(0,0,0,0.88)', borderRadius: 18,
    borderWidth: 2, borderStyle: 'solid',
    padding: '18px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    minWidth: 240, pointerEvents: 'none',
  },
  streakName: { fontSize: 15, fontWeight: 700, letterSpacing: 1 },
  streakLabel: { color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: 1, marginTop: 4 },

  // FIX: safe-area bottom
  endBtn: {
    position: 'absolute',
    bottom: 'calc(24px + env(safe-area-inset-bottom))',
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    padding: '8px 16px', border: '1px solid #333', cursor: 'pointer',
    pointerEvents: 'auto',
  },
  endBtnTxt: { color: '#ff3b30', fontWeight: 600, fontSize: 13 },

  modalOverlay: {
    position: 'absolute', inset: 0, zIndex: 2000,
    backgroundColor: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'auto',
  },
  modalBox: {
    backgroundColor: '#1c1c1e', borderRadius: 20, padding: 24,
    width: '82%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 4, textAlign: 'center' },
  modalSub: { color: '#666', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  modalEmpty: { color: '#555', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  hunterRow: {
    width: '100%', backgroundColor: '#2c2c2e', borderRadius: 12,
    padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, border: 'none', cursor: 'pointer',
  },
  hunterRowTxt: { color: '#ff3b30', fontSize: 17, fontWeight: 700 },
  modalCancelBtn: {
    marginTop: 6, padding: '12px 32px', border: 'none',
    backgroundColor: 'transparent', cursor: 'pointer',
  },
  modalCancelTxt: { color: '#555', fontSize: 15 },
};
