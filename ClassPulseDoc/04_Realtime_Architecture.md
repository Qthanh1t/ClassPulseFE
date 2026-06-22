# ClassPulse — Realtime Architecture

> **Note:** WebSocket event contract (payload schema) → [03_API_Design.md → Module 15](03_API_Design.md).  
> File này tập trung vào **implementation** — Spring STOMP, Redis Pub/Sub, LiveKit SFU (media), Timer.

---

## 1. Tổng quan Realtime Stack

```
Browser ──WebSocket/STOMP──► Spring WebSocket Broker ──► Redis Pub/Sub ──► Other Spring instances
Browser ──WebRTC media─────► LiveKit SFU (publish/subscribe tracks)
```

| Kênh | Công nghệ | Dùng cho |
|------|-----------|---------|
| **Control events** | WebSocket + STOMP | Question lifecycle, breakout, focus, raise hand, presence |
| **Chat** | WebSocket + STOMP | Tin nhắn text realtime |
| **Video/Audio** | LiveKit SFU (WebRTC) | Client publish track lên SFU; server forward (selective) tới subscriber |
| **Media signaling** | LiveKit (nội bộ) | SDP/ICE do LiveKit client SDK ↔ server tự xử lý; STOMP không tham gia |

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

## 6. Video/Audio Architecture — LiveKit SFU

### Topology: SFU (Selective Forwarding Unit)

Media video/audio chạy trên **LiveKit SFU**. Mỗi client **publish** track (camera/mic/screen-share) **một lần** lên LiveKit server; server **forward** (selective) tới các client subscribe. Khác mesh P2P (mỗi client phải mở N-1 kết nối và encode video N-1 lần), SFU giữ upload của mỗi client cố định ở 1 stream bất kể số người trong phòng → scale tốt cho lớp 30 HS.

```
   publish 1 lần                 forward selective
HS1 ──────────────►┐            ┌──────────────► GV
HS2 ──────────────►│  LiveKit   │──────────────► HS1
GV  ──────────────►│    SFU     │──────────────► HS2
                   └────────────┘
   (mỗi client upload 1 stream, không phụ thuộc số người)
```

> **Scale:** LiveKit hỗ trợ `adaptiveStream` (tự giảm/ngừng nhận video của tile không hiển thị) và `dynacast` (server ngừng forward layer không ai xem) — giảm mạnh bandwidth khi lớp đông. Tầng STOMP nghiệp vụ không đổi khi scale media.

### Phòng (Room) & ánh xạ breakout

- Mỗi phiên học = một LiveKit **room** tên `session-{sessionId}` (phòng chính).
- Breakout = **đổi room**: client `connect` tới `session-{sessionId}-room-{breakoutRoomId}`; kết thúc breakout → về `session-{sessionId}`.
- **Cách ly media theo phòng do room name của LiveKit quyết định**, không phải STOMP. STOMP chỉ phát event "ai vào phòng nào" (`breakout_started`, `teacher_joined_room`, …); client đọc event để biết cần connect tới room LiveKit nào.
- `participant.identity = userId` → map participant LiveKit ↔ presence STOMP (tên/màu avatar lấy từ presence, không nhồi vào token).
- **Spotlight/Focus** trong phòng chính chỉ là **đổi layout UI** (phóng to tile HS được focus) — `focus_changed` qua STOMP, media không đổi room.

### Token Endpoint (Backend)

LiveKit token là JWT ký bằng `LIVEKIT_API_SECRET`, chứa video grant. Backend chỉ **cấp token** — không nằm trên đường truyền media.

```java
@RestController
@RequiredArgsConstructor
public class LiveKitTokenController {

    @Value("${livekit.api-key}")    private String apiKey;
    @Value("${livekit.api-secret}") private String apiSecret;
    @Value("${livekit.url}")        private String livekitUrl;

    @PostMapping("/api/v1/sessions/{sessionId}/livekit-token")
    public ApiResponse<LiveKitTokenDto> token(@PathVariable String sessionId,
                                              @RequestBody(required = false) TokenRequest req,
                                              @AuthenticationPrincipal UserPrincipal user) {
        // Kiểm tra user thuộc session trước khi cấp token
        String room = (req != null && req.roomName() != null)
                ? req.roomName() : "session-" + sessionId;

        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setIdentity(user.getId());            // identity = userId → map với presence STOMP
        token.setName(user.getName());
        token.addGrants(new RoomJoin(true), new RoomName(room));
        // canPublish = true, canSubscribe = true

        return ApiResponse.ok(new LiveKitTokenDto(token.toJwt(), livekitUrl, user.getId()));
    }
}
```

Media signaling (SDP offer/answer, ICE) **do LiveKit client SDK ↔ LiveKit server tự xử lý** — Spring và STOMP **không** trung chuyển SDP/ICE.

### LiveKit Server Deployment

LiveKit chạy như service riêng (Docker hoặc binary native), không qua Spring:

```yaml
# livekit.yaml
port: 7880
rtc:
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true        # quan trọng khi client ở thiết bị/LAN khác
keys:
  <API_KEY>: <API_SECRET>
```

> **Đa thiết bị LAN:** đặt `node_ip` / `use_external_ip` theo IP máy host để client thiết bị khác route tới được. Cùng LAN, STUN nội bộ của LiveKit là đủ — không bắt buộc TURN riêng.

Frontend chỉ cần URL + token (LiveKit SDK lo phần còn lại):
```typescript
import { Room } from 'livekit-client';

const room = new Room({ adaptiveStream: true, dynacast: true });
await room.connect(livekitUrl, token);   // token từ POST /sessions/{id}/livekit-token
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
