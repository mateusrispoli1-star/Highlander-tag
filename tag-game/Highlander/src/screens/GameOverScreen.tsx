import React from 'react';
import { resetSocket } from '../hooks/useSocket';
import { useLanguage } from '../i18n/LanguageContext';
import { NavProp, NavParams } from '../App';

interface Props {
  navigation: NavProp;
  route: { params: NavParams['GameOver'] };
}

export default function GameOverScreen({ navigation, route }: Props) {
  const { winners, reason, myRole } = route.params;
  const { t } = useLanguage();

  const iWon =
    (winners === 'hunters' && myRole === 'hunter') ||
    (winners === 'runners' && myRole === 'runner');

  const headline =
    winners === null ? t('gameOver') : iWon ? t('youWin') : t('youLose');

  const subline =
    winners === 'hunters' ? t('huntersWin')
    : winners === 'runners' ? t('runnersWin')
    : '';

  const goHome = () => {
    resetSocket();
    navigation.reset('Home', {});
  };

  return (
    <div style={s.container}>
      <div style={{ height: 'env(safe-area-inset-top)' }} />

      <p style={{ ...s.headline, color: iWon ? '#34c759' : '#ff3b30' }}>{headline}</p>
      {!!subline && <p style={s.subline}>{subline}</p>}
      {!!reason && <p style={s.reason}>{reason}</p>}

      <button style={s.btn} onClick={goHome}>
        <span style={s.btnTxt}>{t('backToHome')}</span>
      </button>

      <div style={{ height: 'env(safe-area-inset-bottom)' }} />
    </div>
  );
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
    boxSizing: 'border-box',
  },
  headline: { fontSize: 48, fontWeight: 900, letterSpacing: 3, textAlign: 'center', lineHeight: 1.1 },
  subline: { fontSize: 22, color: '#fff', fontWeight: 700, marginTop: 16 },
  reason: { fontSize: 15, color: '#666', marginTop: 10, textAlign: 'center', lineHeight: 1.5 },
  btn: {
    marginTop: 56, backgroundColor: '#ff3b30', borderRadius: 14,
    padding: '17px 48px', border: 'none', cursor: 'pointer',
  },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: 700 },
};
