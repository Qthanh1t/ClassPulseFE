# ClassPulse — Tài liệu giải thích toàn bộ hệ thống

> Tài liệu này giải thích kiến trúc và **luồng hoạt động chi tiết của từng tính năng**, đối chiếu code thật ở cả hai repo:
> - Frontend: `ClassPulseFE` (React 19 + TypeScript + Vite)
> - Backend: `classpulse` (Java Spring Boot)
>
> Mục tiêu: đọc xong hiểu được *tại sao* code viết như vậy, không chỉ *code làm gì*.

---

## Mục lục

1. [Kiến trúc tổng thể — 3 mặt phẳng](#1-kiến-trúc-tổng-thể--3-mặt-phẳng)
2. [Xác thực (Auth)](#2-xác-thực-auth)
3. [Tầng WebSocket / STOMP](#3-tầng-websocket--stomp)
4. [Video — LiveKit SFU](#4-video--livekit-sfu)
5. [Quản lý lớp học (Classroom)](#5-quản-lý-lớp-học-classroom)
6. [Upload file — MinIO presigned URL](#6-upload-file--minio-presigned-url)
7. [Vòng đời buổi học (Session)](#7-vòng-đời-buổi-học-session)
8. [Presence — ai đang online](#8-presence--ai-đang-online)
9. [Q&A — câu hỏi tương tác kèm confidence](#9-qa--câu-hỏi-tương-tác-kèm-confidence)
10. [Silent Student Detection](#10-silent-student-detection)
11. [Raise Hand — giơ tay](#11-raise-hand--giơ-tay)
12. [Live Chat](#12-live-chat)
13. [Breakout Rooms — chia nhóm](#13-breakout-rooms--chia-nhóm)
14. [Focus Mode — Spotlight 1-1](#14-focus-mode--spotlight-1-1)
15. [Broadcast — thông báo toàn lớp](#15-broadcast--thông-báo-toàn-lớp)
16. [Teacher Dashboard — tổng kết buổi học](#16-teacher-dashboard--tổng-kết-buổi-học)
17. [Student Review — ôn tập cá nhân](#17-student-review--ôn-tập-cá-nhân)
18. [Admin](#18-admin)
19. [Bảng tra cứu: sự kiện WS, REST API, DB schema](#19-bảng-tra-cứu)
20. [Các pattern kỹ thuật đáng chú ý](#20-các-pattern-kỹ-thuật-đáng-chú-ý)
21. [Triển khai production](#21-triển-khai-production)

---

## 1. Kiến trúc tổng thể — 3 mặt phẳng

Điểm cốt lõi để hiểu ClassPulse: **mọi thứ trong buổi học chạy trên 3 kênh độc lập nhau**, mỗi kênh có nhiệm vụ riêng và tự reconnect riêng:

```
┌──────────────────────────── Browser (React SPA) ────────────────────────────┐
│                                                                              │
│   1. REST (axios)          2. STOMP over SockJS         3. LiveKit SDK      │
│   dữ liệu, hành động       sự kiện realtime nghiệp vụ   video/audio (WebRTC)│
└──────┬─────────────────────────────┬──────────────────────────┬─────────────┘
       │ /api/v1/**                  │ /ws (ticket 1 lần)       │ wss + UDP/TCP media
       ▼                             ▼                          ▼
┌─────────────────────────────────────────────────┐   ┌──────────────────────┐
│              Spring Boot backend                │   │    LiveKit SFU       │
│  Controllers → Services → JPA (PostgreSQL)      │   │  (server media riêng)│
│  SimpMessagingTemplate → STOMP broker           │   └──────────────────────┘
│  Redis: ws ticket, presence set, active question│      ▲ token JWT do backend
└─────────────────────────────────────────────────┘        ký (LiveKitTokenService)
```

| Mặt phẳng | Công nghệ | Chở cái gì |
|---|---|---|
| **Data plane** | REST `/api/v1` (axios + Bearer JWT) | CRUD lớp/bài đăng/lịch, start/end session, tạo câu hỏi, nộp bài, dashboard… — mọi thứ cần ghi DB |
| **Event plane** | STOMP over SockJS `/ws` | Sự kiện realtime: presence, question_started/ended, chat, raise hand, breakout, focus… (14 loại — xem §19) |
| **Media plane** | LiveKit SFU (WebRTC) | Video, audio, screen share. Backend chỉ ký token; media đi thẳng browser ↔ LiveKit server |

Nguyên tắc phối hợp: **REST là hành động, STOMP là thông báo, LiveKit là hình/tiếng**. Ví dụ giáo viên bấm "Kết thúc câu hỏi" → gọi REST `POST /questions/{id}/end` → backend ghi DB → backend broadcast `question_ended` qua STOMP → mọi client cập nhật UI. LiveKit không biết gì về chuyện này.

Redis đứng giữa làm bộ nhớ realtime: WS ticket (TTL 60s), tập học sinh đang online per session, câu hỏi đang chạy, tập đã trả lời, tập đang giơ tay.

---

## 2. Xác thực (Auth)

### 2.1. Mô hình token

- **Access token**: JWT ngắn hạn, chứa `userId`, `role`, `name`. FE giữ **trong Zustand memory** (`store/authStore.ts`) — cố tình KHÔNG lưu localStorage để tránh XSS đánh cắp.
- **Refresh token**: chuỗi ngẫu nhiên, lưu DB (`refresh_tokens`), gửi cho browser dạng **httpOnly cookie** — JS không đọc được. Mỗi lần refresh backend **xoay vòng** (validateAndConsume → phát token mới), chống replay.

### 2.2. Luồng backend (`AuthService.java`)

- `register`: check email trùng (`EMAIL_TAKEN`) → BCrypt hash password → tạo user → trả access token + refresh cookie.
- `login`: tìm user theo email → check `isActive` (admin có thể khóa) → so BCrypt → phát cặp token.
- `refresh`: `RefreshTokenService.validateAndConsume(raw)` — token cũ bị tiêu hủy, phát token mới (rotation) → phát access token mới kèm thông tin user.
- `logout`: revoke refresh token trong DB.

### 2.3. Luồng frontend (`lib/api.ts` + `App.tsx`)

1. **Request interceptor**: gắn `Authorization: Bearer <token>` từ Zustand vào mọi request.
2. **Response interceptor — silent refresh với queue pattern**: gặp 401 (và không phải chính request `/auth/refresh` — guard chống retry loop):
   - Nếu chưa có refresh đang chạy → gọi `POST /auth/refresh` (cookie tự gửi kèm nhờ `withCredentials: true`) → lưu token + user mới → retry request gốc.
   - Nếu **đang** có refresh chạy → request xếp hàng vào `queue`, chờ token mới rồi retry. Nhờ vậy 5 request cùng dính 401 chỉ trigger **1** lần refresh.
   - Refresh thất bại → `clearAuth()` → ProtectedRoute đá về `/login`.
3. **AuthBootstrap** (`App.tsx`): khi app mount, gọi `authService.refresh()` một lần — nếu cookie còn hạn thì khôi phục session (user F5 trang không bị văng), hiện `<Spin>` toàn trang trong lúc chờ.
4. **ProtectedRoute**: sau bootstrap mà `user === null` → redirect `/login`.
5. `main.tsx` gọi `injectAuthHooks(...)` **trước khi render** để interceptor có sẵn getter/setter của store (tránh circular import giữa api.ts và authStore).

---

## 3. Tầng WebSocket / STOMP

### 3.1. Vấn đề: xác thực WebSocket như thế nào?

Không thể gắn header Authorization vào SockJS handshake (browser không cho), và STOMP `connectHeaders` chỉ đến sau handshake nên backend không đọc được lúc bắt tay. Giải pháp: **WS ticket dùng một lần**.

```
FE                                    Backend                        Redis
│ POST /sessions/{id}/join (REST+JWT)   │
│ ◄─── { wsTicket: "abc..." } ──────────│──── SET ws_ticket:abc = userId:sessionId (TTL 60s)
│                                       │
│ new SockJS("/ws?ticket=abc") ────────►│ JwtHandshakeHandler.determineUser()
│                                       │──── GETDEL ws_ticket:abc  (dùng 1 lần!)
│                                       │ → StompPrincipal(userId, role, name)
│                                       │ → session attributes: userId, userRole,
│ ◄──── CONNECTED ──────────────────────│   userName, userAvatarColor, sessionId
```

- Ticket sinh bởi `WsTicketService` (Redis, TTL 60s, `getAndDelete` nên chỉ xài được 1 lần). GV lấy ticket từ response `sessionService.start`; HS từ `sessionService.join`; ngoài phiên học thì `POST /auth/ws-ticket`.
- `JwtHandshakeHandler` nhét sẵn **tên + màu avatar + avatarUrl vào WS session attributes** → về sau `PresenceEventListener` broadcast presence không cần query DB.

### 3.2. Hai loại client phía FE (`lib/websocket.ts`)

**`createSessionWsClient(ticket, sessionId, onReconnect, onConnected?)`** — dùng trong phiên học:
- `onConnect`: subscribe `/topic/session/{id}` (broadcast cả lớp) + `/user/queue/private` (unicast, vd `answer_aggregate` chỉ GV nhận) + resubscribe toàn bộ room topic breakout.
- **Heartbeat**: publish `/app/session/{id}/heartbeat` mỗi 25s giữ presence sống.
- **Reconnect**: khi socket rớt, gọi `onReconnect()` để xin ticket MỚI (ticket cũ đã bị tiêu) → cập nhật `currentTicket` → STOMP tự retry sau 5s, `webSocketFactory` được gọi lại và nhặt ticket mới.
- `subscribeRoom(roomId, handler)` **gọi được trước khi STOMP connect xong** — handler lưu vào map, `onConnect` sẽ subscribe thật. Đây là chìa khóa cho việc khôi phục breakout sau reload (§13.5).
- API gửi: `sendChat`, `sendRaiseHand`, `sendFocus` (publish tới `/app/session/{id}/...`).

**`createAppWsClient(ticket, onReconnect)`** — dùng NGOÀI phiên học (hiện tại: `ClassListPage`):
- Chỉ có `subscribeTopic(destination, handler)` (trả hàm unsubscribe) + `disconnect()`.
- Dùng STOMP heartbeat chuẩn 25s (không có heartbeat presence).
- Mục đích: nhận `session_started`/`session_ended` trên `/topic/classroom/{id}` để bật/tắt LIVE badge **realtime thay vì polling**.

### 3.3. Phía backend

- `WebSocketConfig`: endpoint `/ws` SockJS, đăng ký `JwtHandshakeHandler`; allowed origins đọc từ property `app.cors.allowed-origins` (cùng nguồn với CORS REST — xem §21).
- `JwtChannelInterceptor`: chặn SUBSCRIBE/SEND khi chưa có principal.
- `SessionBroadcastService` — 4 kênh phát:

| Method | Destination | Dùng cho |
|---|---|---|
| `broadcastToSession` | `/topic/session/{sessionId}` | Sự kiện cả lớp trong phiên |
| `sendToUser` | `/user/{userId}/queue/private` | Unicast (answer_aggregate → GV) |
| `broadcastToClassroom` | `/topic/classroom/{classroomId}` | LIVE badge ngoài phiên |
| `broadcastToRoom` | `/topic/session/{sid}/room/{roomId}` | Chat riêng phòng breakout |

Mọi message đều bọc dạng `{ "type": "<event_type>", "payload": {...} }`.

---

## 4. Video — LiveKit SFU

### 4.1. Vì sao SFU thay vì mesh P2P?

Bản đầu dùng mesh WebRTC (mỗi người tạo 1 PeerConnection tới từng người khác) — n người = n×(n−1)/2 kết nối, upload nhân bản theo số người xem → chết ở lớp ~30 HS. LiveKit SFU: **mỗi client chỉ có 1 kết nối tới server**, server nhân bản luồng media đến người xem. Migration đã hoàn tất; toàn bộ code signaling SDP/ICE thủ công đã xóa. STOMP giờ **không chở byte media nào** — chỉ chở sự kiện nghiệp vụ.

### 4.2. Cấp token (`LiveKitTokenService.java` + `SessionController.liveKitToken`)

- LiveKit token chỉ là **JWT HS256 tự ký** bằng `livekit.api-secret` (khớp block `keys:` trong `livekit.yaml`), claim `video` chứa grant `{roomJoin, room, canPublish, canSubscribe, canPublishData}`.
- `identity = userId` → FE map participant LiveKit ↔ presence STOMP để lấy tên/màu avatar (không nhồi vào token).
- Endpoint `POST /sessions/{id}/livekit-token?roomName=...` (`@PreAuthorize isParticipant`). **Chống mint token chéo phiên**: room phải là `session-{id}` (phòng chính) hoặc `session-{id}-room-{roomId}` (breakout của đúng phiên này), khác là 403.

### 4.3. Adapter hook `useLiveKitRoom.ts` (FE)

- Expose `peers: Map<identity, { remoteStream, isCameraOff, isMuted, isScreenShare }>` — giữ ĐÚNG shape mà `VideoTile` cũ tiêu thụ nên khi migrate gần như không phải sửa render.
- Tự sở hữu local media: `toggleCamera/toggleMic` gọi `setCameraEnabled/setMicrophoneEnabled`; screen share là **track riêng** (`Track.Source.ScreenShare`) — SDK tự bắt sự kiện "Stop sharing" của browser.
- Lắng nghe room events (`TrackSubscribed/Unsubscribed`, `TrackMuted/Unmuted`, `ParticipantConnected/Disconnected`) → dựng lại entry trong `peers` map. Ưu tiên hiển thị screen track nếu có, không thì camera track.
- `connect(sessionId, roomName)`: ngắt room cũ → xin token REST → vào room mới → publish cam/mic theo trạng thái mong muốn → nạp track của participant đã ở sẵn trong phòng. **Đổi phòng breakout = gọi lại connect với roomName khác** — cách ly media theo phòng nằm hoàn toàn ở tầng LiveKit, STOMP chỉ báo "ai đang ở phòng nào".
- ⚠️ `adaptiveStream`/`dynacast` đang **TẮT có chủ đích**: chúng dựa vào `track.attach()` để biết track nào đang hiển thị, nhưng `VideoTile` gán `srcObject` thủ công → bật lên LiveKit sẽ pause track "không ai xem" → tile đen.

---

## 5. Quản lý lớp học (Classroom)

### 5.1. Lớp học

- GV tạo lớp (`POST /classrooms`) → sinh **join code** (`JoinCodeGenerator`). HS nhập code → `POST /classrooms/join` → tạo `ClassroomMembership`. GV có thể kick member, đổi join code (`regenerateJoinCode`) để chặn người ngoài.
- Phân quyền bằng SpEL bean: `@classroomSecurity.isOwner/isMember(#classroomId, authentication)` — check membership/ownership trong DB.

### 5.2. `ClassListPage` — LIVE badge realtime (không polling)

1. Mount → load danh sách lớp REST → mở `createAppWsClient`.
2. Subscribe `/topic/classroom/{id}` **cho từng lớp đang hiển thị**; danh sách subscription đồng bộ theo state `classes` (tạo/tham gia lớp mới → subscribe thêm).
3. GV start session → `SessionController.start` broadcast `session_started {classroomId, sessionId}` → FE set `activeSessionId` tại chỗ → badge LIVE bật ngay, không gọi lại API. `session_ended` → tắt badge.
4. Safety-net: refresh khi `visibilitychange` (tab quay lại foreground) phòng khi WS rớt và lỡ event.

### 5.3. `ClassDetailPage` — bảng tin, lịch, tài liệu, thành viên

- **Posts**: CRUD bài đăng (nội dung rich text CKEditor, render lại bằng class `.sq-rich`), đính kèm file (attachments qua MinIO).
- **Schedules**: lịch học per lớp. Chi tiết nhỏ: API trả `startTime` dạng `"HH:mm"` nên TimePicker phải pre-fill `dayjs('2000-01-01 ' + s.startTime)` (dayjs cần date giả để parse).
- **Documents**: tab Tài liệu tổng hợp 2 nguồn — attachments từ bài đăng (badge "Đăng bài") + file GV upload trực tiếp (badge "Tải lên trực tiếp").

---

## 6. Upload file — MinIO presigned URL

File **không đi qua backend** — backend chỉ ký URL, browser PUT thẳng lên MinIO:

```
FE                         Backend                      MinIO
│ POST /uploads/presign ──► UploadService.presign()
│   {purpose, files[]}       - check size (avatar 5MB, doc 50MB)
│                            - objectKey = uploads/{yyyy}/{MM}/{uuid}-{tên đã sanitize}
│                            - ký presigned PUT (TTL 5 phút)
│ ◄── {uploadUrl, url}
│ PUT file ──────────────────────────────────────────► lưu object
│ (lưu `url` = "/storage/{bucket}/{key}" vào post/document/avatar)
```

Quy ước quan trọng: URL lưu DB là **đường dẫn tương đối `/storage/...`** — dev thì Vite proxy forward tới MinIO, production thì Caddy — nhờ vậy không bao giờ bake `localhost:9000` vào dữ liệu, đổi máy/đổi domain không hỏng ảnh cũ.

---

## 7. Vòng đời buổi học (Session)

### 7.1. Start — idempotent + chống race

`POST /classrooms/{id}/sessions` (owner only). `SessionService.start`:

1. Đã có session active của lớp này → **trả về session đó luôn** (kèm wsTicket mới). Vì vậy GV reload trang session không tạo phiên trùng — FE cứ gọi `start` vô tư.
2. Chưa có → tạo mới. Nếu 2 request đua nhau, **unique partial index** trên `(classroom_id) WHERE status='active'` (migration V11) chặn ở tầng DB → bắt `DataIntegrityViolationException` → trả về session mà thread kia vừa tạo.
3. Broadcast `session_started` tới `/topic/classroom/{id}` (LIVE badge).

### 7.2. Join / Leave (học sinh)

- `POST /sessions/{id}/join`: chặn nếu session đã ended; upsert `SessionPresence` (đã có thì clear `leftAt` — vào lại); trả `JoinSessionResponse` gồm tên lớp, **teacherId/tên/màu avatar GV** (để FE render tile GV không cần thêm request) và `wsTicket`.
- `POST /sessions/{id}/leave`: set `leftAt`, xóa khỏi Redis presence set, broadcast `student_presence {action:'left'}`.

### 7.3. End

`POST /sessions/{id}/end` (owner):

1. Set `status=ended`, `endedAt=now`.
2. Session ad-hoc (start không gắn lịch) → **tự tạo Schedule** "Buổi học dd/MM/yyyy" theo giờ thực tế — lịch sử lớp luôn đầy đủ.
3. `summaryComputeJob.computeAsync(sessionId)` — tính bảng điểm nền (§16).
4. Broadcast `session_ended` tới `/topic/session/{id}` (HS đang học → FE tự disconnect WS + LiveKit rồi navigate sang `/review/{sessionId}`) **và** tới `/topic/classroom/{id}` (tắt LIVE badge).

### 7.4. Init flow phía FE

**TeacherSessionPage** (`/session/teacher/:classroomId`):
```
sessionService.start(classroomId)            ← trả session mới hoặc đang active
→ Promise.all([questions, presence, chatHistory, breakout.getActive])
→ khôi phục: câu hỏi đang running / breakout đang active / GV đang ở phòng nhóm nào
→ pre-fetch stats các câu đã ended (cho drawer kết quả)
→ createSessionWsClient(...).subscribe(handleEvent)
→ rtc.connect(sessionId, phòng-đang-ở)      ← LiveKit, tính cả restore breakout
```
**StudentSessionPage** (`/session/student/:classroomId`): `listByClassroom` → tìm session active (không có → màn "chưa có buổi học") → `join` → load song song 4 nguồn như trên → khôi phục breakout **trước khi** WS connect → connect WS + LiveKit.

Cả hai trang dùng **StrictMode guard**: init bọc trong `setTimeout(fn, 0)` + cờ `cancelled` — React StrictMode (dev) mount-unmount-mount ngay lập tức, cleanup sync chạy trước timeout nên lần mount đầu bị cancel gọn, không tạo 2 WS connection; mọi `await` đều check `if (cancelled) return`.

**Đồng hồ buổi học**: `elapsedSeconds` tính từ `session.startedAt` (Instant của server) + `clockOffsetRef` — reload không reset về 0, và không phụ thuộc đồng hồ máy client.

---

## 8. Presence — ai đang online

Presence có **2 tầng**:

| Tầng | Lưu ở | Ý nghĩa |
|---|---|---|
| Lịch sử tham dự | PostgreSQL `session_presence` (joinedAt/leftAt) | "Ai đã tham gia buổi này" — dùng cho dashboard/summary |
| Online tức thời | Redis set `session:{id}:presence` | "Ai đang kết nối NGAY BÂY GIỜ" — dùng cho silent detection, đếm online |

`PresenceEventListener` bắt sự kiện vòng đời **WebSocket** (không phải REST):
- STOMP CONNECT của HS → add Redis set → broadcast `student_presence {studentId, action:'joined', name, avatarColor}` — tên/màu lấy từ WS session attributes (JwtHandshakeHandler đã nhét lúc handshake), **không cần query DB**.
- DISCONNECT (đóng tab, rớt mạng) → remove Redis, set `leftAt` DB, broadcast `left`. Tức là chỉ cần tắt browser là hệ thống biết HS rời — không cần bấm nút thoát.

⚠️ Cái bẫy kinh điển: `handleConnect` fire **trước khi** server gửi frame CONNECTED về client → HS vừa vào chưa kịp subscribe đã "lỡ" event presence của chính người vào cùng lúc. FE xử lý bằng callback `onConnected`: sau khi subscription sẵn sàng thì **refetch presence qua REST** để đồng bộ lại.

FE nhận `student_presence joined` thì: (1) cập nhật lạc quan từ payload WS, (2) gọi `getPresence` REST để lấy profile đầy đủ + loại người đã offline. `PresenceDto` phía backend cần `@JsonProperty("isOnline")` vì Lombok + Jackson mặc định serialize field `isOnline` thành `"online"` (rớt prefix `is`).

---

## 9. Q&A — câu hỏi tương tác kèm confidence

Tính năng trung tâm của đồ án. Ba loại câu hỏi: `single` / `multiple` (trắc nghiệm, hỗ trợ LaTeX qua CKEditor+KaTeX) / `essay` (tự luận).

### 9.1. Tạo & phát (GV)

```
CreateQuestionModal (2 bước)
→ POST /questions      (tạo draft; validate: MCQ phải có options + ≥1 đáp án đúng)
→ POST /questions/{id}/start
     backend: check session active, check KHÔNG có câu khác đang running
              (QUESTION_ALREADY_RUNNING), status draft→running,
              endsAt = now + timerSeconds,
              Redis SET session:{id}:active_question (TTL 5ph),
              QuestionTimerService.startTimer(...)
→ broadcast question_started tới cả lớp
```

### 9.2. Chống lộ đáp án — nguyên tắc xuyên suốt

Học sinh **không bao giờ** nhận được `isCorrect` khi câu hỏi còn chạy:

- Broadcast `question_started` đi topic chung cả lớp → options bị strip qua `OptionDto.withoutCorrect()` (field `Boolean isCorrect` + `@JsonInclude(NON_NULL)` → JSON không có key luôn).
- REST `GET /questions`: `QuestionDto.sanitized()` khi caller không phải owner.
- Đáp án đúng chỉ tiết lộ khi câu hỏi kết thúc: **`question_ended` payload = `{questionId, correctOptionIds}`** (cả end tay lẫn auto-end timer).
- Hệ quả phía GV: nếu GV reconnect giữa câu hỏi, question dựng từ WS payload sẽ thiếu isCorrect → flag `usedFallback` trigger refetch `questionService.list` (owner thấy đầy đủ) để GV vẫn thấy highlight đáp án đúng.

### 9.3. Countdown — đồng bộ đồng hồ server

Payload `question_started` kèm `serverNow` → FE tính `clockOffsetRef = serverNow − Date.now()`. Countdown = `endsAt − (Date.now() + offset)`. Nhờ vậy máy HS lệch giờ 30 giây vẫn đếm đúng, hai phía GV/HS thấy cùng số.

### 9.4. Học sinh trả lời

- HS chọn đáp án (hoặc gõ tự luận) + chọn **confidence** (high/medium/low — `ConfidenceSelector`) → `POST /answers`.
- Backend `StudentAnswerService.submit`: câu phải đang `running` (`QUESTION_NOT_RUNNING`) — mỗi HS chỉ nộp 1 lần (`ALREADY_ANSWERED`) — validate option thuộc đúng câu hỏi — **chấm ngay lúc nộp**: `computeIsCorrect` = tập option chọn **trùng khớp chính xác** tập đáp án đúng (exact-set: chọn thiếu hay thừa đều sai); essay → `correct = null` (chờ GV xem tay).
- Ghi Redis set `...:answered` (nguồn cho silent detection) → controller gọi `broadcastAnswerAggregate` **sau khi transaction commit** → unicast `answer_aggregate {questionId, answeredCount, totalCount}` **chỉ tới GV** qua `/user/queue/private` (HS không thấy tiến độ của nhau).
- GV nhận aggregate → cập nhật progress bar ngay + refetch `getStats` REST để có phân bố option/confidence/silent list đầy đủ.

### 9.5. Khóa & auto-submit khi hết giờ (FE — StudentSessionPage)

- `answerLocked = questionSubmitted || status==='ended' || timeRemaining===0` — chạm 0 là khóa NGAY tại local, không đợi WS `question_ended` bay tới.
- **Auto-submit khi còn ≤1s** (không phải 0s): server auto-end đúng thời điểm `endsAt`, gửi tại 0s sẽ thua race và ăn `QUESTION_NOT_RUNNING`. Chỉ auto-submit khi **có nội dung** — không ghi nhận answer rỗng (không chọn gì = bỏ qua).
- `handleSubmit` bắt `QUESTION_NOT_RUNNING` → gỡ flag submitted + set ended + báo lỗi (không hiện "Đã gửi" giả). `ALREADY_ANSWERED` (double-submit) thì giữ flag.
- Panel thu nhỏ vẫn thấy countdown trên control bar + pill header; ≤10s → class `.sq-pulse-danger` nhấp nháy đỏ.

### 9.6. Kết thúc câu hỏi — 3 con đường, 1 kết quả

| Con đường | Code | 
|---|---|
| GV bấm end | `QuestionController.end` → `QuestionService.end` → broadcast |
| Timer hết giờ | `QuestionTimerService`: `ScheduledExecutorService` hẹn giờ lúc start; callback dùng `TransactionTemplate` (vì chạy ở thread ngoài, `@Transactional` proxy bị bypass), đọc `correctOptionIds` **bên trong** transaction (options lazy-load) rồi broadcast |
| Server restart giữa chừng | `@EventListener(ApplicationStartedEvent)` `recoverActiveTimers()`: quét câu `running` trong DB — quá hạn thì end ngay, chưa thì reschedule phần thời gian còn lại. Timer nằm trong RAM nên restart là mất — đây là mitigation |

Cả 3 đều phát `question_ended {questionId, correctOptionIds}`.

### 9.7. Reveal đáp án (HS)

Nhận `question_ended` → state `correctOptionIds` (reset khi có `question_started` mới) → option đúng viền emerald + ✓, option mình chọn sai viền rose + ✗; footer: "Chính xác!" / "Chưa đúng — đáp án đúng: A, B" — đúng/sai tính bằng **cùng quy tắc exact-set với backend**. Essay không reveal. Reload sau khi câu đã ended thì không khôi phục reveal (chỉ câu running được restore).

---

## 10. Silent Student Detection

"Học sinh im lặng" = đang online nhưng chưa trả lời câu hỏi đang chạy. Phát hiện bằng **phép trừ 2 Redis set**:

```
silent = SMEMBERS session:{id}:presence  −  SMEMBERS session:{id}:question:{qid}:answered
```

- Backend có `SilentStudentDetector` chạy `@Scheduled` mỗi 10s quét mọi session active (hiện mới log; đường broadcast riêng đang để dành).
- **Đường FE thực dùng**: `QuestionService.getStats` trả `silentStudents` (kèm tên/avatar) — GV refetch stats mỗi khi nhận `answer_aggregate`. Trên UI: Alert vàng "Chưa trả lời: ..." trên đầu trang + icon cảnh báo trong `StudentStatusList` — GV nhắc trực tiếp.

---

## 11. Raise Hand — giơ tay

Tính năng thuần WS, không REST:

1. HS bấm ✋ → `ws.sendRaiseHand(raised)` → `/app/session/{id}/raise-hand`.
2. `RaiseHandWsController`: chỉ nhận role STUDENT → cập nhật Redis set `raised_hands` (trạng thái hiện tại) + insert bảng `raised_hands` (log lịch sử) → broadcast `raise_hand_changed {studentId, raised}`.
3. Mọi client cập nhật `raisedHandIds` → hiện ✋ trên video tile + danh sách HS. HS bấm lần nữa để hạ tay.

---

## 12. Live Chat

- **Gửi**: qua WS `/app/session/{id}/chat` với body `{content, breakoutRoomId}`. `ChatService.send` kiểm tra: session active; GV phải là chủ phiên, HS phải có presence; nếu có `breakoutRoomId` thì room phải thuộc đúng session → **persist DB** rồi broadcast:
  - Chat thường → `/topic/session/{id}` (cả lớp).
  - Chat phòng breakout → `/topic/session/{id}/room/{roomId}` (chỉ người sub topic phòng — tức thành viên phòng + GV đang thăm).
- **Lịch sử**: REST `GET /chat/history` phân trang **cursor-based** (`beforeId` + limit, lấy limit+1 để biết `hasMore`, DB trả DESC rồi reverse về chronological) — vào muộn vẫn thấy 50 tin gần nhất, kéo lên load thêm.
- FE: panel đóng mà có tin mới → badge `unreadChat` (đọc qua `showChatRef` để WS handler không dính stale closure); mở panel → reset 0.

---

## 13. Breakout Rooms — chia nhóm

Tính năng phức tạp nhất vì đụng cả 3 mặt phẳng cùng lúc.

### 13.1. Mô hình dữ liệu

`breakout_sessions` (1 phiên chia nhóm, có `teacher_room_id` — V13) → `breakout_rooms` (tên, task, thứ tự) → `breakout_assignments` (HS thuộc phòng nào). Mỗi session chỉ 1 breakout active (`BREAKOUT_ALREADY_ACTIVE`).

### 13.2. Tạo (GV — `BreakoutPanel` setup mode)

GV kéo thả HS vào phòng / thêm hàng loạt / chia ngẫu nhiên — tất cả **UI-only**, chỉ khi bấm "Bắt đầu breakout" mới `POST /breakouts` một phát ăn ngay. Backend tạo rooms + assignments (pre-load users 1 query tránh N+1) → broadcast `breakout_started {rooms: [{id, name, task, studentIds}]}`.

### 13.3. Client phản ứng với `breakout_started`

Payload WS chỉ có `studentIds` → cả 2 phía đều fetch `GET /breakouts/active` lấy DTO đầy đủ (tên, avatar).

**HS được phân phòng X**: `subscribeRoom(X)` (chat phòng) + `rtc.connect(sessionId, "session-{id}-room-{X}")` — **rời LiveKit room chính, vào room riêng của phòng**. Media cách ly hoàn toàn: không nghe/thấy phòng khác.
**HS không được phân**: ở lại room chính, tile của bạn đã chuyển phòng tự biến mất (họ disconnect khỏi room chính).
**GV**: panel chuyển active mode — hiện các phòng, đếm online/total, làm mờ + gạch tên HS offline.

### 13.4. GV thăm phòng

- Vào: `POST /rooms/{roomId}/join` → backend **persist `teacherRoomId`** → broadcast `teacher_joined_room {roomId, roomName}` **toàn session** (mọi người cần biết GV đang ở đâu). FE GV: `rtc.connect(..., "session-{id}-room-{roomId}")` + collapse panel để lộ lưới video phòng. FE HS: chỉ gate UI — HS cùng phòng thấy "Giáo viên đã vào phòng", HS phòng chính thấy tile GV thành placeholder "đang ở phòng nhóm" (`teacherAway`); media GV tự xuất hiện/biến mất theo LiveKit room.
- Rời: `POST .../leave` → clear `teacherRoomId` → `teacher_left_room` → GV `rtc.connect` về room chính.

### 13.5. Khôi phục sau reload — vì sao cần `teacherRoomId` trong DB

Reload là mất sạch state trong RAM của tab. Nguồn khôi phục = REST `getActive`:

- **HS reload giữa breakout**: init fetch `getActive` → khôi phục `myRoom`/`breakoutMemberIds`/`teacherInRoom`/`teacherAway` **trước khi** WS connect; `ws.subscribeRoom(roomId)` gọi trước khi STOMP connect vẫn ăn (handler chờ sẵn trong map — §3.2); LiveKit connect thẳng vào room phòng nhóm.
- **GV reload giữa breakout**: nhờ cột `teacherRoomId` (V13) mà biết mình đang thăm phòng nào → khôi phục `teacherJoinedRoomId` + collapse panel + LiveKit vào đúng room phòng đó.
- **HS rời lớp giữa breakout**: lưới video phòng lọc `room.students` theo presence online — HS offline **bỏ tile luôn** (không hiện avatar kiểu "tắt camera"); tag "X bạn đang ở phòng nhóm" cũng đếm theo online.

### 13.6. Kết thúc

`POST /breakouts/{id}/end` → `breakout_ended` → mọi người quay về: HS trong phòng `unsubscribeRoom` + LiveKit về room chính; GV nếu đang thăm phòng cũng về room chính; state breakout xóa sạch cả 2 phía.

---

## 14. Focus Mode — Spotlight 1-1

Tính năng "rẻ" nhất về mặt kỹ thuật — **chỉ đổi layout, không đổi media**:

1. GV click thumbnail HS → `ws.sendFocus(studentId)` → `FocusWsController` (chỉ role TEACHER được phát) → broadcast `focus_changed {focusedStudentId}` (null = bỏ focus).
2. GV: layout chuyển grid 2 cột — tile GV + tile HS được focus phóng to. HS được focus: banner "Bạn đang được chú ý". Cả lớp thấy ai đang được spotlight.
3. Stream lấy từ `peers` map sẵn có của LiveKit — không có kết nối mới nào được tạo.

---

## 15. Broadcast — thông báo toàn lớp

GV đang điều phối breakout muốn nhắn cả các phòng ("còn 2 phút!"): `POST /breakouts/{id}/broadcast {content}` → broadcast `broadcast_message {content, sentAt}` tới `/topic/session/{id}` — **topic session chính nên xuyên mọi phòng** (HS trong phòng nhóm vẫn sub topic session chính song song với topic phòng). FE HS hiện modal/alert nội dung.

---

## 16. Teacher Dashboard — tổng kết buổi học

Route `/dashboard/:sessionId`. Chỉ xem được khi session **đã ended** (`SESSION_NOT_ENDED` — FE bắt lỗi này và retry sau 1.5s, vì GV được navigate sang dashboard ngay khi bấm end trong lúc job nền có thể chưa xong).

### 16.1. Bảng điểm — `SessionSummaryComputeJob`

Chạy `@Async` khi end session (hoặc **on-demand** ngay trong `getDashboard` nếu bảng trống — phòng job async chết): với mỗi HS đã tham dự, đếm answered/correct/skipped trên các câu **đã ended**, `scorePercent = correct/totalQuestions × 100` → upsert `session_student_summaries`.

### 16.2. `DashboardResponse` + FE

Backend trả: thông tin phiên (thời lượng, sĩ số, số câu), `overallStats` (điểm TB), per-question summary (answered/correct/skipped + phân bố option), per-student results.

FE load song song `getTeacherDashboard` + `sessionService.get` (lấy classroomId cho nút quay lại), rồi **load toàn bộ answers 1 lần**: `Promise.all(questions.map(q => answerService.list(sessionId, q.id)))` → `Map<questionId, StudentAnswerDto[]>` (role TEACHER được xem toàn bộ answers — §9.4). Dùng cho:
- Panel mỗi câu: hàng HS + chip đáp án đã chọn (emerald/rose theo đúng/sai) + confidence + giờ nộp; essay hiện card `.sq-rich`.
- Tab "Kết quả học sinh": Table expandable → chi tiết từng câu của từng HS.

Trực quan: KHÔNG dùng BarChart — "Kết quả theo câu hỏi" là thanh ngang xếp chồng đúng/sai/bỏ qua; "Phân bố đáp án" là hàng option có thanh nền tỉ lệ. Ngưỡng màu: emerald ≥70% · amber 40–70% · rose <40%.

---

## 17. Student Review — ôn tập cá nhân

Route `/review/:sessionId` — HS được navigate tới **tự động** khi GV kết thúc buổi (`session_ended`). `StudentReviewService.getReview` (cũng yêu cầu session ended) chỉ trả dữ liệu **của chính HS đó**:

- Tổng quan: answered/correct/skipped/scorePercent → FE hiện "Xuất sắc!" ≥70% / "Khá tốt!" 40–70% / "Cần cố gắng hơn" <40%.
- Từng câu: `result ∈ {correct, wrong, skipped, pending_review(essay)}`, options kèm `isCorrect` + `selected` (giờ session đã kết thúc nên lộ đáp án là hợp lệ), confidence đã chọn.
- FE: dải ô vuông kiểu answer-sheet (mỗi ô 1 câu, màu theo result, click → scroll tới card chi tiết) + Radar chart "Tự tin & Chính xác" (đối chiếu confidence với kết quả thật — giá trị sư phạm: phát hiện "tự tin nhưng sai").

---

## 18. Admin

Route `/admin` (nav chỉ hiện khi `user.role === 'admin'`): thống kê hệ thống (`getStats`), danh sách lớp, danh sách user (lọc role/tìm kiếm), cập nhật user (đổi role, khóa `active=false` → login bị chặn ở `AuthService`).

Ghi chú kỹ thuật: `listUsers` từng 500 khi không có filter — JPQL `(:role IS NULL OR u.role = :role)` bind NULL cho enum đã qua `AttributeConverter` làm PostgreSQL không suy được kiểu param. Fix: chuyển sang `JpaSpecificationExecutor` + `Specification`, chỉ thêm predicate khi filter có giá trị.

---

## 19. Bảng tra cứu

### 19.1. Sự kiện WebSocket (đầy đủ 14 loại)

| Type | Hướng phát | Payload chính | Ý nghĩa |
|---|---|---|---|
| `student_presence` | session topic | `{studentId, action: joined/left, name?, avatarColor?}` | HS vào/rời (bắt từ WS connect/disconnect) |
| `session_started` | classroom topic | `{classroomId, sessionId}` | LIVE badge bật |
| `session_ended` | session + classroom topic | `{sessionId, endedAt}` / `{classroomId, sessionId}` | HS → redirect review; badge tắt |
| `question_started` | session topic | `{questionId, type, content, options(KHÔNG isCorrect), endsAt, serverNow}` | Câu hỏi mới; sync đồng hồ |
| `question_ended` | session topic | `{questionId, correctOptionIds}` | Kết thúc + tiết lộ đáp án |
| `answer_aggregate` | **unicast GV** | `{questionId, answeredCount, totalCount}` | Tiến độ trả lời live |
| `raise_hand_changed` | session topic | `{studentId, raised}` | Giơ/hạ tay |
| `focus_changed` | session topic | `{focusedStudentId \| null}` | Spotlight |
| `breakout_started` | session topic | `{breakoutSessionId, rooms[{id,name,task,studentIds}]}` | Bắt đầu chia nhóm |
| `breakout_ended` | session topic | `{breakoutSessionId}` | Về phòng chính |
| `teacher_joined_room` | session topic | `{roomId, roomName}` | GV thăm phòng nhóm |
| `teacher_left_room` | session topic | `{roomId}` | GV về phòng chính |
| `broadcast_message` | session topic | `{content, sentAt}` | Thông báo xuyên phòng |
| `chat_message` | session topic **hoặc** room topic | `ChatMessageDto` | Chat lớp / chat phòng |

Client publish (`/app/...`): `heartbeat` (25s), `chat`, `raise-hand` (STUDENT), `focus` (TEACHER).

### 19.2. REST endpoints chính (`/api/v1`)

| Nhóm | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh` (cookie), `/auth/logout`, `/auth/ws-ticket` |
| User | `GET/PATCH /users/me`, upload avatar |
| Classroom | `GET/POST /classrooms`, `GET/PATCH/DELETE /classrooms/{id}`, `POST /classrooms/join`, members/kick/regenerate-code |
| Post/Schedule/Document | CRUD dưới `/classrooms/{id}/...` |
| Upload | `POST /uploads/presign` → PUT thẳng MinIO |
| Session | `POST /classrooms/{id}/sessions` (start), `GET .../sessions`, `GET /sessions/{id}`, `POST /sessions/{id}/end\|join\|leave`, `GET .../presence`, `POST .../livekit-token` |
| Question | `GET/POST /sessions/{id}/questions`, `POST .../{qid}/start\|end`, `GET .../{qid}/stats` |
| Answer | `POST .../{qid}/answers`, `GET .../{qid}/answers` (teacher: tất cả; student: của mình) |
| Breakout | `POST /sessions/{id}/breakouts`, `GET .../active`, `POST .../{bid}/end\|broadcast`, `POST .../rooms/{rid}/join\|leave` |
| Chat | `GET /sessions/{id}/chat/history?beforeId=&limit=` |
| Dashboard/Review | `GET /sessions/{id}/dashboard` (owner), `GET /sessions/{id}/review` (student) |
| Admin | `GET /admin/stats`, `GET /admin/classrooms`, `GET/PATCH /users` |

Phân quyền: `@PreAuthorize` + SpEL bean (`@classroomSecurity.isOwner/isMember`, `@sessionSecurity.isOwner/isParticipant`, `hasRole(...)`). Response bọc `ApiResponse{data, meta, error{code,message}}` — FE điều khiển luồng bằng `error.code` (vd `QUESTION_NOT_RUNNING`, `SESSION_NOT_ENDED`).

### 19.3. Database (Flyway V1→V13)

| Migration | Bảng / thay đổi |
|---|---|
| V1–V2 | `users` (role qua AttributeConverter lowercase), `refresh_tokens` |
| V3 | `classrooms`, `classroom_memberships` (join code) |
| V4–V6 | `posts` + `post_attachments`, `schedules`, `classroom_documents` |
| V7 | `sessions`, `session_presence`, `session_student_summaries` |
| V8 | `questions`, `question_options`, `student_answers` (selectedOptionIds mảng UUID, confidence enum, correct nullable) |
| V9 | `breakout_sessions`, `breakout_rooms`, `breakout_assignments` |
| V10 | `chat_messages` (nullable breakout_room_id), `raised_hands` |
| V11 | **unique partial index**: 1 session active / classroom |
| V12 | avatar_url về đường dẫn tương đối |
| V13 | `breakout_sessions.teacher_room_id` (FK SET NULL) — khôi phục vị trí GV |

Redis keys: `ws_ticket:{uuid}` (60s) · `session:{id}:presence` · `session:{id}:active_question` (5ph) · `session:{id}:question:{qid}:answered` (5ph) · `session:{id}:raised_hands`.

---

## 20. Các pattern kỹ thuật đáng chú ý

1. **StrictMode guard** (§7.4): `setTimeout(init, 0)` + cờ `cancelled` — chống double-init dev mode.
2. **Refs mirror state cho closure**: WS handler và `onConnected` được tạo 1 lần lúc init nên đọc state qua ref (`presenceRef`, `myRoomRef`, `breakoutRef`, `teacherJoinedRoomIdRef`, `showChatRef`…) — cập nhật `.current` trực tiếp trong handler, effect sync làm dự phòng. Đây là câu trả lời cho câu hỏi "sao lắm ref thế": tránh stale closure mà không phải re-create handler/re-subscribe.
3. **Clock offset**: mọi phép đo thời gian (countdown, elapsed) neo theo giờ server, bù lệch qua `clockOffsetRef` từ `serverNow`.
4. **Idempotent + DB constraint chống race**: start session trả về phiên đang có; unique partial index bắt race hai thread cùng tạo; submit answer chống trùng bằng exists-check + trả `ALREADY_ANSWERED`.
5. **Optimistic update + refetch**: sự kiện WS cập nhật UI ngay bằng payload gọn, rồi refetch REST lấy dữ liệu đầy đủ (presence, stats, breakout DTO) — UI nhanh mà vẫn đúng.
6. **Sự kiện WS gọn, REST chở nặng**: broadcast chỉ chứa ID + tối thiểu; ai cần chi tiết thì tự fetch. Giảm payload và tránh lộ dữ liệu ngoài ý muốn (như isCorrect).
7. **viewMode là derived, không phải state** (TeacherSessionPage): `breakout → 'breakout' | running → 'running' | ended → 'ended' | 'idle'` — một nguồn sự thật, không bao giờ lệch pha.
8. **`derived-from-server` khi reload**: mọi state quan trọng (câu đang chạy, breakout, vị trí GV, presence) đều khôi phục được từ REST — reload/rớt mạng không phá phiên học.

---

## 21. Triển khai production

(Chi tiết đầy đủ: `classpulse/DEPLOY.md`. File deploy nằm ở repo backend, FE build từ `../ClassPulseFE`.)

- **Edge = Caddy** (tự xin Let's Encrypt) với 3 subdomain:
  - `APP_DOMAIN`: serve SPA tĩnh (`dist/`) + reverse proxy `/api`, `/ws`, `/storage` (GET) → backend/MinIO.
  - `LIVEKIT_DOMAIN`: wss signaling → `livekit:7880`. **Media đi thẳng IP public**: mở UDP 7882 + TCP 7881, `LIVEKIT_NODE_IP` = IP public VPS.
  - `MINIO_DOMAIN`: presigned **PUT** (chữ ký SigV4 ký theo `MINIO_ENDPOINT` nên host browser gọi phải khớp); GET vẫn qua `/storage` tương đối.
- **`.env.production`** (FE, committed): `VITE_API_BASE_URL=/api/v1`, `VITE_WS_URL=/ws` — bắt buộc, thiếu là bake fallback `localhost:8080` vào bundle.
- **CORS**: origin production phải nằm trong `APP_CORS_ALLOWED_ORIGINS` — property này được đọc ở **cả hai** chỗ: `SecurityConfig` (REST — sai là 403 "Invalid CORS request" kể cả trên `permitAll`) và `WebSocketConfig` (SockJS handshake — sai là WS không connect được).
- Cookie refresh: `APP_COOKIE_SECURE=true` — chỉ gửi qua HTTPS.
- Chạy: `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` (tại repo backend).

---

*Cập nhật lần cuối: 2026-07-04 — đối chiếu code thực tế trên nhánh `main` (FE) và backend `classpulse`.*
