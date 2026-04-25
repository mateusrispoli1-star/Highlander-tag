import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getSocket } from '../hooks/useSocket';
import { Player, GameSettings, GameMode, LocationAccuracy } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { NavProp, NavParams } from '../App';

// Fix Leaflet's default icon path issue with Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const redPinIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#ff3b30;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.6)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
});

interface Props {
  navigation: NavProp;
  route: { params: NavParams['Lobby'] };
}

const DEFAULT_SETTINGS: GameSettings = {
  numHunters: 1,
  gameMode: 'classic',
  tagRange: 10,
  timeLimit: 10,
  tagImmunity: 3,
  headStart: 10,
  locationAccuracy: 'normal',
  boundary: null,
};

function MapClickHandler({ onTap }: { onTap: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onTap(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LobbyScreen({ navigation, route }: Props) {
  const { code } = route.params;
  const { t } = useLanguage();
  const socket = getSocket();

  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [hostId, setHostId] = useState('');
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);
  const [boundaryCenter, setBoundaryCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [boundaryRadius, setBoundaryRadius] = useState(150);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  // FIX: socket.id is string|undefined in socket.io-client v4; coerce to avoid false positives
  const amHost = !!socket.id && socket.id === hostId;

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
      () => setUserLoc([51.505, -0.09])
    );
  }, []);

  useEffect(() => {
    socket.emit('get-room-state', { code }, ({ roomState, error }: any) => {
      if (error) { alert(error); navigation.goBack(); return; }
      setPlayers(roomState.players);
      setSettings(roomState.settings);
      setHostId(roomState.hostId);
      if (roomState.settings.boundary) {
        setBoundaryCenter(roomState.settings.boundary.center);
        setBoundaryRadius(roomState.settings.boundary.radius);
      }
    });

    socket.on('player-joined', ({ player }: { player: Player }) =>
      setPlayers(prev => [...prev.filter(p => p.id !== player.id), player])
    );

    socket.on('player-left', ({ playerId, newHostId }: { playerId: string; newHostId?: string }) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      if (newHostId) setHostId(newHostId);
    });

    socket.on('settings-updated', ({ settings: s }: { settings: GameSettings }) =>
      setSettings(s)
    );

    socket.on('boundary-set', ({ boundary }: any) => {
      setSettings(prev => ({ ...prev, boundary }));
      if (boundary) {
        setBoundaryCenter(boundary.center);
        setBoundaryRadius(boundary.radius);
      }
    });

    socket.on('game-started', ({ role, players: ps, settings: gs, startTime }: any) => {
      navigation.replace('Game', { code, initialRole: role, initialPlayers: ps, initialSettings: gs, startTime });
    });

    return () => {
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('settings-updated');
      socket.off('boundary-set');
      socket.off('game-started');
    };
  }, []);

  const pushSetting = (partial: Partial<GameSettings>) => {
    if (!amHost) return;
    setSettings(prev => ({ ...prev, ...partial }));
    socket.emit('update-settings', { settings: partial });
  };

  const saveBoundary = () => {
    if (!boundaryCenter) { alert(t('tapToSetCentre')); return; }
    socket.emit('set-boundary', { boundary: { center: boundaryCenter, radius: boundaryRadius } });
    setShowBoundaryModal(false);
  };

  const clearBoundary = () => {
    socket.emit('set-boundary', { boundary: null });
    setBoundaryCenter(null);
    setShowBoundaryModal(false);
  };

  const startGame = () => {
    if (players.length < 2) { alert(t('errorMinPlayers')); return; }
    socket.emit('start-game', {}, ({ error }: any) => { if (error) alert(error); });
  };

  const modeKeys: GameMode[] = ['classic', 'infection', 'freeze'];
  const modeLabelKey: Record<GameMode, 'modeClassic' | 'modeInfection' | 'modeFreeze'> = {
    classic: 'modeClassic', infection: 'modeInfection', freeze: 'modeFreeze',
  };
  const modeDescKey: Record<GameMode, 'modeClassicDesc' | 'modeInfectionDesc' | 'modeFreezeDesc'> = {
    classic: 'modeClassicDesc', infection: 'modeInfectionDesc', freeze: 'modeFreezeDesc',
  };
  const accuracyKeys: LocationAccuracy[] = ['precise', 'normal', 'approximate', 'vague'];
  const accLabelKey: Record<LocationAccuracy, 'accuracyPrecise' | 'accuracyNormal' | 'accuracyApproximate' | 'accuracyVague'> = {
    precise: 'accuracyPrecise', normal: 'accuracyNormal',
    approximate: 'accuracyApproximate', vague: 'accuracyVague',
  };
  const accDetailKey: Record<LocationAccuracy, 'accuracyPreciseDetail' | 'accuracyNormalDetail' | 'accuracyApproximateDetail' | 'accuracyVagueDetail'> = {
    precise: 'accuracyPreciseDetail', normal: 'accuracyNormalDetail',
    approximate: 'accuracyApproximateDetail', vague: 'accuracyVagueDetail',
  };

  const timeLimitLabel = (v: number) =>
    v === 0 ? t('timeLimitNone') : t('timeLimitMinutes', { n: v });

  const mapCenter: [number, number] = boundaryCenter
    ? [boundaryCenter.lat, boundaryCenter.lng]
    : (userLoc ?? [51.505, -0.09]);

  return (
    <>
      {/* Lobby scroll */}
      <div style={s.scroll}>
        <div style={s.content}>
          <div style={{ height: 'env(safe-area-inset-top)' }} />

          {/* Room code */}
          <div style={s.codeCard}>
            <span style={s.codeLabel}>{t('roomCode')}</span>
            <span style={s.codeText}>{code}</span>
            <span style={s.codeHint}>{t('shareCode')}</span>
          </div>

          {/* Players */}
          <SectionTitle>{t('players')} ({players.length})</SectionTitle>
          {players.map(p => (
            <div key={p.id} style={s.playerRow}>
              <span style={s.playerName}>{p.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {p.id === hostId && <Pill label={t('host')} color="#ff3b30" />}
                {p.id === socket.id && <Pill label={t('you')} color="#555" />}
              </div>
            </div>
          ))}

          {/* Settings */}
          <SectionTitle>{t('matchSettings')}</SectionTitle>

          <SettingCard label={t('gameMode')}>
            <div style={s.modeRow}>
              {modeKeys.map(m => (
                <button
                  key={m}
                  style={{ ...s.modeBtn, ...(settings.gameMode === m ? s.modeBtnOn : {}) }}
                  onClick={() => pushSetting({ gameMode: m })}
                  disabled={!amHost}
                >
                  <span style={{ ...s.modeBtnTxt, ...(settings.gameMode === m ? s.modeBtnTxtOn : {}) }}>
                    {t(modeLabelKey[m])}
                  </span>
                </button>
              ))}
            </div>
            <span style={s.modeDesc}>{t(modeDescKey[settings.gameMode])}</span>
          </SettingCard>

          <SettingCard label={t('huntersSetting', { n: settings.numHunters })}>
            <Stepper
              value={settings.numHunters}
              min={1}
              max={Math.max(1, players.length - 1)}
              disabled={!amHost}
              onChange={v => pushSetting({ numHunters: v })}
            />
          </SettingCard>

          <SettingCard label={t('tagRangeSetting', { n: settings.tagRange })}>
            <ChipRow options={[5, 10, 15, 20, 30]} value={settings.tagRange} disabled={!amHost}
              format={v => `${v} m`} onChange={v => pushSetting({ tagRange: v })} />
          </SettingCard>

          <SettingCard label={t('timeLimitSetting', { val: timeLimitLabel(settings.timeLimit) })}>
            <ChipRow options={[0, 5, 10, 15, 20, 30]} value={settings.timeLimit} disabled={!amHost}
              format={v => v === 0 ? '∞' : `${v}m`} onChange={v => pushSetting({ timeLimit: v })} />
          </SettingCard>

          <SettingCard label={t('tagImmunitySetting', { n: settings.tagImmunity })}>
            <ChipRow options={[0, 2, 3, 5, 8]} value={settings.tagImmunity} disabled={!amHost}
              format={v => `${v}s`} onChange={v => pushSetting({ tagImmunity: v })} />
          </SettingCard>

          <SettingCard label={t('headStartSetting', { n: settings.headStart })}>
            <ChipRow options={[0, 5, 10, 15, 30]} value={settings.headStart} disabled={!amHost}
              format={v => `${v}s`} onChange={v => pushSetting({ headStart: v })} />
          </SettingCard>

          <SettingCard label={t('trackerAccuracy')}>
            <div style={s.modeRow}>
              {accuracyKeys.map(a => (
                <button
                  key={a}
                  style={{ ...s.modeBtn, ...(settings.locationAccuracy === a ? s.modeBtnOn : {}) }}
                  onClick={() => pushSetting({ locationAccuracy: a })}
                  disabled={!amHost}
                >
                  <span style={{ ...s.modeBtnTxt, ...(settings.locationAccuracy === a ? s.modeBtnTxtOn : {}) }}>
                    {t(accLabelKey[a])}
                  </span>
                </button>
              ))}
            </div>
            <span style={s.modeDesc}>{t(accDetailKey[settings.locationAccuracy])}</span>
          </SettingCard>

          <SettingCard label={t('playBoundary')}>
            {settings.boundary
              ? <span style={s.boundaryInfo}>{t('boundarySet', { n: Math.round(settings.boundary.radius) })}</span>
              : <span style={s.boundaryNone}>{t('boundaryNone')}</span>
            }
            {amHost && (
              <button style={s.boundaryBtn} onClick={() => setShowBoundaryModal(true)}>
                <span style={s.boundaryBtnTxt}>
                  {settings.boundary ? t('editBoundary') : t('setBoundaryOnMap')}
                </span>
              </button>
            )}
          </SettingCard>

          {amHost ? (
            <button style={s.startBtn} onClick={startGame}>
              <span style={s.startBtnTxt}>{t('startGame')}</span>
            </button>
          ) : (
            <p style={s.waitingTxt}>{t('waitingForHost')}</p>
          )}

          <div style={{ height: 'calc(40px + env(safe-area-inset-bottom))' }} />
        </div>
      </div>

      {/* Boundary map modal */}
      {showBoundaryModal && (
        <div style={s.modalOverlay}>
          {/* FIX: render map unconditionally — mapCenter already has a fallback if userLoc is null */}
          <MapContainer
            center={mapCenter}
            zoom={17}
            style={{ flex: 1, minHeight: 0 }}
            zoomControl={false}
          >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                maxZoom={20}
              />
              <MapClickHandler onTap={(lat, lng) => setBoundaryCenter({ lat, lng })} />
              {boundaryCenter && (
                <>
                  <Marker position={[boundaryCenter.lat, boundaryCenter.lng]} icon={redPinIcon} />
                  <Circle
                    center={[boundaryCenter.lat, boundaryCenter.lng]}
                    radius={boundaryRadius}
                    pathOptions={{ color: '#ff3b30', fillColor: '#ff3b30', fillOpacity: 0.08, weight: 2 }}
                  />
                </>
              )}
            </MapContainer>

          <div style={s.boundaryControls}>
            <p style={s.boundaryControlsHint}>{t('tapToSetCentre')}</p>
            <p style={s.boundaryControlsLabel}>{t('radius', { n: boundaryRadius })}</p>
            <ChipRow
              options={[50, 100, 200, 500, 1000]}
              value={boundaryRadius}
              format={v => v >= 1000 ? `${v / 1000}km` : `${v}m`}
              onChange={setBoundaryRadius}
            />
            <div style={s.boundaryBtnRow}>
              <button style={{ ...s.startBtn, flex: 1, marginTop: 0, width: 'auto' }} onClick={saveBoundary}>
                <span style={s.startBtnTxt}>{t('save')}</span>
              </button>
              <button style={{ ...s.outlineBtn, flex: 1 }} onClick={clearBoundary}>
                <span style={s.outlineBtnTxt}>{t('clear')}</span>
              </button>
              <button style={{ ...s.outlineBtn, flex: 1 }} onClick={() => setShowBoundaryModal(false)}>
                <span style={s.outlineBtnTxt}>{t('cancel')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#555', fontSize: 11, letterSpacing: 2, marginBottom: 10, marginTop: 6 }}>{children}</p>;
}

function SettingCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#1c1c1e', borderRadius: 14, padding: 16, marginBottom: 10 }}>
      <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{label}</p>
      {children}
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ backgroundColor: color, borderRadius: 6, padding: '3px 8px' }}>
      <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

function Stepper({ value, min, max, disabled, onChange }: {
  value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <button
        style={s.stepperBtn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <span style={s.stepperBtnTxt}>−</span>
      </button>
      <span style={s.stepperVal}>{value}</span>
      <button
        style={s.stepperBtn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <span style={s.stepperBtnTxt}>+</span>
      </button>
    </div>
  );
}

function ChipRow({ options, value, disabled, format, onChange }: {
  options: number[]; value: number; disabled?: boolean;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o}
          style={{
            borderRadius: 8,
            border: `1px solid ${value === o ? '#ff3b30' : '#333'}`,
            padding: '7px 12px',
            backgroundColor: value === o ? '#ff3b30' : 'transparent',
            cursor: disabled ? 'default' : 'pointer',
          }}
          onClick={() => !disabled && onChange(o)}
          disabled={disabled}
        >
          <span style={{ color: value === o ? '#fff' : '#555', fontSize: 12 }}>{format(o)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  scroll: { height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, backgroundColor: '#0f0f0f' },
  content: { padding: 20 },

  codeCard: {
    backgroundColor: '#1c1c1e', borderRadius: 18, padding: 24,
    display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28,
  },
  codeLabel: { color: '#555', fontSize: 11, letterSpacing: 2, marginBottom: 8, display: 'block' },
  codeText: { color: '#ff3b30', fontSize: 52, fontWeight: 900, letterSpacing: 10, display: 'block' },
  codeHint: { color: '#444', fontSize: 12, marginTop: 8, display: 'block' },

  playerRow: {
    display: 'flex', alignItems: 'center', backgroundColor: '#1c1c1e',
    borderRadius: 12, padding: '14px 16px', marginBottom: 8,
  },
  playerName: { color: '#fff', fontSize: 16, flex: 1 },

  modeRow: { display: 'flex', gap: 8, marginBottom: 10 },
  modeBtn: {
    flex: 1, borderRadius: 10, border: '1px solid #333', padding: '9px 4px',
    backgroundColor: 'transparent', cursor: 'pointer',
  },
  modeBtnOn: { backgroundColor: '#ff3b30', borderColor: '#ff3b30' },
  modeBtnTxt: { color: '#555', fontSize: 12, fontWeight: 600 },
  modeBtnTxtOn: { color: '#fff' },
  modeDesc: { color: '#555', fontSize: 12, lineHeight: 1.6, display: 'block' },

  boundaryInfo: { color: '#34c759', fontSize: 14, marginBottom: 10, display: 'block' },
  boundaryNone: { color: '#555', fontSize: 14, marginBottom: 10, display: 'block' },
  boundaryBtn: {
    backgroundColor: '#2c2c2e', borderRadius: 10, padding: 12, width: '100%',
    border: 'none', cursor: 'pointer', textAlign: 'center',
  },
  boundaryBtnTxt: { color: '#fff', fontSize: 14 },

  stepperBtn: {
    backgroundColor: '#2c2c2e', borderRadius: 10, width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
  },
  stepperBtnTxt: { color: '#fff', fontSize: 22, fontWeight: 300, lineHeight: 1 },
  stepperVal: { color: '#fff', fontSize: 22, fontWeight: 700, minWidth: 32, textAlign: 'center', display: 'block' },

  startBtn: {
    backgroundColor: '#ff3b30', borderRadius: 14, padding: '18px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, width: '100%', cursor: 'pointer', border: 'none',
  },
  startBtnTxt: { color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: 0.5 },
  outlineBtn: {
    backgroundColor: '#1c1c1e', borderRadius: 14, padding: '18px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #333', cursor: 'pointer',
  },
  outlineBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 600 },
  waitingTxt: { color: '#444', textAlign: 'center', marginTop: 32, fontSize: 14 },

  // Boundary modal
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: '#000',
    display: 'flex', flexDirection: 'column', zIndex: 200,
  },
  boundaryControls: {
    backgroundColor: '#0f0f0f', padding: 20,
    paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
  },
  boundaryControlsHint: { color: '#555', textAlign: 'center', marginBottom: 6, fontSize: 13 },
  boundaryControlsLabel: { color: '#fff', fontWeight: 600, marginBottom: 10 },
  boundaryBtnRow: { display: 'flex', gap: 10, marginTop: 14 },
};
