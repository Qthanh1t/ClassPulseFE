const TURN_HOST = import.meta.env.VITE_TURN_HOST ?? 'localhost';

const ICE_SERVERS: RTCIceServer[] = [
  // Public Google STUN — fallback when local TURN is unavailable
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Local STUN (coturn running on Machine A)
  { urls: `stun:${TURN_HOST}:3478` },
  // Local TURN relay — needed when devices can't reach each other via host candidates
  // Credentials must match turnserver.conf: lt-cred-mech / user=classpulse:secret123
  {
    urls: [
      `turn:${TURN_HOST}:3478`,
      `turn:${TURN_HOST}:3478?transport=tcp`,
    ],
    username: 'classpulse',
    credential: 'secret123',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};
