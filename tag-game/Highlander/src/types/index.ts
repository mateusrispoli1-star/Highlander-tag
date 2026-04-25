export type GameMode = 'classic' | 'infection' | 'freeze';
export type PlayerRole = 'runner' | 'hunter';
export type GameState = 'waiting' | 'playing' | 'ended';
export type LocationAccuracy = 'precise' | 'normal' | 'approximate' | 'vague';

export interface Position {
  lat: number;
  lng: number;
}

export interface Boundary {
  center: Position;
  radius: number;
}

export interface GameSettings {
  numHunters: number;
  gameMode: GameMode;
  tagRange: number;
  timeLimit: number;
  tagImmunity: number;
  headStart: number;
  locationAccuracy: LocationAccuracy;
  boundary: Boundary | null;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  position: Position | null;
  isOutOfBounds: boolean;
  isFrozen: boolean;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  settings: GameSettings;
  state: GameState;
  startTime: number | null;
  winners: 'hunters' | 'runners' | null;
}
