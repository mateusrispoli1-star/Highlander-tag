import React, { useState } from 'react';
import { getSocket } from '../hooks/useSocket';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';
import { NavProp } from '../App';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
];

interface Props {
  navigation: NavProp;
}

export default function HomeScreen({ navigation }: Props) {
  const { t, lang, setLang } = useLanguage();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  const socket = getSocket();

  const ensureConnected = () =>
    new Promise<void>((resolve, reject) => {
      if (socket.connected) { resolve(); return; }
      socket.connect();
      socket.once('connect', resolve);
      socket.once('connect_error', (e) => reject(e));
    });

  const createRoom = async () => {
    if (!name.trim()) { alert(t('errorNameRequired')); return; }
    setLoading('create');
    try {
      await ensureConnected();
      socket.emit('create-room', { name: name.trim() }, ({ code: roomCode, error }: any) => {
        setLoading(null);
        if (error) { alert(error); return; }
        navigation.navigate('Lobby', { code: roomCode, isHost: true });
      });
    } catch {
      setLoading(null);
      alert(t('errorConnectionMsg'));
    }
  };

  const joinRoom = async () => {
    if (!name.trim()) { alert(t('errorNameRequired')); return; }
    if (code.trim().length !== 5) { alert(t('errorCodeRequired')); return; }
    setLoading('join');
    try {
      await ensureConnected();
      const upperCode = code.trim().toUpperCase();
      socket.emit('join-room', { code: upperCode, name: name.trim() }, ({ error }: any) => {
        setLoading(null);
        if (error) { alert(error); return; }
        navigation.navigate('Lobby', { code: upperCode, isHost: false });
      });
    } catch {
      setLoading(null);
      alert(t('errorConnectionMsg'));
    }
  };

  return (
    <div style={s.container}>
      <div style={{ height: 'env(safe-area-inset-top)' }} />

      {/* Language toggle */}
      <div style={s.langRow}>
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            style={{ ...s.langBtn, ...(lang === l.code ? s.langBtnOn : {}) }}
            onClick={() => setLang(l.code)}
          >
            <span style={{ ...s.langBtnTxt, ...(lang === l.code ? s.langBtnTxtOn : {}) }}>
              {l.label}
            </span>
          </button>
        ))}
      </div>

      <h1 style={s.title}>TAG</h1>
      <p style={s.subtitle}>{t('subtitle')}</p>

      <input
        style={s.input}
        placeholder={t('namePlaceholder')}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={20}
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        onKeyDown={e => e.key === 'Enter' && createRoom()}
      />

      <button
        style={{ ...s.btn, ...s.btnPrimary, opacity: loading ? 0.7 : 1 }}
        onClick={createRoom}
        disabled={!!loading}
      >
        {loading === 'create' ? <Spinner /> : <span style={s.btnPrimaryText}>{t('createGame')}</span>}
      </button>

      <div style={s.divider}>
        <div style={s.dividerLine} />
        <span style={s.dividerLabel}>{t('orJoin')}</span>
        <div style={s.dividerLine} />
      </div>

      <input
        style={s.input}
        placeholder={t('codePlaceholder')}
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={5}
        onKeyDown={e => e.key === 'Enter' && joinRoom()}
      />

      <button
        style={{ ...s.btn, ...s.btnSecondary, opacity: loading ? 0.7 : 1 }}
        onClick={joinRoom}
        disabled={!!loading}
      >
        {loading === 'join' ? <Spinner /> : <span style={s.btnSecondaryText}>{t('joinGame')}</span>}
      </button>
    </div>
  );
}

function Spinner() {
  return <div className="spinner" />;
}

const s: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    backgroundColor: '#0f0f0f',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 28px',
    position: 'relative',
    boxSizing: 'border-box',
  },
  langRow: {
    position: 'absolute',
    top: 'calc(16px + env(safe-area-inset-top))',
    right: 20,
    display: 'flex',
    gap: 6,
  },
  langBtn: {
    borderRadius: 8,
    border: '1px solid #333',
    padding: '5px 10px',
    background: 'transparent',
    cursor: 'pointer',
  },
  langBtnOn: { backgroundColor: '#ff3b30', borderColor: '#ff3b30' },
  langBtnTxt: { color: '#555', fontSize: 12, fontWeight: 700 },
  langBtnTxtOn: { color: '#fff' },

  title: {
    fontSize: 80,
    fontWeight: 900,
    color: '#ff3b30',
    letterSpacing: 10,
    marginBottom: 4,
    lineHeight: 1,
  },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 52, letterSpacing: 1 },

  input: {
    width: '100%',
    backgroundColor: '#1c1c1e',
    color: '#fff',
    borderRadius: 14,
    padding: '16px 18px',
    fontSize: 16,
    marginBottom: 12,
    border: '1px solid #2c2c2e',
    WebkitAppearance: 'none',
    appearance: 'none',
  },
  btn: {
    width: '100%',
    borderRadius: 14,
    padding: '17px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s',
  },
  btnPrimary: { backgroundColor: '#ff3b30', marginBottom: 4 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: 0.5 },
  btnSecondary: { backgroundColor: '#1c1c1e', border: '1px solid #333' },
  btnSecondaryText: { color: '#fff', fontSize: 16, fontWeight: 600 },

  divider: { display: 'flex', alignItems: 'center', width: '100%', margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2c2c2e' },
  dividerLabel: { color: '#444', fontSize: 11, margin: '0 12px', letterSpacing: 1 },
};
