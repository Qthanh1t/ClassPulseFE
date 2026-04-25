# ClassPulse — Realtime Architecture

> **Note:** WebSocket event contract (payload schema) → [03_API_Design.md → Module 15](03_API_Design.md).  
> File này tập trung vào **implementation** — Spring STOMP, Redis Pub/Sub, WebRTC signaling, Timer.

---

## 1. Tổng quan Realtime Stack

```
Browser ──WebSocket/STOMP──► Spring WebSocket Broker ──► Redis Pub/Sub ──► Other Spring instances
Browser ──WebRTC (P2P)─────► Coturn TURN/STUN (relay)
```

| Kênh | Công nghệ | Dùng cho |
|------|-----------|---------|
| **Control events** | WebSocket + STOMP | Question lifecycle, breakout, focus, raise hand, presence |
| **Chat** | WebSocket + STOMP | Tin nhắn text realtime |
| **Video/Audio** | WebRTC | Stream media peer-to-peer (với TURN relay) |
| **WebRTC Signaling** | WebSocket (qua STOMP) | offer/answer/ICE candidate exchange |

---

## 2. WebSocket — Spring STOMP Architecture

### Tại sao STOMP thay vì raw WebSocket?
- **Topic subscriptions:** Client subscribe theo `destination` (e.g., `/topic/session/uuid`) — Spring tự route, không cần custom dispatcher
- **Built-in security:** Spring Security tích hợp trực tiếp với STOMP handshake
- **Horizontal scale:** Dễ dùng Redis message broker relay cho multi-instance

### STOMP Destinations

```
/topic/session/{sessionId}          → broadcast đến tất cả participants
/topic/session/{sessionId}/room/{roomId} → broadcast đến 1 breakout room
/user/queue/private                 → gửi riêng đến 1 user (GV → HS cụ thể)
/app/session/{sessionId}/send       → client gửi message đến server (prefix /app)
```

### Spring WebSocket Config

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Dùng Redis relay broker thay vì in-memory (để scale horizontal)
        registry.enableStompBrokerRelay("/topic", "/queue")
                .setRelayHost("localhost")
                .setRelayPort(61613)          // Redis STOMP port qua stomp-broker-relay
                .setClientLogin("guest")
                .setClientPasscode("guest");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setHandshakeHandler(new JwtHandshakeHandler())  // auth tại WS handshake
                .setAllowedOriginPatterns("http://localhost:5173", "https://classpulse.app")
                .withSockJS();                // fallback cho browser không hỗ trợ WS native
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new JwtChannelInterceptor());  // validate JWT tại mỗi message
    }
}
```

### JWT Authentication tại WebSocket Handshake

```java
public class JwtHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request,
                                      WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        // 1. Lấy wsTicket từ query param: /ws?ticket=abc123
        String ticket = extractTicket(request);

        // 2. Validate ticket trong Redis (one-time use)
        String userId = redisTemplate.opsForValue().getAndDelete("ws_ticket:" + ticket);
        if (userId == null) throw new IllegalArgumentException("Invalid or expired WS ticket");

        // 3. Load user và set vào attributes cho các handler sau
        UserDetails user = userService.loadById(UUID.fromString(userId));
        attributes.put("userId", userId);
        attributes.put("userRole", user.getRole());
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }
}
```

### Session Event Broadcast (Server → All)

```java
@Service
@RequiredArgsConstructor
public class SessionBroadcastService {

    private final SimpMessagingTemplate messagingTemplate;

    public void broadcastQuestionStarted(String sessionId, QuestionStartedEvent event) {
        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId,
            Map.of("type", "question_started", "payload", event)
        );
    }

    public void sendToTeacher(String teacherId, Object event) {
        messagingTemplate.convertAndSendToUser(
            teacherId, "/queue/private",
            event
        );
    }

    public void broadcastToRoom(String sessionId, String roomId, Object event) {
        messagingTemplate.convertAndSend(
            "/topic/session/" + sessionId + "/room/" + roomId,
            event
        );
    }
}
```

---

## 3. Redis Pub/Sub cho Horizontal Scaling

Khi deploy nhiều instance Spring Boot (load balancer), mỗi WS connection chỉ thuộc về 1 instance. Redis pub/sub đảm bảo event được fan-out đến tất cả instances.

```
Instance A (GV connected) ──publish──► Redis Channel: session:uuid
                                                ↓ subscribe
                          Instance B (HS1 connected) → gửi WS đến HS1
                          Instance C (HS2 connected) → gửi WS đến HS2
```

### Redis Realtime State

| Key | Type | TTL | Nội dung |
|-----|------|-----|---------|
| `ws_ticket:{ticket}` | String | 60s | userId (one-time use) |
| `session:{id}:presence` | Set | session duration | Set<userId> đang online |
| `session:{id}:raised_hands` | Set | session duration | Set<userId> đang giơ tay |
| `session:{id}:active_question` | String | 5 min | questionId đang running |
| `session:{id}:question:{qid}:answered` | Set | 5 min | Set<userId> đã trả lời |

### Presence Tracking

```java
@EventListener
public void handleConnect(SessionConnectedEvent event) {
    StompHeaderAccessor sha = StompHeaderAccessor.wrap(event.getMessage());
    String userId = (String) sha.getSessionAttributes().get("userId");
    String sessionId = resolveSessionId(sha);

    redisTemplate.opsForSet().add("session:" + sessionId + ":presence", userId);
    broadcastService.broadcastToSession(sessionId,
        Map.of("type", "student_presence", "payload",
               Map.of("studentId", userId, "action", "joined")));
}

@EventListener
public void handleDisconnect(SessionDisconnectEvent event) {
    // tương tự — remove từ Set, broadcast "left"
}
```

---

## 4. Authoritative Question Timer

Timer chạy phía server (không tin client). Khi GV start câu hỏi:

```java
@Service
@RequiredArgsConstructor
public class QuestionTimerService {

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final Map<UUID, ScheduledFuture<?>> activeTimers = new ConcurrentHashMap<>();

    public void startTimer(UUID questionId, int timerSeconds, String sessionId) {
        ScheduledFuture<?> future = scheduler.schedule(() -> {
            questionService.autoEndQuestion(questionId);  // đổi status → ended
            broadcastService.broadcastQuestionEnded(sessionId, questionId);
            activeTimers.remove(questionId);
        }, timerSeconds, TimeUnit.SECONDS);

        activeTimers.put(questionId, future);
    }

    public void cancelTimer(UUID questionId) {
        ScheduledFuture<?> future = activeTimers.remove(questionId);
        if (future != null) future.cancel(false);
    }
}
```

`endsAt = now() + timerSeconds` được ghi vào DB và gửi xuống client. Client countdown từ `endsAt`, không cần sync thêm.

---

## 5. Silent Student Detection

```java
@Scheduled(fixedDelay = 10_000)  // chạy mỗi 10s
public void detectSilentStudents() {
    // Lấy tất cả session đang active
    List<String> activeSessions = sessionRepository.findActiveSessionIds();

    for (String sessionId : activeSessions) {
        String activeQuestionId = redisTemplate.opsForValue()
                                               .get("session:" + sessionId + ":active_question");
        if (activeQuestionId == null) continue;

        Set<String> present = redisTemplate.opsForSet().members("session:" + sessionId + ":presence");
        Set<String> answered = redisTemplate.opsForSet()
                                            .members("session:" + sessionId + ":question:" + activeQuestionId + ":answered");

        Set<String> silent = new HashSet<>(present);
        silent.removeAll(answered);

        if (!silent.isEmpty()) {
            broadcastService.sendToTeacher(
                sessionRepository.findTeacherId(sessionId),
                Map.of("type", "silent_alert", "payload", Map.of("silentStudentIds", silent))
            );
        }
    }
}
```

---

## 6. WebRTC Architecture

### Topology: Mesh (P2P) — đủ cho ≤ 30 người

Với lớp học ≤ 30 HS, **Mesh P2P** (mỗi client kết nối trực tiếp với nhau) là giải pháp đơn giản nhất, không cần SFU server.

```
GV ─────────────── HS1
│  ╲               │
│   ╲              │
│    ╲─────────── HS2
│                  │
└──────────────── HS3
```

> **Lưu ý về scale:** Nếu sau này cần > 30 người hoặc muốn tiết kiệm bandwidth, có thể thêm [mediasoup](https://mediasoup.org/) SFU mà không thay đổi signaling protocol.

### Signaling Flow (qua WebSocket/STOMP)

```
GV Browser                    Spring Server                   HS Browser
    │                               │                               │
    │── webrtc_offer {targetId:HS} ─►│                               │
    │                               │── forward to HS ─────────────►│
    │                               │                               │
    │                               │◄── webrtc_answer {targetId:GV}─│
    │◄── forward to GV ─────────────│                               │
    │                               │                               │
    │── webrtc_ice_candidate ───────►│── forward to HS ─────────────►│
    │◄─ webrtc_ice_candidate ────────│◄─────────────────────────────│
    │                               │                               │
    │═══════════════════════════════════ WebRTC P2P connected ══════│
    │                               │ (media bypasses server)       │
```

### WebRTC Signaling Controller

```java
@Controller
@RequiredArgsConstructor
public class WebRtcSignalingController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/session/{sessionId}/webrtc/offer")
    public void handleOffer(@Payload WebRtcOfferDto dto,
                            @DestinationVariable String sessionId,
                            Principal principal) {
        // Forward offer đến target user
        messagingTemplate.convertAndSendToUser(
            dto.getTargetId(), "/queue/private",
            Map.of("type", "webrtc_offer",
                   "payload", Map.of("fromId", principal.getName(), "sdp", dto.getSdp()))
        );
    }

    @MessageMapping("/session/{sessionId}/webrtc/answer")
    public void handleAnswer(@Payload WebRtcAnswerDto dto,
                             @DestinationVariable String sessionId,
                             Principal principal) {
        messagingTemplate.convertAndSendToUser(
            dto.getTargetId(), "/queue/private",
            Map.of("type", "webrtc_answer",
                   "payload", Map.of("fromId", principal.getName(), "sdp", dto.getSdp()))
        );
    }

    @MessageMapping("/session/{sessionId}/webrtc/ice-candidate")
    public void handleIce(@Payload WebRtcIceDto dto,
                          @DestinationVariable String sessionId,
                          Principal principal) {
        messagingTemplate.convertAndSendToUser(
            dto.getTargetId(), "/queue/private",
            Map.of("type", "webrtc_ice_candidate",
                   "payload", Map.of("fromId", principal.getName(), "candidate", dto.getCandidate()))
        );
    }
}
```

### Coturn Configuration (TURN/STUN Server)

```conf
# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
realm=classpulse.app
server-name=turn.classpulse.app
lt-cred-mech
user=classpulse:secret123
fingerprint
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255  # block internal IPs
```

Frontend cấu hình ICE servers:
```typescript
const peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:turn.classpulse.app:3478' },
    {
      urls: 'turn:turn.classpulse.app:3478',
      username: 'classpulse',
      credential: 'secret123'
    }
  ]
});
```

---

## 7. Frontend WebSocket Client (React)

```typescript
// hooks/useSessionSocket.ts
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export function useSessionSocket(sessionId: string, wsTicket: string) {
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
      connectHeaders: { ticket: wsTicket },
      reconnectDelay: 3000,
      onConnect: () => {
        // Subscribe to session events
        client.subscribe(`/topic/session/${sessionId}`, (msg) => {
          const event = JSON.parse(msg.body);
          handleSessionEvent(event);
        });

        // Subscribe to private messages
        client.subscribe('/user/queue/private', (msg) => {
          const event = JSON.parse(msg.body);
          handlePrivateEvent(event);
        });
      },
      onDisconnect: () => console.log('WS disconnected'),
    });

    client.activate();
    clientRef.current = client;
    return () => client.deactivate();
  }, [sessionId, wsTicket]);

  const send = (destination: string, body: object) => {
    clientRef.current?.publish({
      destination: `/app${destination}`,
      body: JSON.stringify(body)
    });
  };

  return { send };
}
```
