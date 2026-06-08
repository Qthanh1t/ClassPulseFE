import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { IMessage, StompSubscription } from '@stomp/stompjs';

// ── Event types ────────────────────────────────────────────────────

export type WsEventType =
  | 'student_presence'
  | 'session_started'
  | 'session_ended'
  | 'question_started'
  | 'question_ended'
  | 'raise_hand_changed'
  | 'focus_changed'
  | 'breakout_started'
  | 'breakout_ended'
  | 'broadcast_message'
  | 'chat_message'
  | 'answer_aggregate'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice_candidate'
  | 'teacher_joined_room'
  | 'teacher_left_room'
  | 'camera_state_changed';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
}

export type WsEventHandler = (event: WsEvent) => void;

// ── Client interface ───────────────────────────────────────────────

export interface SessionWsClient {
  subscribe: (handler: WsEventHandler) => void;
  subscribeRoom: (roomId: string, handler: WsEventHandler) => void;
  unsubscribeRoom: (roomId: string) => void;
  sendChat: (content: string, breakoutRoomId?: string | null) => void;
  sendRaiseHand: (raised: boolean) => void;
  sendFocus: (studentId: string | null) => void;
  sendWebRtcOffer: (targetId: string, sdp: string) => void;
  sendWebRtcAnswer: (targetId: string, sdp: string) => void;
  sendWebRtcIceCandidate: (targetId: string, candidate: RTCIceCandidate) => void;
  sendCameraState: (isCameraOff: boolean) => void;
  disconnect: () => void;
}

// ── Factory ────────────────────────────────────────────────────────

export function createSessionWsClient(
  wsTicket: string,
  sessionId: string,
  /**
   * Called on WebSocket close (network drop or disconnect) to obtain a fresh one-time ticket.
   * Teacher: call POST /auth/ws-ticket
   * Student: call POST /sessions/{id}/join
   */
  onReconnect: () => Promise<string>,
  /** Called once STOMP subscriptions are ready — use to kick off WebRTC init */
  onConnected?: () => void,
): SessionWsClient {
  let mainHandler: WsEventHandler | null = null;
  const roomHandlers = new Map<string, WsEventHandler>();
  const roomSubs = new Map<string, StompSubscription>();
  let hbInterval: ReturnType<typeof setInterval> | null = null;

  // Track session subscriptions to prevent duplicates on STOMP reconnect
  let sessionSub: StompSubscription | null = null;
  let privateSub: StompSubscription | null = null;

  // Mutable ticket — updated before each reconnect attempt
  let currentTicket = wsTicket;
  // Set to true when disconnect() is called intentionally — suppresses reconnect ticket refresh
  let deactivating = false;

  const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:8080/ws';

  const client = new Client({
    // Factory is called fresh for every (re)connect — picks up latest currentTicket
    webSocketFactory: () => new SockJS(`${WS_URL}?ticket=${encodeURIComponent(currentTicket)}`),
    reconnectDelay: 5000,

    onConnect: () => {
      // Unsubscribe existing before resubscribing — prevents duplicate event delivery on reconnect
      sessionSub?.unsubscribe();
      privateSub?.unsubscribe();

      sessionSub = client.subscribe(`/topic/session/${sessionId}`, (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Subscribe unicast (answer_aggregate, webrtc signals)
      privateSub = client.subscribe('/user/queue/private', (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Heartbeat every 25s to keep presence alive
      if (hbInterval !== null) clearInterval(hbInterval);
      hbInterval = setInterval(() => {
        if (client.connected) {
          client.publish({ destination: `/app/session/${sessionId}/heartbeat`, body: '{}' });
        }
      }, 25_000);

      // Notify caller that subscriptions are ready (used for WebRTC init)
      onConnected?.();
    },

    onWebSocketClose: () => {
      // Skip refresh on intentional disconnect
      if (deactivating) return;
      if (hbInterval !== null) {
        clearInterval(hbInterval);
        hbInterval = null;
      }
      // Refresh ticket asynchronously — STOMP waits reconnectDelay (5s) before retrying,
      // so the new ticket will be ready in time for the next webSocketFactory call.
      void onReconnect().then((ticket) => {
        currentTicket = ticket;
      }).catch(() => {
        // Keep current ticket; STOMP will retry with it
      });
    },
  });

  client.activate();

  return {
    subscribe(handler) {
      mainHandler = handler;
    },

    subscribeRoom(roomId, handler) {
      roomHandlers.set(roomId, handler);
      if (client.connected) {
        const sub = client.subscribe(
          `/topic/session/${sessionId}/room/${roomId}`,
          (msg: IMessage) => {
            const event = JSON.parse(msg.body) as WsEvent;
            handler(event);
          },
        );
        roomSubs.set(roomId, sub);
      }
    },

    unsubscribeRoom(roomId) {
      roomSubs.get(roomId)?.unsubscribe();
      roomSubs.delete(roomId);
      roomHandlers.delete(roomId);
    },

    sendChat(content, breakoutRoomId = null) {
      client.publish({
        destination: `/app/session/${sessionId}/chat`,
        body: JSON.stringify({ content, breakoutRoomId }),
      });
    },

    sendRaiseHand(raised) {
      client.publish({
        destination: `/app/session/${sessionId}/raise-hand`,
        body: JSON.stringify({ raised }),
      });
    },

    sendFocus(studentId) {
      client.publish({
        destination: `/app/session/${sessionId}/focus`,
        body: JSON.stringify({ studentId }),
      });
    },

    sendWebRtcOffer(targetId, sdp) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/offer`,
        body: JSON.stringify({ targetId, sdp }),
      });
    },

    sendWebRtcAnswer(targetId, sdp) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/answer`,
        body: JSON.stringify({ targetId, sdp }),
      });
    },

    sendWebRtcIceCandidate(targetId, candidate) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/ice-candidate`,
        body: JSON.stringify({ targetId, candidate }),
      });
    },

    sendCameraState(isCameraOff) {
      client.publish({
        destination: `/app/session/${sessionId}/camera-state`,
        body: JSON.stringify({ isCameraOff }),
      });
    },

    disconnect() {
      deactivating = true;
      if (hbInterval !== null) {
        clearInterval(hbInterval);
        hbInterval = null;
      }
      client.deactivate();
    },
  };
}

// ── App-level client ───────────────────────────────────────────────
// Connection cấp ứng dụng (không gắn với session nào): dùng để nhận push
// ngoài phiên học — ví dụ `session_started` / `session_ended` cho danh sách lớp,
// thay cho việc poll REST liên tục. Không có heartbeat presence (dựa vào STOMP
// heartbeat ở tầng giao thức); chỉ expose subscribe theo topic tùy ý.

export interface AppWsClient {
  /** Subscribe một STOMP destination (vd `/topic/classroom/{id}`). Trả về hàm unsubscribe. */
  subscribeTopic: (destination: string, handler: WsEventHandler) => () => void;
  disconnect: () => void;
}

export function createAppWsClient(
  wsTicket: string,
  /** Gọi khi WS đóng để lấy ticket mới (1 lần, TTL 60s) — thường là POST /auth/ws-ticket */
  onReconnect: () => Promise<string>,
): AppWsClient {
  // destination -> { handler, sub } — giữ lại để resubscribe sau mỗi lần reconnect
  const topics = new Map<string, { handler: WsEventHandler; sub: StompSubscription | null }>();

  let currentTicket = wsTicket;
  let deactivating = false;

  const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:8080/ws';

  const doSubscribe = (destination: string, handler: WsEventHandler): StompSubscription =>
    client.subscribe(destination, (msg: IMessage) => {
      const event = JSON.parse(msg.body) as WsEvent;
      handler(event);
    });

  const client = new Client({
    webSocketFactory: () => new SockJS(`${WS_URL}?ticket=${encodeURIComponent(currentTicket)}`),
    reconnectDelay: 5000,
    // STOMP-level heartbeat giữ kết nối sống mà không cần publish thủ công
    heartbeatIncoming: 25_000,
    heartbeatOutgoing: 25_000,

    onConnect: () => {
      // Resubscribe toàn bộ topic đã đăng ký (cả lần đầu lẫn sau reconnect)
      for (const [destination, entry] of topics) {
        entry.sub?.unsubscribe();
        entry.sub = doSubscribe(destination, entry.handler);
      }
    },

    onWebSocketClose: () => {
      if (deactivating) return;
      // Đánh dấu sub cũ là chết để onConnect tạo lại
      for (const entry of topics.values()) entry.sub = null;
      void onReconnect()
        .then((ticket) => { currentTicket = ticket; })
        .catch(() => { /* giữ ticket hiện tại; STOMP sẽ retry */ });
    },
  });

  client.activate();

  return {
    subscribeTopic(destination, handler) {
      // Ghi đè handler nếu subscribe lại cùng destination
      topics.get(destination)?.sub?.unsubscribe();
      const entry: { handler: WsEventHandler; sub: StompSubscription | null } = { handler, sub: null };
      if (client.connected) entry.sub = doSubscribe(destination, handler);
      topics.set(destination, entry);

      return () => {
        topics.get(destination)?.sub?.unsubscribe();
        topics.delete(destination);
      };
    },

    disconnect() {
      deactivating = true;
      for (const entry of topics.values()) entry.sub?.unsubscribe();
      topics.clear();
      client.deactivate();
    },
  };
}
