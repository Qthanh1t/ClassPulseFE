# CLAUDE.md

## Project overview

**ClassPulse** — Nền tảng tương tác thời gian thực cho lớp học nhóm nhỏ (đồ án tốt nghiệp).

Triết lý: **tối đa hóa tương tác hai chiều** — mọi kênh (video, Q&A, raise hand, chat, breakout, focus spotlight) hoạt động trong cùng một phiên realtime.

**Roles**: Teacher (quản lý lớp, điều phối, dashboard) | Student (tham gia, tương tác, review cá nhân) | Admin (quản lý user/lớp/hệ thống)

**Core features** (tất cả xảy ra trong 1 phiên realtime): Classroom Management, Live Video (WebRTC), Confidence-based Q&A (timer + auto-end), Silent Student Detection, Raise Hand, Live Chat, Dynamic Breakout Rooms, Focus Mode (Spotlight 1-1), Micro Task, Broadcast, Quick Actions, Teacher Dashboard, Student Session Review.

## System architecture

| Layer | Technology |
|---|---|
| Frontend (this repo) | React 19 + TypeScript + Vite |
| Backend | Java (`C:\code\datn\classpulse`) |
| Realtime | WebSocket / STOMP + SockJS |
| Video | WebRTC |
| Database | PostgreSQL |

## Frontend stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite` — no `tailwind.config.js`)
- **Ant Design v6** + **@ant-design/icons** — theme qua `ConfigProvider` trong `App.tsx`
- **react-router-dom v7**
- **CKEditor5 v48** + KaTeX — rich text + LaTeX cho Q&A options
- **Recharts v3** — biểu đồ trong Dashboard/Review
- **@stomp/stompjs v7** + **sockjs-client v1** — WebSocket layer

## Design system

**Palette hiện hành: warm-neutral (stone) + 1 accent ink-indigo, flat — không gradient kiểu AI, không dùng `#1677ff` (AntD blue mặc định).**

**Hai nguồn token đồng bộ giá trị (đổi theme phải sửa cả 2):**
- `src/index.css` — CSS variables `--sq-*` (dùng trong inline style qua `var(--sq-*)` — toàn bộ UI session dùng cách này)
- `src/theme/tokens.ts` — object `color` / `radius` / `shadow` / `mono` mirror cùng giá trị (các trang list/detail/dashboard import trực tiếp)

### Color tokens

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--sq-primary` | `#4f46e5` | Ink-indigo — accent duy nhất |
| `--sq-primary-dark` | `#4338ca` | Hover/pressed |
| `--sq-primary-light` | `#eceafd` | Bg active nav, tag, option đang chọn |
| `--sq-bg` | `#f7f6f3` | Background trang (warm) |
| `--sq-surface` | `#ffffff` | Card, modal, sidebar |
| `--sq-surface-2` | `#f3f1ec` | Bg phụ (option, panel con) |
| `--sq-border` | `#e7e3dc` | Border toàn bộ (`-strong` `#d8d3c9`) |
| `--sq-text` | `#1c1917` | Text chính (stone) |
| `--sq-text-secondary` | `#57534e` | Text phụ |
| `--sq-text-muted` | `#a8a29e` | Text mờ/label |
| `--sq-emerald` | `#0ea672` | Đúng, thành công, online (`-light` `#e7f6ef`) |
| `--sq-amber` | `#e08c0b` | Cảnh báo, trung bình (`-light` `#fbf0db`) |
| `--sq-rose` | `#e23d6d` | Sai, lỗi (`-light` `#fceaef`) |

**Ngoại lệ phải giữ hex literal (không dùng `var()`):** giá trị bị nối chuỗi alpha (`${avatarColor}dd` trong VideoTile — vì vậy mọi default `avatarColor` vẫn là `'#4f46e5'`), hex 8 ký tự có alpha (`#4f46e522`), SVG attribute (Recharts `fill`, AntD Progress `type="circle"` `strokeColor`).

### Typography
Font: **Be Vietnam Pro** (Google Fonts — hỗ trợ đầy đủ dấu tiếng Việt; Outfit cũ chỉ có Latin subset nên chữ có dấu bị fallback font hệ thống). Mono: **JetBrains Mono** (`--sq-mono`, `.sq-mono`, `.sq-nums` tabular).

### AntD ConfigProvider (`App.tsx`)
`colorPrimary: '#4f46e5'`, `borderRadius: 8`, font Be Vietnam Pro. Component overrides: Card 14, Button 8, Tag 6, Table 12, Modal 16.

### Border radius (`theme/tokens.ts` → `radius`)
page 16 · card 14 · control (button/input) 8 · tag 6 · pill 999

### CSS utilities (`index.css`)
`.sq-card-hover` hover lift | `.sq-nav-item(.active)` sidebar nav | `.sq-stat-card` hover shadow | `.sq-press` press feedback | `.sq-skeleton` shimmer | `.sq-noise` grain overlay | `.sq-rich`/`.ck-content` render rich text | `.sq-live-dot` LIVE pulse | `.sq-panel-overlay(-right/-up)` slide-in panel session | `.sq-pulse-danger` nút nhấp nháy đỏ khi câu hỏi sắp hết giờ | `.no-scrollbar` | tôn trọng `prefers-reduced-motion`

## Commands

```bash
npm run dev        # HMR dev server (localhost:5173)
npm run build      # tsc -b + vite build
npm run lint       # ESLint
npm run preview    # xem bản build
```

## Environment variables (`.env`)

| Var | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Relative — Vite proxy forward tới backend; cookie same-site |
| `VITE_WS_URL` | `/ws` | Relative — Vite proxy `ws:true` upgrade WebSocket |
| `VITE_BACKEND_TARGET` | `http://localhost:8080` | Chỉ dùng bởi Vite proxy, không expose ra browser |
| `VITE_TURN_HOST` | `localhost` | Coturn host; set LAN IP khi test 2 thiết bị |

## vite.config.ts

- `define: { global: 'globalThis' }` — polyfill `global` cho `sockjs-client`
- `server.proxy` — forward `/api` và `/ws` tới `VITE_BACKEND_TARGET`; `ws: true` cho WebSocket upgrade

## Routing

| Path | Component | Notes |
|---|---|---|
| `/` | redirect `/login` | |
| `/login` | `LoginPage` | Không dùng AppLayout |
| `/classes` | `ClassListPage` | AppLayout |
| `/classes/:id` | `ClassDetailPage` | AppLayout |
| `/session/teacher/:id` | `TeacherSessionPage` | Layout riêng, fullscreen; `:id` = `classroomId` |
| `/session/student/:id` | `StudentSessionPage` | Layout riêng, fullscreen; `:id` = `classroomId` |
| `/dashboard/:sessionId` | `TeacherDashboardPage` | AppLayout |
| `/review/:sessionId` | `StudentReviewPage` | AppLayout |
| `/profile` | `ProfilePage` | AppLayout |
| `/admin` | `AdminPage` | AppLayout; nav chỉ hiện khi `user.role === 'admin'` |

## Code structure

```
src/
  types/
    index.ts        # dead code — không còn import ở đâu
    api.ts          # DTO types: ApiResponse, AuthResponse, ClassroomDto, PostDto, ...
  index.css         # Be Vietnam Pro import, CSS tokens (:root), .sq-* utilities
  App.tsx           # Router + AntD ConfigProvider + AuthBootstrap + ProtectedRoute
  main.tsx          # bootstrap authStore (wire axios interceptors trước khi render)
  lib/
    api.ts          # Axios instance; Bearer interceptor; silent 401 refresh (queue pattern)
    websocket.ts    # STOMP/SockJS; createSessionWsClient (session) + createAppWsClient (app-level); 15 event types; heartbeat; auto-reconnect
  store/
    authStore.ts    # Zustand: { user, accessToken, setAuth, setToken, clearAuth }
  services/
    auth.service.ts         # login, register, refresh, logout, getWsTicket
    user.service.ts         # getMe, updateMe, uploadAvatar
    classroom.service.ts    # list, get, create, update, remove, join, getMembers, kickMember, regenerateJoinCode
    post.service.ts         # list, create, update, remove, addAttachments, removeAttachment
    schedule.service.ts     # list, create, update, remove
    document.service.ts     # list, upload, remove
    upload.service.ts       # presign + putToMinIO + uploadFile
    session.service.ts      # start, listByClassroom, get, end, join, leave, getPresence
    question.service.ts     # list, create, start, end, getStats
    answer.service.ts       # submit, list
    breakout.service.ts     # create, getActive, end, broadcast, joinRoom, leaveRoom
    chat.service.ts         # getHistory (cursor-based)
    dashboard.service.ts    # getTeacherDashboard, getStudentReview
    admin.service.ts        # getStats, listClassrooms, listUsers, updateUser
  components/
    layout/AppLayout.tsx    # Sidebar (232px fixed, collapsed 64px) + Header (sticky) + <Outlet />
    session/
      StudentStatusList.tsx   # props: participants, answeredIds, silentStudentIds, raisedHandIds, questionActive
      LiveQuestionStats.tsx   # props: stats: QuestionStatsDto, questionType
      ConfidenceSelector.tsx
      CreateQuestionModal.tsx # modal 2 bước; MCQ options hỗ trợ LaTeX
      BreakoutPanel.tsx       # breakout=null → setup; breakout!=null → active. Setup: chọn từng HS + modal thêm hàng loạt theo phòng + chia ngẫu nhiên nhanh (UI-only, xác nhận bằng "Bắt đầu breakout"). teacherRoomId là prop (cha quản lý — khôi phục được sau reload); active mode làm mờ + gạch tên HS offline, tag đếm online/total
      ChatPanel.tsx
      RichTextEditor.tsx      # CKEditor5; prop initialValue để pre-fill khi edit
      CtrlBtn.tsx
  pages/
    LoginPage.tsx
    ProfilePage.tsx
    classroom/ClassListPage.tsx
    classroom/ClassDetailPage.tsx
    session/TeacherSessionPage.tsx
    session/StudentSessionPage.tsx
    dashboard/TeacherDashboardPage.tsx
    dashboard/StudentReviewPage.tsx
```

## Key implementation notes

### AppLayout
Nav dùng custom `<button>` (không phải AntD `Menu`) với `.sq-nav-item`. Active state: `background: #eef2ff, color: #6366f1, fontWeight: 600`.

### ClassListPage
- **Không polling** — LIVE badge (`activeSessionId`) cập nhật realtime qua `createAppWsClient`: subscribe `/topic/classroom/{id}` cho từng lớp hiển thị; `session_started` → set `activeSessionId`, `session_ended` → set `null` (cập nhật state tại chỗ, không gọi lại API)
- Subscription đồng bộ theo `classes` (lớp mới tạo/tham gia → subscribe thêm; lớp biến mất → unsubscribe). Connection mở khi mount, `disconnect()` khi unmount
- Giữ refresh-on-`visibilitychange` làm safety-net (event-driven) khi WS rớt và lỡ event
- **Backend**: `SessionController` broadcast `{ type: 'session_started'|'session_ended', payload: { classroomId, sessionId } }` tới `/topic/classroom/{classroomId}` sau khi `start()` / `end()` (xem Backend notes)

### ClassDetailPage
- Lịch học TimePicker pre-fill: `dayjs('2000-01-01 ' + s.startTime)` — API trả `"HH:mm"`, cần date giả để dayjs parse không lỗi (không cần `customParseFormat` plugin)
- Tab Tài liệu: tổng hợp attachments bài đăng (badge "Đăng bài") + upload trực tiếp GV (badge "Tải lên trực tiếp")

### TeacherDashboardPage
- Load song song: `getTeacherDashboard(sessionId)` + `sessionService.get(sessionId)` (lấy `classroomId`)
- Nếu nhận `SESSION_NOT_ENDED` error → retry sau 1.5s
- **Không dùng Recharts BarChart** (chỉ còn Pie): "Kết quả theo câu hỏi" = thanh ngang xếp chồng đúng/sai/bỏ qua per câu (tự luận: tham gia/bỏ qua, màu primary); "Phân bố đáp án" trong panel câu = hàng option có thanh nền tỉ lệ (width theo `count/maxCount`), đáp án đúng tô emerald. Ngưỡng màu rate: emerald ≥70% | amber 40–70% | rose <40%
- **Toàn bộ answers load 1 lần** sau khi dashboard về: `Promise.all(questions.map(q => answerService.list(sessionId, q.id)))` → `Map<questionId, StudentAnswerDto[]>` (backend `StudentAnswerController.getAnswers` cho teacher xem toàn bộ, không giới hạn session ended). Dùng cho 2 chỗ: (1) panel mỗi câu — `QuestionAnswers` (MCQ: hàng HS + chip đáp án đã chọn emerald/rose theo `option.correct` + icon `isCorrect` + confidence + giờ nộp; essay: card `.sq-rich`); (2) tab Kết quả học sinh — Table `expandable` (`expandRowByClick`) → `StudentAnswerDetail` liệt kê từng câu kèm đáp án đã chọn/bài tự luận/Bỏ qua. Summary row đầu phải `colSpan={2}` (Table expandable thêm cột expand icon)

### StudentReviewPage
- Performance thresholds: "Xuất sắc!" ≥70% emerald | "Khá tốt!" 40–70% amber | "Cần cố gắng hơn" <40% rose
- Load song song: `getStudentReview(sessionId)` + `sessionService.get(sessionId)` (lấy `classroomName`)
- "Kết quả theo câu hỏi" = dải ô vuông kiểu answer-sheet (KHÔNG phải BarChart — cũ là BarChart mọi cột `value:1` chỉ khác màu): mỗi ô đánh số, màu theo result (emerald đúng / rose sai / muted bỏ qua / primary tự luận đã nộp), tooltip kèm confidence; bấm ô → `scrollIntoView` tới card chi tiết (`id="review-q-{q.id}"`, `scrollMarginTop: 80` trừ hao sticky header). Radar chart "Tự tin & Chính xác" giữ nguyên

### TeacherSessionPage
- **StrictMode guard**: init trong `setTimeout(fn, 0)` + `cancelled` flag — StrictMode cleanup sync trước timeout, cancel mount đầu; mọi `await` đều guard `if (cancelled) return`
- **`viewMode`** (derived, không phải state): `showBreakoutPanel → 'breakout'` | `runningQuestion?.status === 'running' → 'running'` | `'ended'` | `'idle'`
- **`presenceRef`**: `useRef<PresenceDto[]>` sync với `presence` state để WS handler đọc latest value không stale
- Init: `sessionService.start(classroomId)` — backend trả về session hiện có nếu đã active
- **Đồng hồ buổi học**: `elapsedSeconds` tính từ `session.startedAt` (server Instant) + `clockOffsetRef`, KHÔNG đếm từ 0 — reload không bị reset

### StudentSessionPage
- Cùng **StrictMode guard** pattern với TeacherSessionPage
- Init flow: `listByClassroom` → find active → `join(sessionId)` → load presence/chat/questions/**breakout getActive** parallel → WS connect
- **`onConnected` callback** (breakout-aware): refresh presence → nếu đang ở sub-room chỉ `callPeer` bạn cùng phòng (+GV nếu `teacherRoomIdRef` = phòng mình); nếu ở phòng chính: `callPeer(teacherIdRef)` (trừ khi GV đang ở sub-room) + `callPeer` HS online KHÔNG thuộc sub-room — phải chủ động call vì backend broadcast `student_presence` TRƯỚC khi student subscribe `/user/queue/private`
- `student_presence` payload: `{ studentId, action, name, avatarColor }` — `name`/`avatarColor` từ WS session attributes, không cần REST lookup; handler `joined` chỉ `callPeer` khi người mới cùng "phòng" với mình (guard `myRoomRef`/`breakoutMemberIdsRef`)

### Breakout: khôi phục sau reload + HS rời lớp (cả 2 trang session)
- **Backend lưu `teacherRoomId`** trên `breakout_sessions` (migration V13; `joinRoom` set, `leaveRoom` clear) → `BreakoutSessionDto.teacherRoomId` cho FE biết GV đang ở phòng nào sau reload
- **Student reload giữa breakout**: init fetch `breakoutService.getActive` → khôi phục `myRoom`/`breakoutMemberIds`/`teacherInRoom`/`teacherAway` TRƯỚC khi WS connect; `ws.subscribeRoom(roomId)` gọi trước khi STOMP connect vẫn hoạt động (xem WebSocket layer)
- **Teacher reload giữa breakout**: init khôi phục `teacherJoinedRoomId` + collapse panel; `onConnected` gọi lại `breakoutService.joinRoom` → backend re-broadcast `teacher_joined_room` → HS trong phòng PHẢI `closePeer(teacherId)` trước khi `callPeer` — GV reload không phát event nào nên PC cũ phía HS vẫn 'connected' (stale), mà `callPeer` skip PC chưa closed/failed → không closePeer trước thì không có offer mới, GV mất kết nối vĩnh viễn. GV ở phòng chính thì tự `callPeer` HS chưa phân phòng (HS renegotiate qua `handleOffer`, cùng đường với reload GV ngoài breakout)
- **Refs cho closure**: `myRoomRef` (RoomDto), `breakoutMemberIdsRef`, `teacherRoomIdRef` (student) / `breakoutRef`, `teacherJoinedRoomIdRef` (teacher) — WS handler + onConnected đọc latest value; cập nhật `.current` trực tiếp trong handler, effect sync làm dự phòng
- **HS rời lớp khi đang breakout**: lưới video phòng nhóm lọc `room.students` theo presence online (HS offline bỏ tile luôn, không hiện avatar kiểu tắt camera) — cả grid HS (`myRoom.students.filter`) lẫn grid GV (`joinedRoomOnlineStudents`); tag "X bạn đang ở phòng nhóm" đếm theo online

### Question countdown & hết giờ (cả 2 trang session)
- `question_started` payload có `serverNow` → `clockOffsetRef = serverNow - Date.now()`; countdown = `endsAt - (now + offset)` — đồng hồ máy client có thể lệch server, không trừ thẳng `Date.now()`
- Student: `answerLocked = questionSubmitted || status==='ended' || timeRemaining===0` — khóa chọn đáp án/editor/confidence, footer hiện "Đã hết thời gian"; `question_ended` mở lại panel
- Auto-submit khi còn ≤1s (KHÔNG phải 0s — server auto-end đúng `endsAt`, gửi tại 0s thua race bị `QUESTION_NOT_RUNNING`) và chỉ khi có nội dung (không ghi nhận answer rỗng)
- `handleSubmit` catch `QUESTION_NOT_RUNNING` → bỏ flag submitted + set status ended + message.error (không hiện "Đã gửi" giả)
- **Countdown khi panel thu nhỏ** (Student): nút question trên control bar + pill "Câu hỏi đang chờ" trên header hiện thời gian còn lại (`formatCountdown`); ≤10s và panel đang đóng → class `.sq-pulse-danger` nhấp nháy đỏ (CtrlBtn nhận prop `className`)

### Chống lộ đáp án + reveal sau khi kết thúc (Q&A)
- **Backend KHÔNG gửi `isCorrect` cho học sinh**: broadcast `question_started` strip isCorrect (`OptionDto.withoutCorrect()` — topic chung cả lớp); REST `GET /questions` sanitize khi caller không phải owner (`QuestionDto.sanitized()`). FE `OptionDto.isCorrect` là optional
- **`question_ended` payload = `{ questionId, correctOptionIds }`** (cả end thủ công lẫn auto-end timer) — đáp án đúng chỉ tiết lộ lúc này
- **StudentSessionPage reveal**: state `correctOptionIds` set từ `question_ended` (reset khi `question_started`); option đúng tô emerald + check, option mình chọn sai tô rose + X (`optionRevealStyle`/`optionRevealIcon`); footer hiện "Chính xác!/Chưa đúng — đáp án đúng: A, B/Đáp án đúng: ..." — đúng = tập `selectedOptions` trùng khớp tập `correctOptionIds` (cùng quy tắc chấm exact-set với backend `computeIsCorrect`). Essay không reveal. Reload sau khi ended thì không khôi phục reveal (chỉ câu running được restore)
- **TeacherSessionPage**: fallback dựng question từ WS payload (reconnect) giờ thiếu isCorrect → `usedFallback` flag refetch `questionService.list` (owner thấy đầy đủ) để highlight đáp án đúng

## TypeScript config

`tsconfig.app.json` strict: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.  
`React.ReactNode` không cần `import React` (global namespace trong react-jsx transform) — pattern nhất quán toàn codebase.

## Auth & API layer

- `accessToken` trong Zustand memory (không localStorage); `refreshToken` là httpOnly cookie
- `src/lib/api.ts`: 401 → silent refresh (queue pattern — nhiều request cùng lúc chỉ trigger 1 refresh); guard `!url.includes('/auth/refresh')` tránh retry loop
- `injectAuthHooks(getToken, setToken, clearAuth, setUser)` — sau refresh thành công, set cả `user` lẫn `accessToken`
- **AuthBootstrap** (`App.tsx`): `authService.refresh()` on mount → restore session hoặc `clearAuth()`; `<Spin>` toàn trang trong lúc chờ
- **ProtectedRoute**: `user === null` sau bootstrap → redirect `/login`

## WebSocket layer (`src/lib/websocket.ts`)

- `createSessionWsClient(ticket, sessionId, onReconnect, onConnected?)` — WS theo phiên học
- `createAppWsClient(ticket, onReconnect)` — WS cấp ứng dụng (ngoài phiên); chỉ có `subscribeTopic(destination, handler)` (trả hàm unsubscribe) + `disconnect()`; STOMP-level heartbeat (25s), không heartbeat presence; resubscribe toàn bộ topic sau reconnect. Dùng cho push `session_started`/`session_ended` ở `ClassListPage` (thay polling)
- **Ticket qua URL query param**: `new SockJS(\`${WS_URL}?ticket=${encodeURIComponent(ticket)}\`)` — KHÔNG dùng `connectHeaders: { ticket }` (STOMP headers post-handshake, backend không đọc được)
- Ticket **dùng 1 lần**, TTL 60s — kết nối ngay sau khi nhận
- Heartbeat: publish `/app/session/{id}/heartbeat` mỗi 25s
- Reconnect: `onReconnect()` → ticket mới → `client.webSocketFactory` cập nhật trước STOMP retry
- Subscriptions: `/topic/session/{id}` + `/user/queue/private`; `subscribeRoom/unsubscribeRoom` cho breakout
- `subscribeRoom` gọi được TRƯỚC khi STOMP connect (handler lưu vào `roomHandlers`); `onConnect` (re)subscribe toàn bộ room topic — vừa phục vụ khôi phục breakout khi reload, vừa giữ room subscription sau reconnect

## WebRTC (`src/config/webrtc.ts`, `src/hooks/useWebRTC.ts`)

- ICE: Google STUN + local STUN/TURN tại `${VITE_TURN_HOST}:3478`; credentials `classpulse`/`secret123` (phải khớp `turnserver.conf`: `lt-cred-mech`)
- `pcsRef: Map<peerId, PeerEntry>` — source of truth; `peers` state là bản sao để trigger re-render
- `ontrack` dùng `event.track` trực tiếp, không `event.streams[0].getTracks()` — tránh duplicate add
- ICE buffering: buffer vào `iceBuf` nếu `remoteDescription` chưa set; drain sau `setRemoteDescription`
- Glare: rollback `setLocalDescription({type:'rollback'})` khi nhận offer trong trạng thái `have-local-offer`
- **`callPeer` skip PC "usable"** (chưa `closed`/`failed` — kể cả `disconnected`): peer reload thì PC cũ phía mình vẫn 'connected' nhiều giây → muốn ép re-offer phải `closePeer` trước (xem Breakout reload)
- Teacher: `callPeer(studentId)` khi nhận `student_presence` joined
- Student `onConnected`: `callPeer` tất cả (teacher + HS online); student join SAU mình: polite-peer (UUID nhỏ hơn offer trước)

## Backend notes (`C:\code\datn\classpulse`)

### `PresenceDto.java`
`private boolean isOnline` + Lombok `@Getter` → Jackson serialize thành `"online"` (bỏ prefix `is`). **Fix**: `@JsonProperty("isOnline")` trên field.

### `JwtHandshakeHandler.java`
Lưu `userName` + `userAvatarColor` vào WS session attributes → `PresenceEventListener` đính kèm vào events mà không cần DB lookup.

### `PresenceEventListener.java`
`handleConnect` fires tại STOMP CONNECT, TRƯỚC khi server gửi CONNECTED frame → backend broadcast `student_presence` khi S2 chưa subscribe `/user/queue/private`. Frontend xử lý bằng `onConnected` callback.

### Classroom-level broadcast (`SessionBroadcastService` / `SessionController`)
`broadcastToClassroom(classroomId, type, payload)` → `/topic/classroom/{classroomId}`. `SessionController.start()` phát `session_started`, `end()` phát `session_ended` (kèm `{classroomId, sessionId}`) — ngoài broadcast `session_ended` sẵn có tới `/topic/session/{id}` cho participant. `SessionEndResponse` có thêm field `classroomId` để controller phát được. `JwtChannelInterceptor` chỉ cần principal đã xác thực cho SUBSCRIBE, không giới hạn destination → không cần sửa security config. FE `ClassListPage` subscribe để cập nhật LIVE badge realtime thay polling.

### Breakout `teacherRoomId` (`BreakoutSession` / `BreakoutService`)
Cột `teacher_room_id` (nullable, FK `breakout_rooms` ON DELETE SET NULL — migration `V13__breakout_teacher_room.sql`). `joinRoom` persist, `leaveRoom` clear (cả 2 đổi từ `readOnly=true` sang transactional ghi). `BreakoutSessionDto` trả `teacherRoomId` để FE khôi phục vị trí GV sau reload.

### Question — ẩn đáp án (`QuestionController` / `QuestionService` / `QuestionTimerService`)
`OptionDto.isCorrect` đổi sang `Boolean` + `@JsonInclude(NON_NULL)`; `withoutCorrect()` trả bản null. `QuestionController.start` broadcast options đã strip; `list` sanitize khi `!sessionSecurity.isOwner`. `question_ended` (controller.end + timer auto-end + recover sau restart) gửi kèm `correctOptionIds` — `QuestionService.getCorrectOptionIds`; trong `QuestionTimerService.autoEndQuestion` đọc options bên trong `transactionTemplate` (lazy) rồi trả ra cho broadcast.

### `UserService.listUsers` (admin list users)
`Role` map qua `AttributeConverter` (lowercase string). JPQL kiểu `(:role IS NULL OR u.role = :role)` bind NULL cho param enum đã convert → PostgreSQL `could not determine data type of parameter $1` → **500** khi gọi `/users` không kèm filter. **Fix**: dùng `JpaSpecificationExecutor` + `Specification` (chỉ thêm predicate khi filter có giá trị), không so sánh NULL với param untyped. `UserRepository` bỏ `findFiltered`, extends thêm `JpaSpecificationExecutor<User>`.

## Project status — Phase 1–4 (M01–M16) hoàn chỉnh

`src/mock/` đã xóa hoàn toàn. Không còn mock data.

| Trang | API sử dụng |
|---|---|
| LoginPage | `authService.login` |
| AppLayout | `authStore.user`; `authService.logout` |
| ClassListPage | `classroomService.list/create/join` |
| ClassDetailPage | classroom/post/schedule/member/document services; đầy đủ CRUD |
| ProfilePage | `userService.getMe/updateMe/uploadAvatar` |
| TeacherSessionPage | `sessionService.start`; questionService; breakoutService; WS |
| StudentSessionPage | `sessionService.join/leave`; `answerService.submit`; WS |
| TeacherDashboardPage | `dashboardService.getTeacherDashboard` → `DashboardResponse` |
| StudentReviewPage | `dashboardService.getStudentReview` → `ReviewResponse` |
| AdminPage | `adminService.getStats/listClassrooms/listUsers/updateUser` |
