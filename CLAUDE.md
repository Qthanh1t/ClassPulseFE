# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**StudyQuest** — Web hỗ trợ giảng dạy cho nhóm nhỏ (đồ án tốt nghiệp).

Mô hình "Closed Feedback Loop Classroom": giáo viên giảng → đặt câu hỏi → học sinh trả lời kèm mức độ tự tin → hệ thống phân tích → dashboard thời gian thực.

### Roles
- **Teacher**: quản lý lớp, tạo câu hỏi, theo dõi dashboard, tạo breakout room
- **Student**: tham gia lớp, trả lời câu hỏi, xem báo cáo cá nhân
- **Admin**: quản lý user, lớp học, hệ thống

### Core features
1. **Classroom management** — tạo lớp, đăng bài, lịch học (tương tự Microsoft Teams)
2. **Confidence-based Answering** — học sinh trả lời câu hỏi + chọn mức độ tự tin (Thấp/Trung bình/Cao); hỗ trợ template trắc nghiệm 1 đáp án, nhiều đáp án, tự luận; có trình soạn thảo rich text; hỗ trợ giới hạn thời gian tùy chọn, câu hỏi tự kết thúc khi hết giờ
3. **Silent Student Detection** — phát hiện học sinh không trả lời câu hỏi; alert hiển thị tên cụ thể
4. **Dynamic Breakout Group** — chia phòng thảo luận nhóm trong buổi học
5. **Micro Task** — giao nhiệm vụ cho từng nhóm; giáo viên vẫn có thể broadcast thông báo cho cả lớp khi đang trong breakout
6. **Quick Action Button** — giáo viên nhanh chóng tạo câu hỏi hoặc chia nhóm trong buổi học
7. **Teacher Dashboard** — thống kê kết quả theo từng câu hỏi + confidence, danh sách học sinh và kết quả
8. **Student Session Review** — danh sách câu hỏi, số đúng/sai/không trả lời, mức tự tin đã chọn

**Lưu ý quan trọng**: Tạo câu hỏi, trả lời, và thống kê đều xảy ra **trong cùng một buổi học online** (realtime). Khi chưa có câu hỏi đang chạy, màn hình giáo viên, học sinh hiển thị vùng video/screen share của giáo viên.

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
  types/index.ts              # tất cả TypeScript interfaces
  index.css                   # Outfit font import, CSS tokens (:root), utility classes (.sq-*)
  App.tsx                     # Router + AntD ConfigProvider (theme toàn cục)
  mock/                       # static mock data (dùng cho đến khi có backend)
    classrooms.ts             # Classroom, Post, Schedule — có data cho cả 3 lớp c1/c2/c3
    students.ts               # User[] (STUDENTS, TEACHER constants); avatarColor dùng #6366f1
    questions.ts              # Question[] với answers[] của từng HS
    sessions.ts               # LIVE_SESSION (dùng trong cả session + dashboard)
  components/
    layout/AppLayout.tsx      # Sidebar (232px, fixed) + Header (sticky) + <Outlet />
    session/
      StudentStatusList.tsx   # danh sách thành viên + badge đã/chưa trả lời; hỗ trợ GV (tag "(GV)", không hiện badge trả lời); header đổi thành "Thành viên" khi có GV
      LiveQuestionStats.tsx   # thống kê realtime: progress, đúng/sai, confidence
      ConfidenceSelector.tsx  # 3 nút Thấp/Trung bình/Cao
      CreateQuestionModal.tsx # modal 2 bước: chọn template → soạn thảo + cài đặt thời gian (Switch + preset 30s/1p/1.5p/2p/3p + custom); onSubmit(timerSeconds: number | null); đáp án MCQ hỗ trợ LaTeX inline ($...$, $$...$$) với nút chèn Σ và preview KaTeX bên dưới mỗi ô
      BreakoutPanel.tsx       # panel nhóm + micro task + broadcast
      ChatPanel.tsx           # panel chat realtime; export MOCK_CHAT_MESSAGES, ChatMessage type, getNow()
      RichTextEditor.tsx      # rich text editor (CKEditor5): bold/italic/underline/strike/list/align/font-size; custom MathPlugin (KaTeX inline+block); file attachment list (ngoài editor, không chỉnh sửa được); font size 3 mức (Nhỏ/Vừa/Lớn) qua nút tự quản lý
      CtrlBtn.tsx             # nút điều khiển dùng chung cho 2 session page: dark bg, circle/round, danger
  pages/
    LoginPage.tsx             # trang đăng nhập: 2 cột brand/form, role switcher GV/HS, cả 2 navigate /classes
    ProfilePage.tsx           # trang hồ sơ: avatar, stats (lớp/buổi học/câu hỏi/học sinh)
    classroom/ClassListPage.tsx
    classroom/ClassDetailPage.tsx   # tabs: Bảng tin | Lịch học | Thành viên; past schedule có nút "Xem kết quả →"
    session/TeacherSessionPage.tsx  # layout 3 cột, có Segmented demo-state switcher (không có label "Demo:")
    session/StudentSessionPage.tsx  # có student-side countdown timer (90s), leave confirm modal
    dashboard/TeacherDashboardPage.tsx
    dashboard/StudentReviewPage.tsx
```

## AppLayout

Sidebar **fixed** (không scroll theo trang), width 232px (collapsed: 64px). Content area dùng `marginLeft` động để tránh overlap.

- **Logo**: gradient rounded square (`#6366f1 → #8b5cf6`) + text "StudyQuest"
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
- **Tabs** (Bảng tin / Lịch học / Thành viên): render trong `Card` borderRadius 16
- **Schedule card**: border-left accent (`#6366f1` nếu upcoming, `#e2e8f0` nếu đã qua); icon CheckCircle cho buổi đã xong; buổi đã qua có thêm nút nhỏ "Xem kết quả →" → navigate `/dashboard/sess1`

## TeacherDashboardPage

- **Header section**: dark indigo gradient (`#1e1b4b → #4338ca`)
- **`StatCard`**: component nội bộ; icon trong hộp màu nhạt (lightBg) + số lớn + label uppercase; 4 card trong Row gutter 16
- **Bar chart**: màu bar theo rate (emerald ≥70%, amber 40–70%, rose <40%); axisLine/tickLine ẩn
- **Pie chart**: 3 màu emerald/rose/slate; có mini stat row bên dưới
- **Detail tabs**: "Chi tiết từng câu hỏi" dùng `Collapse`; "Kết quả học sinh" dùng `Table` với summary row

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
| `idle` | Vùng video/screen share (ảnh `src/assets/hero.png` + overlay tên GV) + thumbnails HS |
| `running` | Câu hỏi đang chạy + `LiveQuestionStats` cập nhật theo mock data |
| `ended` | Kết quả đầy đủ sau khi kết thúc câu hỏi |
| `breakout` | `BreakoutPanel` với danh sách nhóm và micro task |

Các tính năng khác trong trang:
- **Bottom control bar**: toggle mic/camera/screen share; toggle student list panel, quick actions panel, chat panel; nút "Kết thúc buổi học"
- **Session timer**: đếm thời gian từ khi vào trang (hiển thị `HH:MM:SS` ở top bar)
- **Chat panel** (`ChatPanel`): bật/tắt bằng nút chat ở bottom bar; dùng `MOCK_CHAT_MESSAGES` làm dữ liệu ban đầu
- **End session modal**: confirm trước khi điều hướng → `/dashboard/:sessionId`
- **Raised hand**: mock `raisedHandIds = ['s3', 's5']`, hiển thị ✋ trên thumbnail HS
- **Question timer**: khi GV đặt thời gian, hiển thị circular progress (44px) đếm ngược cạnh nút "Kết thúc"; màu xanh→cam→đỏ theo % còn lại; tự chuyển state `ended` khi về 0; reset khi kết thúc thủ công hoặc chuyển câu tiếp
- **Silent student alert**: khi `demoState === 'running'`, hiển thị Alert warning với avatar + tên cụ thể của từng HS trong `silentStudentIds`

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
- **Bottom control bar** (dùng `CtrlBtn`): Mic | Camera | Screen Share | ✋ | — | Participants | Chat | Câu hỏi | — | Rời lớp; có `overflowX: auto`
- **Screen share**: state `screenShareOn`, hiển thị overlay/badge trên self-tile khi breakout
- **Chat panel** (`ChatPanel`): dùng `MOCK_CHAT_MESSAGES` làm dữ liệu ban đầu
- **Broadcast alert**: khi ở breakout, GV gửi thông báo hiện `Alert` ở trên cùng
- **Breakout grid**: ẩn video GV, hiện equal CSS grid (`auto-fill minmax(180px,1fr)`) của các thành viên nhóm; self-tile có viền xanh + mic-off/raised-hand indicator
- **Leave confirm modal**: click "Rời lớp" → Modal confirm hiện số câu đã trả lời; nút "Rời lớp & Xem kết quả" → navigate `/review/:sessionId`

## TypeScript configuration

`tsconfig.app.json` strict settings: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. `tsc -b` chạy composite build gồm cả `tsconfig.app.json` và `tsconfig.node.json`.

`React.ReactNode` có thể dùng không cần `import React` (global namespace trong react-jsx transform) — đây là pattern nhất quán trong toàn bộ codebase.

## Mock data conventions

- `src/mock/questions.ts` — mỗi `Question` có `answers[]` chứa kết quả mock của từng HS (dùng cho cả `LiveQuestionStats` trong session lẫn `TeacherDashboardPage`)
- `LIVE_SESSION` trong `sessions.ts` import trực tiếp `QUESTIONS` từ `questions.ts`
- `POSTS` và `SCHEDULES` trong `classrooms.ts` có data cho cả 3 lớp (c1/c2/c3)
- `TEACHER.avatarColor` và `STUDENTS[0].avatarColor` dùng `#6366f1` (không phải `#1677ff`)
- Khi tích hợp backend: thay thế các import từ `mock/` bằng API calls, giữ nguyên cấu trúc types

## Project status

Giao diện demo tĩnh đã hoàn chỉnh với mock data, thân thiện với mọi thiết bị. Chưa có backend integration, authentication, hay WebSocket/WebRTC thật.

UI đã được redesign theo phong cách EdTech hiện đại (Coursera/Udemy style): font Outfit, design token indigo, subject-coded gradient card, bento dashboard stats, gamified student review.
