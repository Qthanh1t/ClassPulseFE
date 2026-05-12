import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { IMessage, StompSubscription } from '@stomp/stompjs';

// ── Event types ────────────────────────────────────────────────────

export type WsEventType =
  | 'student_presence'
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
  | 'teacher_left_room';

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
  disconnect: () => void;
}

// ── Factory ────────────────────────────────────────────────────────

export function createSessionWsClient(
  wsTicket: string,
  sessionId: string,
  /**
   * Called on disconnect to obtain a fresh one-time ticket.
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

  const client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    connectHeaders: { ticket: wsTicket },
    reconnectDelay: 5000,

    onConnect: () => {
      // Subscribe session broadcast topic
      client.subscribe(`/topic/session/${sessionId}`, (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Subscribe unicast (answer_aggregate, webrtc signals)
      client.subscribe('/user/queue/private', (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Heartbeat every 25s to keep presence alive
      hbInterval = setInterval(() => {
        if (client.connected) {
          client.publish({ destination: `/app/session/${sessionId}/heartbeat`, body: '{}' });
        }
      }, 25_000);

      // Notify caller that subscriptions are ready (used for WebRTC init)
      onConnected?.();
    },

    onDisconnect: async () => {
      if (hbInterval !== null) {
        clearInterval(hbInterval);
        hbInterval = null;
      }
      try {
        const newTicket = await onReconnect();
        client.connectHeaders = { ticket: newTicket };
      } catch {
        // STOMP will retry after reconnectDelay
      }
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

    disconnect() {
      if (hbInterval !== null) {
        clearInterval(hbInterval);
        hbInterval = null;
      }
      client.deactivate();
    },
  };
}
