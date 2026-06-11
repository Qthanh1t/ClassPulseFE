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

**Không dùng `#1677ff` (AntD blue mặc định) trong code mới.**

### Color tokens (`src/index.css`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--sq-primary` | `#6366f1` | Indigo — màu chính |
| `--sq-primary-dark` | `#4f46e5` | Hover/pressed |
| `--sq-primary-light` | `#eef2ff` | Background active nav, tag |
| `--sq-bg` | `#f8fafc` | Background trang |
| `--sq-surface` | `#ffffff` | Card, modal, sidebar |
| `--sq-border` | `#e2e8f0` | Border toàn bộ |
| `--sq-text` | `#0f172a` | Text chính |
| `--sq-text-secondary` | `#64748b` | Text phụ |
| `--sq-text-muted` | `#94a3b8` | Text mờ/label |
| `--sq-emerald` | `#10b981` | Đúng, thành công, online |
| `--sq-amber` | `#f59e0b` | Cảnh báo, trung bình |
| `--sq-rose` | `#f43f5e` | Sai, lỗi |

### Typography
Font: **Outfit** (Google Fonts). Heading: weight 700 `#0f172a` | Body: 14px `#374151` | Secondary: 13px `#64748b` | Muted: 12–13px `#94a3b8`.

### Subject gradients (card banner)
`Frontend` → `#6366f1,#8b5cf6` | `Database` → `#0ea5e9,#0369a1` | `Architecture` → `#f59e0b,#dc2626` | Default → `#10b981,#059669`

### AntD ConfigProvider
`colorPrimary: '#6366f1'`, `borderRadius: 10`, font Outfit. Component overrides: Card 16, Button 10, Tag 6, Tabs inkBar indigo, Progress indigo.

### Border radius
Page/hero 20 · card 16 · post/schedule item 14 · button/input/tag 10 · pill 20

### Gradient primary button
```
style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 }}
```

### CSS utilities (`index.css`)
`.sq-card-hover` hover lift | `.sq-nav-item` / `.sq-nav-item.active` sidebar nav | `.sq-stat-card` hover shadow

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
  index.css         # Outfit import, CSS tokens (:root), .sq-* utilities
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
      BreakoutPanel.tsx       # breakout=null → setup; breakout!=null → active. Setup: chọn từng HS + modal thêm hàng loạt theo phòng + chia ngẫu nhiên nhanh (UI-only, xác nhận bằng "Bắt đầu breakout")
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
- Bar chart màu bar: emerald ≥70% | amber 40–70% | rose <40% (`correctCount/answeredCount`)
- Câu tự luận: panel expand → `EssayAnswerList` lazy-load `answerService.list(sessionId, questionId)` (AntD Collapse mount children khi mở lần đầu); render `essayText` HTML qua `.sq-rich`; backend `StudentAnswerController.getAnswers` cho teacher xem toàn bộ đáp án, không giới hạn session ended

### StudentReviewPage
- Performance thresholds: "Xuất sắc!" ≥70% emerald | "Khá tốt!" 40–70% amber | "Cần cố gắng hơn" <40% rose
- Load song song: `getStudentReview(sessionId)` + `sessionService.get(sessionId)` (lấy `classroomName`)

### TeacherSessionPage
- **StrictMode guard**: init trong `setTimeout(fn, 0)` + `cancelled` flag — StrictMode cleanup sync trước timeout, cancel mount đầu; mọi `await` đều guard `if (cancelled) return`
- **`viewMode`** (derived, không phải state): `showBreakoutPanel → 'breakout'` | `runningQuestion?.status === 'running' → 'running'` | `'ended'` | `'idle'`
- **`presenceRef`**: `useRef<PresenceDto[]>` sync với `presence` state để WS handler đọc latest value không stale
- Init: `sessionService.start(classroomId)` — backend trả về session hiện có nếu đã active

### StudentSessionPage
- Cùng **StrictMode guard** pattern với TeacherSessionPage
- Init flow: `listByClassroom` → find active → `join(sessionId)` → load presence/chat/questions parallel → WS connect
- **`onConnected` callback**: refresh presence → `callPeer(teacherIdRef)` + `callPeer` tất cả HS online — phải chủ động call vì backend broadcast `student_presence` TRƯỚC khi student subscribe `/user/queue/private`
- `student_presence` payload: `{ studentId, action, name, avatarColor }` — `name`/`avatarColor` từ WS session attributes, không cần REST lookup

### Question countdown & hết giờ (cả 2 trang session)
- `question_started` payload có `serverNow` → `clockOffsetRef = serverNow - Date.now()`; countdown = `endsAt - (now + offset)` — đồng hồ máy client có thể lệch server, không trừ thẳng `Date.now()`
- Student: `answerLocked = questionSubmitted || status==='ended' || timeRemaining===0` — khóa chọn đáp án/editor/confidence, footer hiện "Đã hết thời gian"; `question_ended` mở lại panel
- Auto-submit khi còn ≤1s (KHÔNG phải 0s — server auto-end đúng `endsAt`, gửi tại 0s thua race bị `QUESTION_NOT_RUNNING`) và chỉ khi có nội dung (không ghi nhận answer rỗng)
- `handleSubmit` catch `QUESTION_NOT_RUNNING` → bỏ flag submitted + set status ended + message.error (không hiện "Đã gửi" giả)

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

## WebRTC (`src/config/webrtc.ts`, `src/hooks/useWebRTC.ts`)

- ICE: Google STUN + local STUN/TURN tại `${VITE_TURN_HOST}:3478`; credentials `classpulse`/`secret123` (phải khớp `turnserver.conf`: `lt-cred-mech`)
- `pcsRef: Map<peerId, PeerEntry>` — source of truth; `peers` state là bản sao để trigger re-render
- `ontrack` dùng `event.track` trực tiếp, không `event.streams[0].getTracks()` — tránh duplicate add
- ICE buffering: buffer vào `iceBuf` nếu `remoteDescription` chưa set; drain sau `setRemoteDescription`
- Glare: rollback `setLocalDescription({type:'rollback'})` khi nhận offer trong trạng thái `have-local-offer`
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
