import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../config';

let instance: Socket | null = null;

export function getSocket(): Socket {
  if (!instance) {
    instance = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return instance;
}

export function resetSocket(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
