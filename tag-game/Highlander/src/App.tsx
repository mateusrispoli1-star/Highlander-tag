import React, { useState } from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import GameOverScreen from './screens/GameOverScreen';
import { Player, GameSettings } from './types';

export type NavParams = {
  Home: Record<string, never>;
  Lobby: { code: string; isHost: boolean };
  Game: {
    code: string;
    initialRole: 'hunter' | 'runner';
    initialPlayers: Player[];
    initialSettings: GameSettings;
    startTime: number;
  };
  GameOver: {
    winners: 'hunters' | 'runners' | null;
    reason: string;
    myRole: 'hunter' | 'runner';
  };
};

type AnyScreen = keyof NavParams;

type StackEntry =
  | { screen: 'Home'; params: Record<string, never> }
  | { screen: 'Lobby'; params: NavParams['Lobby'] }
  | { screen: 'Game'; params: NavParams['Game'] }
  | { screen: 'GameOver'; params: NavParams['GameOver'] };

export interface NavProp {
  navigate: <S extends AnyScreen>(screen: S, params: NavParams[S]) => void;
  replace: <S extends AnyScreen>(screen: S, params: NavParams[S]) => void;
  reset: <S extends AnyScreen>(screen: S, params: NavParams[S]) => void;
  goBack: () => void;
}

export default function App() {
  const [stack, setStack] = useState<StackEntry[]>([{ screen: 'Home', params: {} }]);

  const current = stack[stack.length - 1];

  const navigate = <S extends AnyScreen>(screen: S, params: NavParams[S]) => {
    setStack(prev => [...prev, { screen, params } as StackEntry]);
  };

  const replace = <S extends AnyScreen>(screen: S, params: NavParams[S]) => {
    setStack(prev => [...prev.slice(0, -1), { screen, params } as StackEntry]);
  };

  const reset = <S extends AnyScreen>(screen: S, params: NavParams[S]) => {
    setStack([{ screen, params } as StackEntry]);
  };

  const goBack = () => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  const nav: NavProp = { navigate, replace, reset, goBack };

  return (
    <LanguageProvider>
      <div style={{ height: '100%', width: '100%', backgroundColor: '#0f0f0f' }}>
        {current.screen === 'Home' && (
          <HomeScreen navigation={nav} />
        )}
        {current.screen === 'Lobby' && (
          <LobbyScreen navigation={nav} route={{ params: current.params as NavParams['Lobby'] }} />
        )}
        {current.screen === 'Game' && (
          <GameScreen navigation={nav} route={{ params: current.params as NavParams['Game'] }} />
        )}
        {current.screen === 'GameOver' && (
          <GameOverScreen navigation={nav} route={{ params: current.params as NavParams['GameOver'] }} />
        )}
      </div>
    </LanguageProvider>
  );
}
