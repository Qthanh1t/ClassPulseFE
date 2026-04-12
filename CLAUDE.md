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
2. **Confidence-based Answering** — học sinh trả lời câu hỏi + chọn mức độ tự tin (Thấp/Trung bình/Cao); hỗ trợ template trắc nghiệm 1 đáp án, nhiều đáp án, tự luận; có trình soạn thảo cơ bản
3. **Silent Student Detection** — phát hiện và lưu thông tin học sinh không trả lời câu hỏi
4. **Dynamic Breakout Group** — chia phòng thảo luận nhóm trong buổi học
5. **Micro Task** — giao nhiệm vụ cho từng nhóm; giáo viên vẫn có thể broadcast thông báo cho cả lớp khi đang trong breakout
6. **Quick Action Button** — giáo viên nhanh chóng tạo câu hỏi hoặc chia nhóm trong buổi học
7. **Teacher Dashboard** — thống kê kết quả theo từng câu hỏi + confidence, danh sách học sinh và kết quả
8. **Student Session Review** — danh sách câu hỏi, số đúng/sai/không trả lời, mức tự tin đã chọn

**Lưu ý quan trọng**: Tạo câu hỏi, trả lời, và thống kê đều xảy ra **trong cùng một buổi học online** (realtime). Khi chưa có câu hỏi đang chạy, màn hình giáo viên hiển thị vùng video/screen share của giáo viên.

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
      StudentStatusList.tsx   # danh sách HS + badge đã/chưa trả lời
      LiveQuestionStats.tsx   # thống kê realtime: progress, đúng/sai, confidence
      ConfidenceSelector.tsx  # 3 nút Thấp/Trung bình/Cao
      CreateQuestionModal.tsx # modal 2 bước: chọn template → soạn thảo
      BreakoutPanel.tsx       # panel nhóm + micro task + broadcast
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
| `idle` | Vùng video/screen share (ảnh `src/assets/hero.png` + overlay tên GV) |
| `running` | Câu hỏi đang chạy + `LiveQuestionStats` cập nhật theo mock data |
| `ended` | Kết quả đầy đủ sau khi kết thúc câu hỏi |
| `breakout` | `BreakoutPanel` với danh sách nhóm và micro task |

## TypeScript configuration

`tsconfig.app.json` strict settings: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. `tsc -b` chạy composite build gồm cả `tsconfig.app.json` và `tsconfig.node.json`.

## Mock data conventions

- `src/mock/questions.ts` — mỗi `Question` có `answers[]` chứa kết quả mock của từng HS (dùng cho cả `LiveQuestionStats` trong session lẫn `TeacherDashboardPage`)
- `LIVE_SESSION` trong `sessions.ts` import trực tiếp `QUESTIONS` từ `questions.ts`
- Khi tích hợp backend: thay thế các import từ `mock/` bằng API calls, giữ nguyên cấu trúc types

## Project status

Giao diện demo tĩnh đã hoàn chỉnh với mock data. Chưa có backend integration, authentication, hay WebSocket/WebRTC thật.
