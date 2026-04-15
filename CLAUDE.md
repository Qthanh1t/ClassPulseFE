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
3. **Silent Student Detection** — phát hiện và lưu thông tin học sinh không trả lời câu hỏi
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
- **Ant Design v6** + **@ant-design/icons** — primary UI component library
- **react-router-dom v7** — routing
- **TipTap v3** (`@tiptap/react`, `starter-kit`, `extension-underline`, `extension-text-align`) — rich text editor dùng trong `CreateQuestionModal`
- **Recharts v3** — biểu đồ (BarChart, PieChart, RadarChart) dùng trong `TeacherDashboardPage` và `StudentReviewPage`

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
| `/` | redirect → `/classes` | |
| `/classes` | `ClassListPage` | Dùng `AppLayout` (sidebar) |
| `/classes/:id` | `ClassDetailPage` | Dùng `AppLayout` |
| `/session/teacher/:id` | `TeacherSessionPage` | Layout riêng, fullscreen |
| `/session/student/:id` | `StudentSessionPage` | Layout riêng, fullscreen |
| `/dashboard/:sessionId` | `TeacherDashboardPage` | Dùng `AppLayout` |
| `/review/:sessionId` | `StudentReviewPage` | Dùng `AppLayout` |

Session pages (`/session/*`) **không dùng `AppLayout`** — chúng có header riêng dạng fullscreen.

## Code structure

```
src/
  types/index.ts              # tất cả TypeScript interfaces
  mock/                       # static mock data (dùng cho đến khi có backend)
    classrooms.ts             # Classroom, Post, Schedule
    students.ts               # User[] (STUDENTS, TEACHER constants)
    questions.ts              # Question[] với answers[] của từng HS
    sessions.ts               # LIVE_SESSION (dùng trong cả session + dashboard)
  components/
    layout/AppLayout.tsx      # Sidebar (240px) + Header + <Outlet />
    session/
      StudentStatusList.tsx   # danh sách thành viên + badge đã/chưa trả lời; hỗ trợ GV (tag "(GV)", không hiện badge trả lời); header đổi thành "Thành viên" khi có GV
      LiveQuestionStats.tsx   # thống kê realtime: progress, đúng/sai, confidence
      ConfidenceSelector.tsx  # 3 nút Thấp/Trung bình/Cao
      CreateQuestionModal.tsx # modal 2 bước: chọn template → soạn thảo + cài đặt thời gian (Switch + preset 30s/1p/1.5p/2p/3p + custom); onSubmit(timerSeconds: number | null)
      BreakoutPanel.tsx       # panel nhóm + micro task + broadcast
      ChatPanel.tsx           # panel chat realtime; export MOCK_CHAT_MESSAGES, ChatMessage type, getNow()
      RichTextEditor.tsx      # rich text editor (TipTap): bold/italic/underline/strike/heading/list/align
      CtrlBtn.tsx             # nút điều khiển dùng chung cho 2 session page: dark bg, circle/round, danger
  pages/
    classroom/ClassListPage.tsx
    classroom/ClassDetailPage.tsx   # tabs: Bảng tin | Lịch học | Thành viên
    session/TeacherSessionPage.tsx  # layout 3 cột, có Segmented demo-state switcher
    session/StudentSessionPage.tsx
    dashboard/TeacherDashboardPage.tsx
    dashboard/StudentReviewPage.tsx
```

## TeacherSessionPage — demo state

Trang này dùng `Segmented` control ở top bar để switch giữa 4 state demo (thay cho websocket thật):

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

## StudentSessionPage — demo state

Trang này dùng `Segmented` control ở top bar để switch giữa 3 state demo:

| State | Mô tả |
|---|---|
| `idle` | Lớp học bình thường — video GV full + thumbnails các HS |
| `question` | Xuất hiện notification modal "GV vừa đặt câu hỏi"; floating question panel (góc dưới phải) để trả lời + chọn confidence |
| `breakout` | Banner tên nhóm + task; video grid chỉ hiện thành viên cùng nhóm; có nút demo "GV gửi thông báo" để trigger broadcast alert |

Các tính năng khác trong trang:
- **Panel thành viên** (trái, 200px): hiển thị `[TEACHER, ...STUDENTS]` qua `StudentStatusList`; GV có tag "(GV)"; toggle bằng nút `TeamOutlined` ở bottom bar
- **Floating question panel**: hiển thị câu hỏi, đáp án (single/multiple/essay), `ConfidenceSelector`; thu nhỏ được sau khi nộp
- **Bottom control bar** (dùng `CtrlBtn`): Mic | Camera | Screen Share | ✋ | — | Participants | Chat | Câu hỏi | — | Rời lớp; có `overflowX: auto`
- **Screen share**: state `screenShareOn`, hiển thị overlay/badge trên self-tile khi breakout
- **Chat panel** (`ChatPanel`): dùng `MOCK_CHAT_MESSAGES` làm dữ liệu ban đầu
- **Broadcast alert**: khi ở breakout, GV gửi thông báo hiện `Alert` ở trên cùng
- **Breakout grid**: ẩn video GV, hiện equal CSS grid (`auto-fill minmax(180px,1fr)`) của các thành viên nhóm; self-tile có viền xanh + mic-off/raised-hand indicator

## TypeScript configuration

`tsconfig.app.json` strict settings: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. `tsc -b` chạy composite build gồm cả `tsconfig.app.json` và `tsconfig.node.json`.

## Mock data conventions

- `src/mock/questions.ts` — mỗi `Question` có `answers[]` chứa kết quả mock của từng HS (dùng cho cả `LiveQuestionStats` trong session lẫn `TeacherDashboardPage`)
- `LIVE_SESSION` trong `sessions.ts` import trực tiếp `QUESTIONS` từ `questions.ts`
- Khi tích hợp backend: thay thế các import từ `mock/` bằng API calls, giữ nguyên cấu trúc types

## Project status

Giao diện demo tĩnh đã hoàn chỉnh với mock data, thân thiện với mọi thiết bị. Chưa có backend integration, authentication, hay WebSocket/WebRTC thật.
