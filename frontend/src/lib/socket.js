import { io } from 'socket.io-client';
import { SOCKET_BASE_URL } from './appConfig';

const createNoopSocket = () => ({
  connected: false,
  on: () => {},
  off: () => {},
  emit: () => {},
  connect: () => {},
  disconnect: () => {}
});

const shouldEnableRealtime = () => {
  const envFlag = import.meta.env.VITE_ENABLE_REALTIME;
  if (envFlag === 'true') return true;
  if (envFlag === 'false') return false;

  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || hostname.startsWith('172.');
};

export const socket = shouldEnableRealtime()
  ? io(SOCKET_BASE_URL, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
      transports: ['websocket', 'polling']
    })
  : createNoopSocket();
