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
    index.ts                  # TypeScript interfaces cho mock data (session pages)
    api.ts                    # DTO types cho API: ApiResponse, AuthResponse, ClassroomDto, PostDto, ScheduleDto, DocumentDto, ...
  index.css                   # Outfit font import, CSS tokens (:root), utility classes (.sq-*)
  App.tsx                     # Router + AntD ConfigProvider + AuthBootstrap + ProtectedRoute
  main.tsx                    # bootstrap authStore (wire axios interceptors trước khi render)
  lib/
    api.ts                    # Axios instance; Bearer token interceptor; silent refresh on 401 (queue pattern); injectAuthHooks(getToken, setToken, clearAuth, setUser)
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
  mock/                       # static mock data — chỉ dùng cho session pages (WebRTC/WS chưa có)
    classrooms.ts
    students.ts
    questions.ts
    sessions.ts
  components/
    layout/AppLayout.tsx      # Sidebar (232px, fixed) + Header (sticky) + <Outlet />; đọc user từ authStore
    session/
      StudentStatusList.tsx
      LiveQuestionStats.tsx
      ConfidenceSelector.tsx
      CreateQuestionModal.tsx # modal 2 bước; đáp án MCQ hỗ trợ LaTeX; KaTeX preview
      BreakoutPanel.tsx
      ChatPanel.tsx
      RichTextEditor.tsx      # CKEditor5; prop initialValue để pre-fill khi edit post
      CtrlBtn.tsx
  pages/
    LoginPage.tsx             # gọi authService.login; navigate /classes sau login
    ProfilePage.tsx           # gọi userService.getMe/updateMe/uploadAvatar
    classroom/ClassListPage.tsx     # classroomService.list/create/join
    classroom/ClassDetailPage.tsx   # xem chi tiết bên dưới
    session/TeacherSessionPage.tsx  # vẫn dùng mock data (M09–M10 chưa sẵn sàng)
    session/StudentSessionPage.tsx  # vẫn dùng mock data
    dashboard/TeacherDashboardPage.tsx  # vẫn dùng mock data
    dashboard/StudentReviewPage.tsx     # vẫn dùng mock data
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

- **Header section**: dark indigo gradient (`#1e1b4b → #4338ca`)
- **`StatCard`**: component nội bộ; icon trong hộp màu nhạt (lightBg) + số lớn + label uppercase; 4 card trong Row gutter 16
- **Bar chart**: màu bar theo rate (emerald ≥70%, amber 40–70%, rose <40%); axisLine/tickLine ẩn
- **Pie chart**: 3 màu emerald/rose/slate; có mini stat row bên dưới
- **Detail tabs**: "Chi tiết từng câu hỏi" dùng `Collapse`; "Kết quả học sinh" dùng `Table` với summary row — mỗi ô câu hỏi hiển thị 2 thông tin xếp dọc: icon kết quả (✓/✗/–) + badge tự tin nhỏ (Cao/TB/Thấp màu emerald/amber/rose); có legend giải thích ký hiệu phía trên bảng; cột câu hỏi rộng 88px

## StudentReviewPage

- **Score hero card**: accent strip 4px ở top (gradient theo điểm); Progress circle 110px; 3 mini stat box (Đúng/Sai/Bỏ qua) với nền màu
- **Performance message**: 3 cấp độ — "Xuất sắc!" (emerald), "Khá tốt!" (amber), "Cần cố gắng hơn" (rose)
- **Bar chart**: bars màu emerald/rose/slate theo kết quả từng câu
- **Radar chart**: 2 series — "Trả lời" (indigo) và "Đúng" (emerald)
- **Question card**: border-left accent + header tinted background theo kết quả; MCQ option highlight (đúng: green, sai+chọn: red)

## TeacherSessionPage — demo state

Trang này dùng `Segmented` control ở top bar để switch giữa 4 state demo (thay cho websocket thật). Segmented không có label "Demo:" — blend vào dark header với `background: rgba(255,255,255,0.1)`.

| State | Mô tả |
|---|---|
| `idle` | Vùng video/screen share (ảnh `src/assets/hero.png` + overlay tên GV) + thumbnails HS; hỗ trợ **focus mode** (xem bên dưới) |
| `running` | Câu hỏi đang chạy + `LiveQuestionStats` cập nhật theo mock data |
| `ended` | Kết quả đầy đủ sau khi kết thúc câu hỏi |
| `breakout` | `BreakoutPanel` với 2 mode: **setup** (tạo phòng, gán HS) → **active** (GV vào/rời phòng, broadcast) |

Các tính năng khác trong trang:
- **Bottom control bar**: toggle mic/camera/screen share; toggle student list panel, quick actions panel, chat panel; nút "Kết thúc buổi học"
- **Session timer**: đếm thời gian từ khi vào trang (hiển thị `HH:MM:SS` ở top bar)
- **Chat panel** (`ChatPanel`): bật/tắt bằng nút chat ở bottom bar; dùng `MOCK_CHAT_MESSAGES` làm dữ liệu ban đầu
- **End session modal**: confirm trước khi điều hướng → `/dashboard/:sessionId`
- **Raised hand**: mock `raisedHandIds = ['s3', 's5']`, hiển thị ✋ trên thumbnail HS
- **Question timer**: khi GV đặt thời gian, hiển thị circular progress (44px) đếm ngược cạnh nút "Kết thúc"; màu xanh→cam→đỏ theo % còn lại; tự chuyển state `ended` khi về 0; reset khi kết thúc thủ công hoặc chuyển câu tiếp
- **Silent student alert**: khi `demoState === 'running'`, hiển thị Alert warning với avatar + tên cụ thể của từng HS trong `silentStudentIds`
- **Focus mode**: `focusedStudentId: string | null` state; khi `demoState === 'idle'` + focus bật → main video area chia 2 grid (GV trái, HS phải phóng to với viền indigo); top bar hiện Tag "Focus: [tên]" + nút X unfocus; thumbnail HS đang focus có viền indigo + nền nhạt; hover thumbnail → hiện `AimOutlined` icon để trigger focus

## StudentSessionPage — demo state

Trang này dùng `Segmented` control ở top bar để switch giữa 3 state demo (không có label "Demo:"):

| State | Mô tả |
|---|---|
| `idle` | Lớp học bình thường — video GV full + thumbnails các HS |
| `question` | Xuất hiện notification modal "GV vừa đặt câu hỏi"; floating question panel (góc dưới phải) để trả lời + chọn confidence |
| `breakout` | Banner tên nhóm + task; video grid chỉ hiện thành viên cùng nhóm; có nút demo "GV gửi thông báo" để trigger broadcast alert |

Các tính năng khác trong trang:
- **Panel thành viên** (trái, 200px): hiển thị `[TEACHER, ...STUDENTS]` qua `StudentStatusList`; GV có tag "(GV)"; toggle bằng nút `TeamOutlined` ở bottom bar
- **Floating question panel**: hiển thị câu hỏi, đáp án (single/multiple/essay), `ConfidenceSelector`; thu nhỏ được sau khi nộp; header hiện countdown timer Progress circle 34px (mock `QUESTION_TIMER_SECONDS = 90`); tự submit khi hết giờ
- **Demo loại câu hỏi**: dải nút "Trắc nghiệm / Nhiều đáp án / Tự luận" trong panel, map tới question index `{ single: 0, multiple: 2, essay: 4 }`; đổi type → reset đáp án + restart timer; type hiện tại lưu trong `demoQType` state
- **Phóng to panel**: nút `ExpandAltOutlined` / `CompressOutlined` trong header panel; khi expanded dùng `position: absolute, inset: 0` để phủ toàn vùng video
- **Tự luận dùng RichTextEditor**: câu tự luận render `RichTextEditor` thay vì `TextArea`; sau khi submit hiển thị HTML read-only qua `dangerouslySetInnerHTML`; `canSubmit` strip HTML tags trước khi kiểm tra rỗng
- **Bottom control bar** (dùng `CtrlBtn`): Mic | Camera | Screen Share | ✋ | — | Participants | Chat | Câu hỏi | — | Rời lớp; có `overflowX: auto`
- **Screen share**: state `screenShareOn`, hiển thị overlay/badge trên self-tile khi breakout
- **Chat panel** (`ChatPanel`): dùng `MOCK_CHAT_MESSAGES` làm dữ liệu ban đầu
- **Broadcast alert**: khi ở breakout, GV gửi thông báo hiện `Alert` ở trên cùng
- **Breakout grid**: ẩn video GV, hiện equal CSS grid (`auto-fill minmax(180px,1fr)`) của các thành viên nhóm; self-tile có viền xanh + mic-off/raised-hand indicator
- **Leave confirm modal**: click "Rời lớp" → Modal confirm hiện số câu đã trả lời; nút "Rời lớp & Xem kết quả" → navigate `/review/:sessionId`

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

- `src/mock/` chỉ còn dùng cho **session pages** (TeacherSessionPage, StudentSessionPage, TeacherDashboardPage, StudentReviewPage) — WebRTC/WebSocket M09–M10 chưa sẵn sàng
- `src/mock/questions.ts` — mỗi `Question` có `answers[]` chứa kết quả mock của từng HS
- `LIVE_SESSION` trong `sessions.ts` import trực tiếp `QUESTIONS` từ `questions.ts`
- `TEACHER.avatarColor` và `STUDENTS[0].avatarColor` dùng `#6366f1` (không phải `#1677ff`)

## Project status

**Phase 1–2 (M01–M08) đã tích hợp hoàn chỉnh.** Session pages vẫn dùng mock data chờ M09–M10.

| Trang | Trạng thái | API sử dụng |
|-------|-----------|-------------|
| LoginPage | ✅ Real API | `authService.login` |
| AppLayout | ✅ Real API | `authStore.user`; `authService.logout` |
| ClassListPage | ✅ Real API | `classroomService.list/create/join` |
| ClassDetailPage | ✅ Real API | classroom/post/schedule/member/document services; đầy đủ CRUD |
| ProfilePage | ✅ Real API | `userService.getMe/updateMe/uploadAvatar` |
| TeacherSessionPage | 🔶 Mock | Chờ M09–M10 (WebRTC + WebSocket) |
| StudentSessionPage | 🔶 Mock | Chờ M09–M10 |
| TeacherDashboardPage | 🔶 Mock | Chờ M09–M10 |
| StudentReviewPage | 🔶 Mock | Chờ M09–M10 |

UI theo phong cách EdTech hiện đại (Coursera/Udemy style): font Outfit, design token indigo, subject-coded gradient card, bento dashboard stats, gamified student review.
