# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**ClassPulse** — Nền tảng tương tác thời gian thực cho lớp học nhóm nhỏ (đồ án tốt nghiệp).

Triết lý cốt lõi: **tối đa hóa tương tác hai chiều** trong mỗi buổi học. Không chỉ là Q&A — mọi kênh tương tác (video, câu hỏi, raise hand, chat, breakout, focus spotlight) đều hoạt động trong cùng một phiên, mục tiêu là không để học sinh nào "mất kết nối" với buổi học.

### Roles
- **Teacher**: quản lý lớp, điều phối tương tác (câu hỏi, breakout, focus, broadcast), xem dashboard
- **Student**: tham gia lớp, tương tác đa kênh (trả lời câu hỏi, raise hand, chat), xem báo cáo cá nhân
- **Admin**: quản lý user, lớp học, hệ thống

### Core features — tất cả xảy ra realtime trong buổi học

1. **Classroom Management** — tạo lớp, đăng bài kèm file, lịch học (tương tự Microsoft Teams)
2. **Live Video Session** — video/audio realtime (WebRTC); GV screen share; thumbnail từng HS
3. **Confidence-based Q&A** — GV đặt câu hỏi (trắc nghiệm 1/nhiều đáp án, tự luận) + timer tùy chọn; HS trả lời kèm mức tự tin (Thấp/Trung bình/Cao); câu hỏi tự kết thúc khi hết giờ
4. **Silent Student Detection** — phát hiện HS không trả lời; alert hiển thị tên cụ thể để GV nhắc nhở
5. **Raise Hand** — HS giơ tay, GV thấy ✋ trên thumbnail và danh sách thành viên
6. **Live Chat** — chat realtime trong buổi học
7. **Dynamic Breakout Rooms** — GV tự tạo số phòng tùy ý, gán HS vào từng phòng; GV có thể "vào" bất kỳ phòng nào để trao đổi trực tiếp (kể cả trao đổi riêng 1-1 hoặc 1-nhóm nhỏ); HS còn lại vẫn hoạt động bình thường trong phòng của họ
8. **Focus Mode (Spotlight)** — GV chọn 1 HS để focus; camera/màn hình HS đó được phóng to ngang với GV (layout 2 ô cạnh nhau), hỗ trợ trao đổi trực tiếp 1-1 trong phòng chính
9. **Micro Task** — giao nhiệm vụ cụ thể cho từng nhóm breakout
10. **Broadcast** — GV gửi thông báo đến tất cả HS kể cả khi đang trong breakout
11. **Quick Actions** — GV nhanh chóng tạo câu hỏi hoặc mở breakout ngay trong buổi học
12. **Teacher Dashboard** — thống kê kết quả + confidence theo từng câu hỏi; danh sách HS và điểm số
13. **Student Session Review** — HS xem lại câu hỏi, đúng/sai/bỏ qua, mức tự tin đã chọn

**Lưu ý quan trọng**: Mọi tính năng tương tác (Q&A, breakout, focus, chat, raise hand) đều xảy ra **trong cùng một buổi học online** (realtime). Khi không có câu hỏi đang chạy, màn hình GV và HS hiển thị vùng video/screen share của GV.

## System architecture

| Layer | Technology |
|---|---|
| Frontend (this repo) | React 19 + TypeScript + Vite |
| Backend | Java (separate repo) |
| Realtime | WebSocket / Socket.io |
| Video | WebRTC |
| Database | PostgreSQL |

## Frontend stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite` — no `tailwind.config.js` needed)
- **Ant Design v6** + **@ant-design/icons** — primary UI component library; theme được set qua `ConfigProvider` trong `App.tsx`
- **react-router-dom v7** — routing
- **CKEditor5 v48** (`ckeditor5`, `@ckeditor/ckeditor5-react`) — rich text editor dùng trong `CreateQuestionModal`; tích hợp KaTeX (`katex`) cho công thức toán
- **Recharts v3** — biểu đồ (BarChart, PieChart, RadarChart) dùng trong `TeacherDashboardPage` và `StudentReviewPage`
- **@stomp/stompjs v7** + **sockjs-client v1** — WebSocket layer cho realtime session (M13)

## Design system

Toàn bộ giao diện tuân theo design system sau. **Không dùng màu #1677ff (AntD blue mặc định) trong code mới.**

### Color tokens (CSS custom properties — `src/index.css`)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--sq-primary` | `#6366f1` | Indigo — màu chính, nút primary, active nav |
| `--sq-primary-dark` | `#4f46e5` | Hover/pressed states |
| `--sq-primary-light` | `#eef2ff` | Background active nav, tag màu nhạt |
| `--sq-bg` | `#f8fafc` | Background trang (Slate 50) |
| `--sq-surface` | `#ffffff` | Card, modal, sidebar |
| `--sq-border` | `#e2e8f0` | Border toàn bộ (Slate 200) |
| `--sq-text` | `#0f172a` | Text chính (Slate 900) |
| `--sq-text-secondary` | `#64748b` | Text phụ (Slate 500) |
| `--sq-text-muted` | `#94a3b8` | Text mờ, label (Slate 400) |
| `--sq-emerald` | `#10b981` | Đúng, thành công, online |
| `--sq-amber` | `#f59e0b` | Cảnh báo, điểm trung bình |
| `--sq-rose` | `#f43f5e` | Sai, lỗi, không tham gia |

### Typography

Font: **Outfit** (Google Fonts — import trong `index.css`). Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.

- Heading: `fontWeight: 700`, `color: #0f172a`
- Body: `fontSize: 14`, `color: #374151`
- Secondary: `fontSize: 13`, `color: #64748b`
- Muted/label: `fontSize: 12–13`, `color: #94a3b8`

### Subject gradients (dùng cho banner card lớp học)

| Subject | Gradient |
|---|---|
| `Frontend` | `linear-gradient(135deg, #6366f1, #8b5cf6)` — Indigo/Violet |
| `Database` | `linear-gradient(135deg, #0ea5e9, #0369a1)` — Sky/Blue |
| `Architecture` | `linear-gradient(135deg, #f59e0b, #dc2626)` — Amber/Red |
| Default | `linear-gradient(135deg, #10b981, #059669)` — Emerald |

### AntD ConfigProvider (App.tsx)

`colorPrimary: '#6366f1'`, `borderRadius: 10`, font Outfit, custom component tokens cho Card (borderRadius 16), Button (borderRadius 10), Tag (borderRadius 6), Tabs (inkBarColor indigo), Progress (defaultColor indigo).

### CSS utility classes (`index.css`)

- `.sq-card-hover` — hover lift animation (`translateY(-3px)`, `box-shadow`) cho course card
- `.sq-nav-item` — transition màu/bg cho nav button trong sidebar; `.sq-nav-item.active` để set active state
- `.sq-stat-card` — hover box-shadow cho stat card trên dashboard

### Border radius conventions

- Page section / hero banner: `borderRadius: 20`
- Card lớp học, dashboard card: `borderRadius: 16`
- Nội dung nhỏ hơn (post, schedule item): `borderRadius: 14`
- Button, input, tag: `borderRadius: 10` (inherit từ ConfigProvider)
- Tag pill: `borderRadius: 20` (override cho pill style)

### Gradient button primary

Thay vì dùng `type="primary"` mặc định, nút chính quan trọng dùng:
```
style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 }}
```

## Commands

```bash
npm run dev        # khởi động dev server với HMR (localhost:5173)
npm run build      # type-check (tsc -b) rồi build production
npm run lint       # chạy ESLint
npm run preview    # xem trước bản build
```

Chưa có test runner.

## Routing

| Path | Component | Ghi chú |
|---|---|---|
| `/` | redirect → `/login` | |
| `/login` | `LoginPage` | Không dùng `AppLayout`; layout 2 cột brand + form |
| `/classes` | `ClassListPage` | Dùng `AppLayout` (sidebar) |
| `/classes/:id` | `ClassDetailPage` | Dùng `AppLayout` |
| `/session/teacher/:id` | `TeacherSessionPage` | Layout riêng, fullscreen |
| `/session/student/:id` | `StudentSessionPage` | Layout riêng, fullscreen |
| `/dashboard/:sessionId` | `TeacherDashboardPage` | Dùng `AppLayout` |
| `/review/:sessionId` | `StudentReviewPage` | Dùng `AppLayout` |
| `/profile` | `ProfilePage` | Dùng `AppLayout`; hiện thông tin + stats giáo viên |

Session pages (`/session/*`) và `LoginPage` **không dùng `AppLayout`** — chúng có layout riêng.

## Code structure

```
src/
  types/
    index.ts                  # TypeScript interfaces cho mock data (dead code — không còn import ở đâu)
    api.ts                    # DTO types cho API: ApiResponse, AuthResponse, ClassroomDto, PostDto, ScheduleDto, DocumentDto, ...
  index.css                   # Outfit font import, CSS tokens (:root), utility classes (.sq-*)
  App.tsx                     # Router + AntD ConfigProvider + AuthBootstrap + ProtectedRoute
  main.tsx                    # bootstrap authStore (wire axios interceptors trước khi render)
  lib/
    api.ts                    # Axios instance; Bearer token interceptor; silent refresh on 401 (queue pattern); injectAuthHooks(getToken, setToken, clearAuth, setUser)
    websocket.ts              # STOMP/SockJS factory; createSessionWsClient(ticket, sessionId, onReconnect); xử lý 14 event types, heartbeat 25s, auto-reconnect
  store/
    authStore.ts              # Zustand store: { user, accessToken, setAuth, setToken, clearAuth }; gọi injectAuthHooks khi khởi tạo
  services/
    auth.service.ts           # login, register, refresh, logout, getWsTicket
    user.service.ts           # getMe, updateMe, uploadAvatar
    classroom.service.ts      # list, get, create, update, remove, join, getMembers, kickMember, regenerateJoinCode
    post.service.ts           # list, create, update, remove, addAttachments, removeAttachment
    schedule.service.ts       # list, create, update, remove
    document.service.ts       # list, upload, remove
    upload.service.ts         # presign + putToMinIO + uploadFile
    session.service.ts        # start, listByClassroom, get, end, join, leave, getPresence (M09)
    question.service.ts       # list, create, start, end, getStats (M10)
    answer.service.ts         # submit, list (M11)
    breakout.service.ts       # create, getActive, end, broadcast, joinRoom, leaveRoom (M12)
    chat.service.ts           # getHistory cursor-based (M13)
    dashboard.service.ts      # getTeacherDashboard, getStudentReview (M14/M15)
    admin.service.ts          # getStats, listClassrooms, listUsers, updateUser (M16)
  components/
    layout/AppLayout.tsx      # Sidebar (232px, fixed) + Header (sticky) + <Outlet />; đọc user từ authStore
    session/
      StudentStatusList.tsx   # props: participants: Participant[], answeredIds, silentStudentIds, raisedHandIds, questionActive
      LiveQuestionStats.tsx   # props: stats: QuestionStatsDto, questionType: QuestionType
      ConfidenceSelector.tsx
      CreateQuestionModal.tsx # modal 2 bước; onSubmit: (req: CreateQuestionRequest) => void; đáp án MCQ hỗ trợ LaTeX
      BreakoutPanel.tsx       # props: sessionId, breakout: BreakoutSessionDto|null, presence, onClose; setup mode khi breakout=null; active mode khi breakout!=null
      ChatPanel.tsx
      RichTextEditor.tsx      # CKEditor5; prop initialValue để pre-fill khi edit post
      CtrlBtn.tsx
  pages/
    LoginPage.tsx             # gọi authService.login; navigate /classes sau login
    ProfilePage.tsx           # gọi userService.getMe/updateMe/uploadAvatar
    classroom/ClassListPage.tsx     # classroomService.list/create/join
    classroom/ClassDetailPage.tsx   # xem chi tiết bên dưới
    session/TeacherSessionPage.tsx  # Real API: sessionService.start + questionService + WS events
    session/StudentSessionPage.tsx  # Real API: sessionService.join + answerService + WS events
    dashboard/TeacherDashboardPage.tsx  # Real API: dashboardService.getTeacherDashboard
    dashboard/StudentReviewPage.tsx     # Real API: dashboardService.getStudentReview
```

## AppLayout

Sidebar **fixed** (không scroll theo trang), width 232px (collapsed: 64px). Content area dùng `marginLeft` động để tránh overlap.

- **Logo**: gradient rounded square (`#6366f1 → #8b5cf6`) + text "StudyQuest"
- **Nav primary** (`NAV_ITEMS`): Lớp học, Dashboard
- **Nav secondary** (`NAV_SECONDARY`): Cài đặt — (đã bỏ mục "Tài liệu"; tài liệu giờ nằm trong tab của ClassDetailPage)
- **Nav**: custom `<button>` (không dùng AntD `Menu`) với class `.sq-nav-item`; active dùng `background: #eef2ff, color: #6366f1, fontWeight: 600`
- **User card**: docked ở bottom sidebar, hiện tên + vai trò; ẩn khi collapsed (chỉ hiện Avatar)
- **Header**: sticky top-0, z-index 100; nút toggle sidebar + Bell badge + Avatar dropdown
- **Avatar dropdown**: "Hồ sơ" → navigate `/profile`; "Đăng xuất" → navigate `/login`

## LoginPage

Layout 2 cột (không dùng AppLayout):
- **Bên trái**: gradient indigo brand panel — logo, headline, danh sách 4 tính năng nổi bật
- **Bên phải**: form đăng nhập — badge "Demo Mode", role switcher (2 card GV/HS), email + password, nút "Vào StudyQuest →"
- Cả 2 role đều navigate → `/classes` sau khi đăng nhập
- Form UI only, không validate thật

## ClassListPage

- **Hero banner**: gradient indigo, hiện tên GV, số lớp, số HS, online count
- **`CourseCard`**: component nội bộ; banner gradient theo subject (xem Subject gradients); hover lift qua `.sq-card-hover`; 2 nút: "Bắt đầu (GV)" (gradient primary) + icon button vào học (học sinh)
- **`AddClassCard`**: placeholder dạng dashed border, tối giản
- **Join with code**: section cuối trang, Input + Button inline

## ClassDetailPage

- **Hero banner**: gradient theo subject (dùng `SUBJECT_STYLE` record trong file)
- **Tabs** (Bảng tin / Lịch học / Thành viên / Tài liệu): render trong `Card` borderRadius 16
- **Quản lý lớp (teacher only)**: nút `⋯` kebab menu trong hero banner — "Chỉnh sửa lớp" (modal pre-fill, `classroomService.update`), "Tạo mã mới" (`classroomService.regenerateJoinCode`, cập nhật `cls.joinCode` inline), "Xóa lớp" (Popconfirm → `classroomService.remove` → navigate `/classes`); nút `⟳` nhỏ cạnh badge mã lớp cũng trigger regen
- **Bảng tin — tạo/sửa/xóa post**: compose box dùng `RichTextEditor`; bài đăng có nút `⋯` (hiện với teacher hoặc tác giả) — "Chỉnh sửa" (inline `RichTextEditor` với `initialValue={post.content}`, `postService.update`), "Xóa bài" (Popconfirm → `postService.remove`); đính kèm file hiển thị chip indigo
- **Lịch học — tạo/sửa/xóa**: nút "Thêm buổi học" mở modal; mỗi buổi học có icon `EditOutlined` (mở modal pre-fill bằng `dayjs('2000-01-01 ' + s.startTime)` để tránh lỗi parse HH:mm) và `DeleteOutlined` với Popconfirm; modal dual-mode (create/edit) dùng `editingSchedule` state; `scheduleService.update/remove`
- **Tab Tài liệu**: tổng hợp tài liệu từ 2 nguồn — file đính kèm bài đăng (badge "Đăng bài") và upload trực tiếp của GV (badge "Tải lên trực tiếp"); nút "Tải lên" trigger hidden `<input type="file">`; constant `FILE_ICON` map ext → emoji icon

## TeacherDashboardPage

Dữ liệu từ `dashboardService.getTeacherDashboard(sessionId)` → `DashboardResponse`. Load song song với `sessionService.get(sessionId)` để lấy `classroomId` (dùng cho nút "Buổi học mới"). Nếu nhận `SESSION_NOT_ENDED` error thì retry sau 1.5s.

- **Header section**: dark indigo gradient (`#1e1b4b → #4338ca`)
- **`StatCard`**: component nội bộ; icon trong hộp màu nhạt (lightBg) + số lớn + label uppercase; 4 card: Câu hỏi, Điểm TB, Tham gia, Vắng mặt
- **Bar chart**: `questions: QuestionSummary[]`; màu bar theo `correctCount/answeredCount` (emerald ≥70%, amber 40–70%, rose <40%); axisLine/tickLine ẩn
- **Pie chart**: 3 màu emerald/rose/slate cho tỉ lệ đúng/sai/bỏ qua; tính từ `overallStats` + `questions` aggregate
- **Detail tabs**: "Chi tiết từng câu hỏi" dùng `Collapse` với `questions[].options`; "Kết quả học sinh" dùng `Table` từ `students: StudentResult[]` — cột Học sinh | Đã trả lời | Đúng | Bỏ qua | Điểm% (không có per-question matrix vì API chỉ trả aggregate); `rowKey="studentId"`

## StudentReviewPage

Dữ liệu từ `dashboardService.getStudentReview(sessionId)` → `ReviewResponse`. Load song song với `sessionService.get(sessionId)` để lấy `classroomName`. Student name/avatar từ `useAuthStore`.

- **Score hero card**: accent strip 4px ở top (gradient theo `scorePercent`); Progress circle 110px hiển thị `correctCount/mcqTotal`; 3 mini stat box (Đúng/Sai/Bỏ qua) với nền màu
- **Performance message**: 3 cấp độ — "Xuất sắc!" ≥70% (emerald), "Khá tốt!" 40–70% (amber), "Cần cố gắng hơn" <40% (rose)
- **Bar chart**: `questions: QuestionReview[]`; bars màu theo `result` (`correct`=emerald, `wrong`=rose, `skipped`=slate)
- **Radar chart**: 2 series — "Trả lời" (indigo) và "Đúng" (emerald); nhóm theo `confidence` (high/medium/low)
- **Question card**: border-left accent + header tinted background theo `result`; MCQ option highlight dùng `OptionReview.correct` (green) và `OptionReview.selectedByMe && !correct` (red)

## TeacherSessionPage

Route `:id` = `classroomId`. Init flow:
1. `sessionService.start(classroomId)` → `SessionDto` với `wsTicket`
2. Nếu lỗi `SESSION_ALREADY_ACTIVE`: `sessionService.listByClassroom` → find active → `authService.getWsTicket`
3. Load song song: `sessionService.getPresence`, `chatService.getHistory`, `questionService.list` (find running)
4. `createSessionWsClient(wsTicket, sessionId, () => authService.getWsTicket().ticket)`

**`viewMode`** (derived, không phải state): `breakout/showBreakoutPanel → 'breakout'` | `runningQuestion?.status === 'running' → 'running'` | `runningQuestion?.status === 'ended' → 'ended'` | `'idle'`

**WS events xử lý**: `student_presence` → `setPresence`; `question_started` → `setRunningQuestion` + reset stats; `question_ended` → update status; `raise_hand_changed` → `setRaisedHandIds`; `answer_aggregate` → `setQuestionStats`; `breakout_started/ended` → `setBreakout`; `chat_message` → append

**Các tính năng**:
- **Bottom control bar**: toggle mic/camera/screen share; toggle student list panel, quick actions panel, chat panel; nút "Kết thúc buổi học"
- **Session timer**: `setInterval` 1s từ khi mount, hiển thị `HH:MM:SS` ở top bar
- **Chat panel** (`ChatPanel`): init từ `chatService.getHistory`; gửi qua `ws.sendChat`; nhận qua WS `chat_message`
- **End session**: `sessionService.end(sessionId)` → navigate `/dashboard/${res.data.sessionId}`
- **Raised hand**: từ WS `raise_hand_changed`; hiển thị ✋ trên thumbnail HS trong `raisedHandIds`
- **Question timer**: `timeRemaining` tính từ `runningQuestion.endsAt` (server timestamp) và `now` tick; circular progress (44px) màu xanh→cam→đỏ; tự chuyển `ended` khi về 0
- **Silent student alert**: `questionStats.silentStudents[]` — Alert warning với avatar + tên từng HS
- **Focus mode**: `focusedStudentId: string | null`; `ws.sendFocus(studentId)`; main video area chia 2 grid; top bar Tag "Focus: [tên]" + nút X
- **CreateQuestion**: `handleCreateQuestion(req)` → `questionService.create` → `questionService.start` → set initial `questionStats`
- **BreakoutPanel**: props `{ sessionId, breakout, presence, onClose }`; `breakout === null` → setup (tạo phòng + gán HS từ `presence`); `breakout !== null` → active (join/leave/end/broadcast via `breakoutService`); WS event `breakout_started` tự flip sang active mode qua parent re-render
- **`presenceRef`**: `useRef<PresenceDto[]>` giữ sync với `presence` state để WS handler truy cập latest value

## StudentSessionPage

Route `:id` = `classroomId`. Init flow:
1. `sessionService.listByClassroom(classroomId)` → find active session
2. `sessionService.join(activeSession.id)` → `JoinSessionResponse { sessionId, classroomName, teacherName, wsTicket }`
3. Load song song: `sessionService.getPresence`, `chatService.getHistory`, `questionService.list` (find running → setRunningQuestion)
4. `createSessionWsClient(wsTicket, sessionId, () => sessionService.join(sessionId).wsTicket)`

Nếu không có session active → hiển thị màn hình "Không có buổi học đang diễn ra".

**WS events xử lý**: `student_presence` → `setPresence`; `question_started` → `setRunningQuestion` + reset answers + show panel/modal; `question_ended` → update status; `raise_hand_changed` → `setRaisedHandIds`; `breakout_started` → `setMyRoom` + `ws.subscribeRoom`; `breakout_ended` → `setMyRoom(null)` + unsubscribe; `broadcast_message` → `setBroadcastMsg`; `chat_message` → append

**Các tính năng**:
- **Panel thành viên** (trái, 200px): `[{ id:'teacher', teacherName, isTeacher:true }, ...presence]` qua `StudentStatusList`; toggle `TeamOutlined`
- **Floating question panel**: câu hỏi từ `runningQuestion: QuestionDto`; options type `single/multiple`; essay dùng `RichTextEditor`; `ConfidenceSelector`; thu nhỏ/phóng to; countdown timer từ `runningQuestion.endsAt`
- **Submit**: `answerService.submit(sessionId, questionId, { selectedOptionIds, essayText, confidence })`; auto-submit khi `timeRemaining === 0` via `submitFnRef`
- **Raise hand**: `ws.sendRaiseHand(raised)`; trạng thái MY raise hand = `raisedHandIds.includes(me?.id)`
- **Chat**: `ws.sendChat(text, roomId?)`; nhận WS `chat_message`; init từ `chatService.getHistory`
- **Breakout**: `myRoom: RoomDto | null`; grid từ `myRoom.students`; subscribe/unsubscribe room topic
- **Leave**: `sessionService.leave(sessionId)` → navigate `/review/:sessionId`
- **Bottom control bar** (dùng `CtrlBtn`): Mic | Camera | Screen Share | ✋ | — | Participants | Chat | Câu hỏi (nếu running) | — | Rời lớp; `overflowX: auto`

## TypeScript configuration

`tsconfig.app.json` strict settings: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. `tsc -b` chạy composite build gồm cả `tsconfig.app.json` và `tsconfig.node.json`.

`React.ReactNode` có thể dùng không cần `import React` (global namespace trong react-jsx transform) — đây là pattern nhất quán trong toàn bộ codebase.

## Auth & API layer

### Token management
- `accessToken` lưu trong Zustand memory (KHÔNG localStorage); `refreshToken` là httpOnly cookie do server set
- `src/lib/api.ts`: Axios instance; request interceptor đính Bearer token; response interceptor silent refresh on 401 (queue pattern — nhiều request cùng lúc chỉ trigger 1 lần refresh); guard `!original.url?.includes('/auth/refresh')` tránh retry loop
- `src/store/authStore.ts`: `injectAuthHooks(getToken, setToken, clearAuth, setUser)` — sau khi refresh interceptor thành công, set cả `user` lẫn `accessToken` vào store

### Bootstrap (reload persistence)
`AuthBootstrap` component trong `App.tsx` gọi `authService.refresh()` khi mount → nếu cookie còn hạn thì `setAuth(user, token)` khôi phục session; nếu không thì `clearAuth()`; hiển thị `<Spin>` toàn trang trong lúc chờ.

### Protected routes
`ProtectedRoute` trong `App.tsx` kiểm tra `user` từ store — nếu null sau khi bootstrap xong thì redirect về `/login`. Bọc toàn bộ routes cần auth (AppLayout routes + session routes).

### ScheduleDto time format
API trả `startTime`/`endTime` dạng `"HH:mm"` (string không có date). Khi pre-fill `TimePicker` dùng `dayjs('2000-01-01 ' + s.startTime)` — thêm date giả để tạo dayjs object hợp lệ (không cần plugin `customParseFormat`).

## Mock data conventions

`src/mock/` đã bị xóa hoàn toàn (Sprint 4). Không còn mock data nào trong codebase.

## WebSocket layer (`src/lib/websocket.ts`)

- `createSessionWsClient(ticket, sessionId, onReconnect)` — trả về `SessionWsClient` interface
- Ticket **dùng 1 lần**, TTL 60s — kết nối ngay sau khi nhận, không lưu localStorage
- Heartbeat publish tới `/app/session/{id}/heartbeat` mỗi 25s
- Khi disconnect: gọi `onReconnect()` để lấy ticket mới (teacher dùng `getWsTicket`, student dùng `sessionService.join`)
- Subscribe session chính: `/topic/session/{sessionId}` + unicast `/user/queue/private`
- Subscribe phòng nhỏ: `subscribeRoom(roomId, handler)` / `unsubscribeRoom(roomId)`
- Send methods: `sendChat`, `sendRaiseHand`, `sendFocus`, `sendWebRtcOffer/Answer/IceCandidate`

## AdminPage

Route `/admin` — chỉ hiển thị nav "Quản trị" trong sidebar khi `user.role === 'admin'`.

- **Stats section**: 6 card — Tổng user, Giáo viên, Học sinh, Lớp đang hoạt động, Lớp lưu trữ, Phiên đang diễn ra
- **Tab Lớp học**: `Table<AdminClassroomDto>` với search theo tên/GV; hiển thị archived status, studentCount, joinCode, createdAt
- **Tab Người dùng**: `Table<UserDto>` với search theo tên/email + filter theo role; `Select` inline đổi role; Popconfirm toggle `isActive`
- Tải song song: `Promise.all([getStats, listClassrooms({ limit: 100 }), listUsers({ limit: 100 })])`

## Project status

**Phase 1–4 (M01–M16) đã tích hợp hoàn chỉnh.**
Kế hoạch tích hợp đầy đủ: `ClassPulseDoc/plan/integration_plan_phase3_phase4.md`

| Trang | Trạng thái | API sử dụng |
|-------|-----------|-------------|
| LoginPage | ✅ Real API | `authService.login` |
| AppLayout | ✅ Real API | `authStore.user`; `authService.logout` |
| ClassListPage | ✅ Real API | `classroomService.list/create/join` |
| ClassDetailPage | ✅ Real API | classroom/post/schedule/member/document services; đầy đủ CRUD |
| ProfilePage | ✅ Real API | `userService.getMe/updateMe/uploadAvatar` |
| TeacherSessionPage | ✅ Real API | `sessionService.start`; `questionService.create/start/end`; `breakoutService.create/end/joinRoom/leaveRoom/broadcast`; WS events |
| StudentSessionPage | ✅ Real API | `sessionService.join/leave`; `answerService.submit`; WS events; `chatService.getHistory` |
| TeacherDashboardPage | ✅ Real API | `dashboardService.getTeacherDashboard` → `DashboardResponse` |
| StudentReviewPage | ✅ Real API | `dashboardService.getStudentReview` → `ReviewResponse` |
| AdminPage | ✅ Real API | `adminService.getStats/listClassrooms/listUsers/updateUser`; route `/admin` |

UI theo phong cách EdTech hiện đại (Coursera/Udemy style): font Outfit, design token indigo, subject-coded gradient card, bento dashboard stats, gamified student review.
