# ClassPulse — WebRTC Frontend Implementation Guide

> **Mục tiêu:** Hướng dẫn implement tính năng video/audio call cho Live Session trong ClassPulse.  
> **Topology:** Mesh P2P — mỗi client kết nối trực tiếp với tất cả participant khác.  
> **Signaling:** Qua WebSocket/STOMP (đã có sẵn — không cần channel riêng).  
> **File liên quan:** [04_Realtime_Architecture.md §6](04_Realtime_Architecture.md) · [08_Frontend_Integration_Phase4.md §4.5](08_Frontend_Integration_Phase4.md)

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [TypeScript Types](#2-typescript-types)
3. [Cấu hình ICE Server (Coturn)](#3-cấu-hình-ice-server-coturn)
4. [Lấy Media Stream (Camera/Mic)](#4-lấy-media-stream-cameramic)
5. [Quản lý Peer Connections — useWebRTC Hook](#5-quản-lý-peer-connections--usewebrtc-hook)
6. [Signaling: Offer / Answer / ICE](#6-signaling-offer--answer--ice)
7. [Tích hợp với Presence System](#7-tích-hợp-với-presence-system)
8. [UI Components — Video Grid](#8-ui-components--video-grid)
9. [Focus / Spotlight Mode](#9-focus--spotlight-mode)
10. [Xử lý Breakout Rooms](#10-xử-lý-breakout-rooms)
11. [Error Handling & Edge Cases](#11-error-handling--edge-cases)
12. [Cleanup](#12-cleanup)
13. [Checklist tích hợp](#13-checklist-tích-hợp)

---

## 1. Tổng quan kiến trúc

### Mesh P2P

Với ≤ 30 học sinh, mỗi client mở kết nối P2P trực tiếp với từng người còn lại. Media stream (video/audio) **không đi qua server** — chỉ signaling đi qua Spring WebSocket.

```
                    Spring Server
                   (Signaling only)
                         │
         ┌───────────────┼───────────────┐
         │               │               │
       Teacher ──── WebRTC P2P ────── HS1
         │                               │
         └──────── WebRTC P2P ────── HS2
                                         │
                   HS1 ───── WebRTC P2P ─┘
```

**Số connections tối đa:** N người → mỗi người mở N-1 connections. Với 31 người (1 GV + 30 HS): mỗi client có tối đa 30 `RTCPeerConnection` song song.

### Luồng kết nối

```
Bạn join session
  │
  ├── 1. GET /sessions/{id}/presence  →  lấy danh sách người đang online
  ├── 2. GET /sessions/{id}           →  pre-fetch teacher.id vào teacherIdRef
  ├── 3. getUserMedia()               →  lấy camera/mic
  ├── 4. createSessionWsClient(...)   →  connect STOMP
  │
  └── onConnected (sau khi STOMP đã subscribe xong):
        ├── GET /presence (refresh)   →  cập nhật danh sách online mới nhất
        ├── callPeer(teacherIdRef)    →  kết nối với giáo viên
        └── Với mỗi HS online: callPeer()  →  kết nối với tất cả học sinh
```

> **Tại sao phải gọi từ `onConnected` chứ không phải ngay sau REST join?**  
> Backend `PresenceEventListener` phát `student_presence` tại thời điểm STOMP CONNECT — **trước** khi STOMP gửi CONNECTED frame về client, tức là trước khi client subscribe `/user/queue/private`. Teacher/S1 nhận event, gửi WebRTC offer tới S2 — nhưng offer đó rơi vào queue khi S2 chưa subscribe, bị **drop vĩnh viễn**. Giải pháp: S2 chủ động gọi lại trong `onConnected` (khi subscription đã sẵn sàng). Glare resolution xử lý trường hợp Teacher/S1 vẫn còn PC ở trạng thái `have-local-offer`.

**Quy tắc "polite peer" cho student-to-student:** Khi nhận `student_presence` action='joined' của một HS join SAU mình, student có UUID nhỏ hơn sẽ gửi offer. Student có UUID lớn hơn chờ nhận offer. Điều này tránh cả hai bên đồng thời offer nhau cho những kết nối tương lai. (Các kết nối với peer đã online trước mình được xử lý qua `onConnected`.)

---

## 2. TypeScript Types

```typescript
// ─── ICE & Connection State ───────────────────────────────────────────────────

type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

interface PeerInfo {
  userId: string;
  name: string;
  role: 'teacher' | 'student';
  avatarColor?: string;
}

interface PeerConnection {
  peerId: string;             // UUID của peer
  pc: RTCPeerConnection;      // native RTCPeerConnection
  state: PeerConnectionState;
  remoteStream: MediaStream | null;
  isMuted: boolean;           // peer đã mute mic (không thể detect từ xa — placeholder)
  isCameraOff: boolean;       // track camera của peer có enabled không
}

// Map<peerId, PeerConnection>
type PeerConnectionMap = Map<string, PeerConnection>;

// ─── Local Media ──────────────────────────────────────────────────────────────

interface LocalMedia {
  stream: MediaStream | null;
  isMicOn: boolean;
  isCameraOn: boolean;
  isLoading: boolean;
  error: string | null;
}

// ─── WebRTC Hook State ────────────────────────────────────────────────────────

interface WebRTCState {
  localMedia: LocalMedia;
  peers: PeerConnectionMap;
  focusedPeerId: string | null;  // null = grid view, UUID = spotlight mode
}

interface WebRTCActions {
  toggleMic: () => void;
  toggleCamera: () => void;
  hangUp: () => void;              // đóng tất cả connections + dừng media
  replaceVideoTrack: (track: MediaStreamTrack) => Promise<void>; // đổi camera
}

// ─── Signaling Payloads (từ /user/queue/private) ──────────────────────────────

interface WebRtcOfferPayload {
  fromId: string;   // UUID của peer gửi offer
  sdp: string;
}

interface WebRtcAnswerPayload {
  fromId: string;
  sdp: string;
}

interface WebRtcIceCandidatePayload {
  fromId: string;
  candidate: RTCIceCandidateInit;
}
```

---

## 3. Cấu hình ICE Server (Coturn)

Coturn đã được setup trong `docker-compose.yml`. Frontend chỉ cần khai báo địa chỉ.

```typescript
// src/config/webrtc.ts

const ICE_SERVERS: RTCIceServer[] = [
  // STUN — dùng để discover public IP (không cần auth)
  {
    urls: 'stun:turn.classpulse.app:3478',
  },
  // TURN — relay khi STUN thất bại (NAT đối xứng, firewall)
  {
    urls: [
      'turn:turn.classpulse.app:3478',        // UDP
      'turn:turn.classpulse.app:3478?transport=tcp',  // TCP fallback
    ],
    username: 'classpulse',
    credential: 'secret123',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,  // pre-gather candidates để kết nối nhanh hơn
};
```

> **Dev/localhost:** Nếu cả hai browser cùng máy hoặc cùng LAN, STUN đủ dùng. TURN chỉ cần thiết khi qua NAT/firewall nghiêm ngặt.

---

## 4. Lấy Media Stream (Camera/Mic)

```typescript
// src/hooks/useLocalMedia.ts

import { useState, useRef, useCallback } from 'react';

export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const startMedia = useCallback(async (video = true, audio = true) => {
    setIsLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, frameRate: 30 } : false,
        audio: audio
          ? { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
          : false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsMicOn(audio);
      setIsCameraOn(video);
      return mediaStream;
    } catch (err) {
      const msg = mapMediaError(err);
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  }, []);

  const stopMedia = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return { stream, streamRef, isMicOn, isCameraOn, isLoading, error, startMedia, toggleMic, toggleCamera, stopMedia };
}

// ─── Error mapping ─────────────────────────────────────────────────────────────

function mapMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Trình duyệt bị chặn quyền camera/mic. Vui lòng cấp quyền trong cài đặt.';
      case 'NotFoundError':
        return 'Không tìm thấy camera hoặc microphone.';
      case 'NotReadableError':
        return 'Camera/mic đang được dùng bởi ứng dụng khác.';
      case 'OverconstrainedError':
        return 'Camera không hỗ trợ độ phân giải yêu cầu.';
    }
  }
  return 'Không thể truy cập camera/mic. Vui lòng thử lại.';
}
```

---

## 5. Quản lý Peer Connections — useWebRTC Hook

Hook này quản lý toàn bộ vòng đời `RTCPeerConnection` cho mesh topology.

```typescript
// src/hooks/useWebRTC.ts

import { useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { RTC_CONFIG } from '@/config/webrtc';

export function useWebRTC(
  sessionId: string,
  myUserId: string,
  stompClient: Client | null,
) {
  // Map peerId → { pc, remoteStream, state }
  const pcsRef = useRef<PeerConnectionMap>(new Map());
  const [peers, setPeers] = useState<PeerConnectionMap>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Đồng bộ ref → state để component re-render
  const syncPeers = useCallback(() => {
    setPeers(new Map(pcsRef.current));
  }, []);

  // ─── Tạo RTCPeerConnection cho một peer ──────────────────────────────────────

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Gắn local tracks vào connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Nhận remote stream
      const remoteStream = new MediaStream();
      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
        const entry = pcsRef.current.get(peerId);
        if (entry) {
          entry.remoteStream = remoteStream;
          entry.isCameraOff = !event.track.enabled;
          syncPeers();
        }
      };

      // Gửi ICE candidates qua STOMP
      pc.onicecandidate = (event) => {
        if (!event.candidate || !stompClient?.connected) return;
        stompClient.publish({
          destination: `/app/session/${sessionId}/webrtc/ice-candidate`,
          body: JSON.stringify({
            targetId: peerId,
            candidate: event.candidate.toJSON(),
          }),
        });
      };

      // Theo dõi trạng thái connection
      pc.onconnectionstatechange = () => {
        const entry = pcsRef.current.get(peerId);
        if (!entry) return;
        entry.state = pc.connectionState as PeerConnectionState;
        syncPeers();

        if (pc.connectionState === 'failed') {
          console.warn(`[WebRTC] Connection to ${peerId} failed — restarting ICE`);
          pc.restartIce(); // thử ICE restart trước khi từ bỏ
        }
        if (pc.connectionState === 'closed') {
          pcsRef.current.delete(peerId);
          syncPeers();
        }
      };

      pcsRef.current.set(peerId, {
        peerId,
        pc,
        state: 'new',
        remoteStream: null,
        isMuted: false,
        isCameraOff: false,
      });

      return pc;
    },
    [sessionId, stompClient, syncPeers],
  );

  // ─── Khởi tạo call đến một peer (bạn là Caller) ──────────────────────────────

  const callPeer = useCallback(
    async (peerId: string) => {
      if (pcsRef.current.has(peerId)) return; // đã connect rồi
      if (!stompClient?.connected) return;

      const pc = createPeerConnection(peerId);

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);

        stompClient.publish({
          destination: `/app/session/${sessionId}/webrtc/offer`,
          body: JSON.stringify({
            targetId: peerId,
            sdp: pc.localDescription!.sdp,
          }),
        });
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for ${peerId}`, err);
        pc.close();
        pcsRef.current.delete(peerId);
        syncPeers();
      }
    },
    [sessionId, stompClient, createPeerConnection, syncPeers],
  );

  // ─── Đóng connection với một peer ────────────────────────────────────────────

  const closePeer = useCallback((peerId: string) => {
    const entry = pcsRef.current.get(peerId);
    if (!entry) return;
    entry.pc.close();
    pcsRef.current.delete(peerId);
    syncPeers();
  }, [syncPeers]);

  // ─── Đóng tất cả connections ─────────────────────────────────────────────────

  const closeAllPeers = useCallback(() => {
    pcsRef.current.forEach((entry) => entry.pc.close());
    pcsRef.current.clear();
    syncPeers();
  }, [syncPeers]);

  return {
    peers,
    pcsRef,
    localStreamRef,
    callPeer,
    closePeer,
    closeAllPeers,
    createPeerConnection,
    syncPeers,
  };
}
```

---

## 6. Signaling: Offer / Answer / ICE

Xử lý các messages đến từ `/user/queue/private`.

```typescript
// Trong component LiveSession.tsx — phần handlePrivateEvent

const handlePrivateEvent = useCallback(
  async (type: string, payload: WebRtcOfferPayload | WebRtcAnswerPayload | WebRtcIceCandidatePayload) => {
    switch (type) {

      // ── Nhận Offer → tạo Answer ──────────────────────────────────────────────
      case 'webrtc_offer': {
        const { fromId, sdp } = payload as WebRtcOfferPayload;

        // Tạo PC nếu chưa có (người kia là caller, ta là callee)
        let entry = pcsRef.current.get(fromId);
        if (!entry) {
          createPeerConnection(fromId);
          entry = pcsRef.current.get(fromId)!;
        }

        const { pc } = entry;

        try {
          await pc.setRemoteDescription({ type: 'offer', sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          stompClient?.publish({
            destination: `/app/session/${sessionId}/webrtc/answer`,
            body: JSON.stringify({
              targetId: fromId,
              sdp: pc.localDescription!.sdp,
            }),
          });
        } catch (err) {
          console.error(`[WebRTC] Failed to handle offer from ${fromId}`, err);
        }
        break;
      }

      // ── Nhận Answer → hoàn tất handshake ─────────────────────────────────────
      case 'webrtc_answer': {
        const { fromId, sdp } = payload as WebRtcAnswerPayload;
        const entry = pcsRef.current.get(fromId);
        if (!entry) return;

        try {
          // Chỉ set nếu đang ở trạng thái have-local-offer
          if (entry.pc.signalingState === 'have-local-offer') {
            await entry.pc.setRemoteDescription({ type: 'answer', sdp });
          }
        } catch (err) {
          console.error(`[WebRTC] Failed to set answer from ${fromId}`, err);
        }
        break;
      }

      // ── Nhận ICE Candidate → thêm vào PC ─────────────────────────────────────
      case 'webrtc_ice_candidate': {
        const { fromId, candidate } = payload as WebRtcIceCandidatePayload;
        const entry = pcsRef.current.get(fromId);
        if (!entry) return;

        try {
          await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          // Bỏ qua nếu PC đã đóng hoặc invalid candidate
          if (entry.pc.connectionState !== 'closed') {
            console.warn(`[WebRTC] Failed to add ICE candidate from ${fromId}`, err);
          }
        }
        break;
      }
    }
  },
  [sessionId, stompClient, pcsRef, createPeerConnection],
);
```

---

## 7. Tích hợp với Presence System

### 7.1 Kết nối khi join session (Student)

```typescript
// StudentSessionPage — init flow

// Bước 1: REST calls song song
const [presenceRes, , , sessionDetailRes] = await Promise.all([
  sessionService.getPresence(info.sessionId),
  chatService.getHistory(info.sessionId, 50),
  questionService.list(info.sessionId),
  sessionService.get(info.sessionId).catch(() => null), // pre-fetch teacher.id
]);

// Pre-lưu teacher ID để dùng trong onConnected
if (sessionDetailRes?.data?.teacher?.id) {
  teacherIdRef.current = sessionDetailRes.data.teacher.id;
}

// Bước 2: Lấy camera/mic TRƯỚC khi connect WS
await localMedia.startMedia(true, true);

// Bước 3: Connect WS — truyền onConnected callback
const ws = createSessionWsClient(
  info.wsTicket,
  info.sessionId,
  onReconnect,
  async () => {
    // onConnected — STOMP đã subscribe xong, safe để gửi/nhận unicast
    // Refresh presence: backend đã broadcast student_presence trước khi ta subscribe
    const freshRes = await sessionService.getPresence(info.sessionId);
    const online = freshRes.data?.filter((p) => p.isOnline) ?? [];
    setPresence(online);
    presenceRef.current = online;

    // Gọi teacher trước (luôn luôn — offer của teacher có thể đã bị drop)
    if (teacherIdRef.current) {
      await rtc.callPeer(teacherIdRef.current);
    }
    // Gọi tất cả HS đang online (không phân biệt UUID order)
    // Nếu họ đang có PC ở have-local-offer → glare resolution sẽ rollback
    for (const p of presenceRef.current) {
      if (p.isOnline && p.studentId !== me?.id) {
        await rtc.callPeer(p.studentId);
      }
    }
  },
);
```

### 7.2 Xử lý người join/leave sau

```typescript
// Trong handleEvent — case 'student_presence'
// Payload từ backend: { studentId, action, name, avatarColor? }

case 'student_presence': {
  const payload = event.payload as {
    studentId: string;
    name: string;
    avatarColor?: string;
    action: 'joined' | 'left';
  };

  if (payload.action === 'left') {
    rtc.closePeer(payload.studentId);
    setPresence((prev) => {
      const updated = prev.filter((x) => x.studentId !== payload.studentId);
      presenceRef.current = updated;
      return updated;
    });
  } else {
    // Polite peer: student có UUID nhỏ hơn là người offer (cho peer join SAU ta)
    if (payload.studentId !== me?.id && (me?.id ?? '') < payload.studentId) {
      void rtc.callPeer(payload.studentId);
    }
    // Optimistically cập nhật presence với name từ WS payload (không chờ REST)
    setPresence((prev) => {
      if (prev.some((x) => x.studentId === payload.studentId)) {
        return prev.map((x) =>
          x.studentId === payload.studentId ? { ...x, isOnline: true } : x,
        );
      }
      return [
        ...prev,
        {
          studentId: payload.studentId,
          name: payload.name ?? 'Học sinh',
          avatarColor: payload.avatarColor,
          isOnline: true,
          joinedAt: new Date().toISOString(),
        },
      ];
    });
    // REST refresh để đồng bộ data đầy đủ
    void sessionService.getPresence(info.sessionId).then((res) => { /* merge */ });
  }
  break;
}
```

> **Lưu ý race condition đã giải quyết:** Backend `PresenceEventListener` fires `student_presence` tại `SessionConnectEvent` — thời điểm này xảy ra TRƯỚC khi STOMP gửi CONNECTED frame về S2. Teacher/S1 nhận event và gửi offer vào `/user/queue/private` của S2, nhưng S2 chưa subscribe queue đó → offer bị **drop**. Fix: trong `onConnected` (sau khi subscription sẵn sàng), S2 chủ động gọi tất cả peer. Glare resolution (`rollback` nếu `have-local-offer`) xử lý PC stale của Teacher/S1.

### 7.3 Trường hợp Teacher

Teacher start session → không có ai trong presence list → không cần offer đến ai.  
Khi học sinh join lần lượt, mỗi học sinh sẽ chủ động offer đến teacher (qua `onConnected`). Teacher gọi `callPeer(studentId)` khi nhận `student_presence` joined event để đảm bảo cả hai chiều đều thử kết nối.

---

## 8. UI Components — Video Grid

### 8.1 VideoTile component

```tsx
// src/components/session/VideoTile.tsx

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  role: 'teacher' | 'student';
  avatarColor?: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isLocal?: boolean;   // true = local video (mirror)
  isFocused?: boolean; // true = spotlight frame
}

export function VideoTile({
  stream,
  name,
  role,
  avatarColor,
  isMuted,
  isCameraOff,
  isLocal,
  isFocused,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`video-tile ${isFocused ? 'video-tile--focused' : ''}`}>
      {isCameraOff || !stream ? (
        // Placeholder khi camera tắt
        <div
          className="video-tile__placeholder"
          style={{ backgroundColor: avatarColor ?? '#6366f1' }}
        >
          <span>{name.charAt(0).toUpperCase()}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // local video luôn muted để tránh echo
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }} // mirror
        />
      )}

      <div className="video-tile__info">
        <span className="video-tile__name">{isLocal ? 'Bạn' : name}</span>
        {role === 'teacher' && <span className="video-tile__badge">GV</span>}
        {isMuted && <MicOffIcon size={14} />}
      </div>
    </div>
  );
}
```

### 8.2 VideoGrid — Grid layout

```tsx
// src/components/session/VideoGrid.tsx

interface VideoGridProps {
  localStream: MediaStream | null;
  localUser: { name: string; role: 'teacher' | 'student'; avatarColor?: string };
  peers: PeerConnectionMap;
  peerInfoMap: Map<string, PeerInfo>; // peerId → name/role/avatarColor
  focusedPeerId: string | null;
  isMicOn: boolean;
  isCameraOn: boolean;
}

export function VideoGrid({
  localStream,
  localUser,
  peers,
  peerInfoMap,
  focusedPeerId,
  isMicOn,
  isCameraOn,
}: VideoGridProps) {
  const connectedPeers = Array.from(peers.values()).filter(
    (p) => p.state === 'connected' || p.state === 'connecting',
  );

  // Spotlight mode: hiển thị to 1 người, nhỏ còn lại
  if (focusedPeerId) {
    const focused = peers.get(focusedPeerId);
    const focusedInfo = peerInfoMap.get(focusedPeerId);

    return (
      <div className="video-grid video-grid--spotlight">
        {/* Màn hình to — người được focus */}
        {focused && focusedInfo && (
          <VideoTile
            stream={focused.remoteStream}
            name={focusedInfo.name}
            role={focusedInfo.role}
            avatarColor={focusedInfo.avatarColor}
            isCameraOff={focused.isCameraOff}
            isFocused
          />
        )}

        {/* Strip nhỏ ở dưới — các người còn lại */}
        <div className="video-grid__strip">
          <VideoTile
            stream={localStream}
            name={localUser.name}
            role={localUser.role}
            isLocal
            isMuted={!isMicOn}
            isCameraOff={!isCameraOn}
          />
          {connectedPeers
            .filter((p) => p.peerId !== focusedPeerId)
            .map((p) => {
              const info = peerInfoMap.get(p.peerId);
              return info ? (
                <VideoTile
                  key={p.peerId}
                  stream={p.remoteStream}
                  name={info.name}
                  role={info.role}
                  avatarColor={info.avatarColor}
                  isCameraOff={p.isCameraOff}
                />
              ) : null;
            })}
        </div>
      </div>
    );
  }

  // Grid mode: số cột dựa theo tổng số người
  const total = connectedPeers.length + 1; // +1 = local
  const cols = total <= 2 ? 2 : total <= 6 ? 3 : total <= 12 ? 4 : 5;

  return (
    <div
      className="video-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {/* Local video luôn đứng đầu */}
      <VideoTile
        stream={localStream}
        name={localUser.name}
        role={localUser.role}
        isLocal
        isMuted={!isMicOn}
        isCameraOff={!isCameraOn}
      />
      {connectedPeers.map((p) => {
        const info = peerInfoMap.get(p.peerId);
        return info ? (
          <VideoTile
            key={p.peerId}
            stream={p.remoteStream}
            name={info.name}
            role={info.role}
            avatarColor={info.avatarColor}
            isCameraOff={p.isCameraOff}
          />
        ) : null;
      })}
    </div>
  );
}
```

### 8.3 CSS Grid

```css
/* video-grid.css */

.video-grid {
  display: grid;
  gap: 8px;
  width: 100%;
  height: 100%;
}

.video-grid--spotlight {
  display: flex;
  flex-direction: column;
}

.video-grid--spotlight .video-tile--focused {
  flex: 1;
  min-height: 0;
}

.video-grid__strip {
  display: flex;
  gap: 8px;
  height: 120px;
  overflow-x: auto;
}

.video-tile {
  position: relative;
  background: #1e1e2e;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.video-tile video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-tile__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
}

.video-tile__info {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  font-size: 0.75rem;
}

.video-tile__badge {
  background: #6366f1;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.6rem;
  text-transform: uppercase;
}
```

---

## 9. Focus / Spotlight Mode

Focus mode được kích hoạt bởi teacher qua event `focus_changed`.

```typescript
// Trong handleSessionEvent — case 'focus_changed'

case 'focus_changed': {
  const { focusedStudentId } = payload as { focusedStudentId: string | null };
  setFocusedPeerId(focusedStudentId); // null = trở về grid view
  break;
}
```

```tsx
// Teacher controls — nút focus/unfocus

function StudentThumbnail({ student, isFocused, onFocus, onUnfocus }) {
  return (
    <div className="student-thumbnail">
      <VideoTile ... />
      <button
        onClick={() => isFocused ? onUnfocus() : onFocus(student.id)}
        title={isFocused ? 'Bỏ spotlight' : 'Spotlight học sinh này'}
      >
        {isFocused ? <PinOffIcon /> : <PinIcon />}
      </button>
    </div>
  );
}

// Gửi focus event qua STOMP
function focusStudent(studentId: string | null) {
  stompClient?.publish({
    destination: `/app/session/${sessionId}/focus`,
    body: JSON.stringify({ studentId }),
  });
  // Server sẽ broadcast focus_changed đến tất cả
  // → cả teacher và student cùng cập nhật focusedPeerId
}
```

> **Lưu ý:** Khi teacher focus một học sinh, **toàn bộ participant** đều nhận event `focus_changed` và chuyển layout — không chỉ riêng teacher. Layout đồng bộ trên tất cả màn hình.

---

## 10. Xử lý Breakout Rooms

Khi breakout bắt đầu, học sinh được chia vào các phòng nhỏ. Video call **trong breakout** vẫn dùng WebRTC mesh — nhưng chỉ kết nối với người trong cùng phòng.

### 10.1 Khi breakout_started

```typescript
case 'breakout_started': {
  const { breakoutSessionId, rooms } = payload as BreakoutStartedPayload;

  // Tìm phòng của mình
  const myRoom = rooms.find((r) => r.studentIds.includes(myUserId));
  if (!myRoom) break; // teacher không bị assign vào phòng

  // 1. Đóng tất cả connections hiện tại (main session peers)
  closeAllPeers();

  // 2. Subscribe STOMP topic của phòng nhỏ
  const roomSub = stompClient?.subscribe(
    `/topic/session/${sessionId}/room/${myRoom.id}`,
    (msg) => { /* handle room events */ },
  );
  setCurrentRoomSub(roomSub);
  setCurrentRoomId(myRoom.id);

  // 3. Lấy danh sách thành viên trong phòng (từ breakout data)
  const roommates = myRoom.studentIds.filter((id) => id !== myUserId);

  // 4. Offer đến từng người trong phòng
  // Dùng setTimeout nhỏ để đảm bảo họ đã kịp subscribe /user/queue/private
  setTimeout(async () => {
    for (const peerId of roommates) {
      await callPeer(peerId);
    }
  }, 500);

  break;
}
```

> **Vấn đề race condition trong breakout:** Tất cả học sinh nhận `breakout_started` cùng lúc, cùng offer lẫn nhau → glare.  
> **Giải pháp:** Dùng "polite peer" — học sinh có UUID nhỏ hơn (lexicographic) sẽ là người offer, người còn lại chờ.

```typescript
// Trong breakout, thay vì offer tất cả:
for (const peerId of roommates) {
  if (myUserId < peerId) {
    // Ta là người có UUID nhỏ hơn → ta offer
    await callPeer(peerId);
  }
  // Nếu myUserId > peerId → đợi họ offer đến ta
}
```

### 10.2 Khi breakout_ended

```typescript
case 'breakout_ended': {
  // 1. Đóng tất cả breakout room connections
  closeAllPeers();

  // 2. Unsubscribe room topic
  currentRoomSub?.unsubscribe();
  setCurrentRoomId(null);

  // 3. Reconnect với tất cả người trong main session
  const presence = await api.get(`/sessions/${sessionId}/presence`);
  const onlineUsers = presence.data.data.filter(
    (p: PresenceDto) => p.isOnline && p.studentId !== myUserId,
  );
  for (const user of onlineUsers) {
    await callPeer(user.studentId);
  }

  break;
}
```

---

## 11. Error Handling & Edge Cases

### 11.1 ICE Connection Failed

```typescript
pc.onconnectionstatechange = () => {
  if (pc.connectionState === 'failed') {
    // Thử ICE restart (trao đổi lại candidates)
    pc.restartIce();

    // Nếu sau 10 giây vẫn failed → đóng và thông báo
    setTimeout(() => {
      if (pc.connectionState === 'failed') {
        closePeer(peerId);
        showToast(`Mất kết nối video với ${peerName}. Họ có thể đã thoát.`);
      }
    }, 10_000);
  }
};
```

### 11.2 ICE Candidates đến trước Remote Description

`RTCPeerConnection` **không** tự buffer candidates trong mọi trình duyệt — Safari đặc biệt throw error khi `addIceCandidate` được gọi trước `setRemoteDescription`. Implement manual buffer:

```typescript
// useWebRTC.ts — iceBuf: Map<peerId, RTCIceCandidateInit[]>

case 'webrtc_ice_candidate': {
  const entry = pcsRef.current.get(fromId);
  if (!entry || entry.pc.connectionState === 'closed') return;

  if (!entry.pc.remoteDescription) {
    // Buffer lại, drain sau setRemoteDescription
    const buf = iceBuf.current.get(fromId) ?? [];
    buf.push(candidate);
    iceBuf.current.set(fromId, buf);
    return;
  }

  try {
    await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
    // stale/invalid candidate — bỏ qua
  }
  break;
}

// Gọi drainIceBuf(peerId, pc) ngay sau mỗi setRemoteDescription:
async function drainIceBuf(peerId: string, pc: RTCPeerConnection) {
  const buf = iceBuf.current.get(peerId);
  if (!buf?.length) return;
  iceBuf.current.set(peerId, []);
  for (const c of buf) {
    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
  }
}
```

### 11.3 Peer reconnect sau mất mạng

```typescript
// Khi STOMP reconnect (onDisconnect → lấy ticket mới → reconnect):
client.onDisconnect = async () => {
  // Đóng tất cả P2P connections (chúng cũng đã gián đoạn)
  closeAllPeers();
};

client.onConnect = async () => {
  // Re-init WebRTC sau khi STOMP reconnect
  await initWebRTC(sessionId);
};
```

### 11.4 Trình duyệt không hỗ trợ WebRTC

```typescript
function checkWebRTCSupport(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

// Trong LiveSession — trước khi khởi tạo
if (!checkWebRTCSupport()) {
  showError('Trình duyệt không hỗ trợ video call. Dùng Chrome 90+ hoặc Firefox 85+.');
  return;
}
```

### 11.5 User thay đổi camera/mic trong khi đang call

```typescript
// Thay track trên tất cả PeerConnections đang active
async function replaceVideoTrack(newTrack: MediaStreamTrack) {
  const promises = Array.from(pcsRef.current.values()).map(({ pc }) => {
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    return sender?.replaceTrack(newTrack);
  });
  await Promise.all(promises.filter(Boolean));
}
```

---

## 12. Cleanup

Quan trọng: cleanup đúng cách khi rời session để tránh memory leak và camera LED vẫn sáng sau khi thoát.

```typescript
// Trong LiveSession.tsx — useEffect cleanup

useEffect(() => {
  return () => {
    // 1. Đóng tất cả P2P connections
    closeAllPeers();

    // 2. Dừng local media tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // 3. Disconnect STOMP (đã có trong session context)
    // stompClient?.deactivate();
  };
}, []);
```

---

## 13. Checklist tích hợp

Trước khi demo hoặc test:

- [ ] `getUserMedia` được gọi trước khi connect WS (trong init) — không gọi sau khi WS connected để đảm bảo `localStreamRef` sẵn sàng khi offer đến
- [ ] Local video dùng `muted` để tránh echo
- [ ] Local video dùng `transform: scaleX(-1)` (mirror) cho tự nhiên
- [ ] Student gọi `callPeer` trong **`onConnected` callback** (không phải ngay sau REST join) — đảm bảo STOMP subscription sẵn sàng nhận offer trước khi initiating
- [ ] Khi nhận `student_presence` action='joined', student dùng polite-peer (UUID nhỏ hơn offer) cho peer join SAU mình; **không** áp dụng cho các peer đã online trước (handled in `onConnected`)
- [ ] Manual ICE candidate buffer (`iceBuf`) — `drainIceBuf` sau `setRemoteDescription`, không dùng direct `addIceCandidate` khi `!remoteDescription`
- [ ] Glare handling: rollback `have-local-offer` trước khi `setRemoteDescription` với offer mới
- [ ] ICE server credentials không để hardcode trong production — load từ env (`VITE_TURN_HOST`)
- [ ] Cleanup `RTCPeerConnection.close()` và `track.stop()` khi unmount
- [ ] `video.srcObject = stream` trong `useEffect`, không dùng URL.createObjectURL
- [ ] Test với 2 tab trên cùng máy (localhost) trước khi test qua LAN/internet
- [ ] Kiểm tra trình duyệt: Chrome 90+, Firefox 85+, Edge 90+, Safari 15+ (Safari cần `playsInline`)

### Debug tips

```typescript
// Log ICE candidate types để diagnose connectivity
pc.onicecandidate = (e) => {
  if (e.candidate) {
    console.debug(`[ICE] ${peerId}: ${e.candidate.type} ${e.candidate.protocol}`);
    // type = 'host' | 'srflx' (STUN) | 'relay' (TURN)
    // Nếu chỉ thấy 'host' mà không connect được → STUN/TURN có vấn đề
  }
};

// Xem trạng thái ICE gathering
pc.onicegatheringstatechange = () => {
  console.debug(`[ICE gathering] ${peerId}: ${pc.iceGatheringState}`);
};

// Chrome DevTools: chrome://webrtc-internals — xem SDP và stats realtime
```

---

## Luồng đầy đủ (tóm tắt)

```
Teacher start session
  └── sessionService.start() → wsTicket → connect STOMP
      └── onConnected:
            startMedia() → camera/mic
            GET /presence → [] (chưa ai online)
            → Không offer đến ai; chờ HS offer đến

Student 1 (S1) join
  └── sessionService.join() → wsTicket → startMedia() → connect STOMP
      ├── Backend fires student_presence { action:'joined', name:'S1' }
      │     → Teacher nhận event → callPeer(S1) → offer → /user/queue/private của S1
      │     [nhưng S1 chưa subscribe!  offer bị DROP]
      │
      └── onConnected (S1 đã subscribe):
            GET /presence → [teacher]
            callPeer(teacher) → offer → Teacher nhận
            → Teacher: setRemoteDescription + answer
            → ICE negotiation → connected
            → S1 thấy video Teacher ✓

Student 2 (S2) join
  └── sessionService.join() → wsTicket → startMedia() → connect STOMP
      ├── Backend fires student_presence { action:'joined', name:'S2' }
      │     → Teacher nhận → callPeer(S2) → offer → DROP (S2 chưa subscribe)
      │     → S1 nhận → callPeer(S2) theo polite-peer nếu S1.uuid < S2.uuid → DROP
      │
      └── onConnected (S2 đã subscribe):
            GET /presence → [teacher, S1]  (isOnline=true — backend fix @JsonProperty)
            callPeer(teacher):
              → Teacher có stale have-local-offer PC
              → Teacher nhận offer → rollback stale offer → xử lý S2's offer → answer
              → connected ✓
            callPeer(S1):
              → S1 có stale PC (nếu đã offer) hoặc không (nếu polite-peer skip)
              → S1 nhận offer → rollback/xử lý → answer
              → connected ✓
            → S2 thấy video Teacher và S1 ✓

Student1 leave (đóng tab / mất mạng)
  └── Server: updateLeftAt, Redis SREM
      → broadcast student_presence { action:'left', studentId:S1 }
  └── Teacher + S2: closePeer(S1)
      → Video grid cập nhật ✓
```

> **Điểm mấu chốt:** `isOnline` trong JSON response từ `/presence` trước đây bị serialize thành `"online"` do Jackson strips `is` prefix khỏi boolean getter. Sau fix `@JsonProperty("isOnline")` trong `PresenceDto.java`, frontend đọc đúng → `filter(p => p.isOnline)` trả về danh sách đầy đủ → S2's `onConnected` loop gọi được S1.
