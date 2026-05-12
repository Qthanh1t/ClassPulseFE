const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:turn.classpulse.app:3478' },
  {
    urls: [
      'turn:turn.classpulse.app:3478',
      'turn:turn.classpulse.app:3478?transport=tcp',
    ],
    username: 'classpulse',
    credential: 'secret123',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};
