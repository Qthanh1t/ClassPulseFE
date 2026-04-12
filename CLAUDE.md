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
2. **Confidence-based Answering** — học sinh trả lời câu hỏi + chọn mức độ tự tin; hỗ trợ template trắc nghiệm (1 đáp án / nhiều đáp án) và tự luận; có trình soạn thảo cơ bản
3. **Silent Student Detection** — phát hiện và lưu thông tin học sinh không tương tác
4. **Dynamic Breakout Group** — chia phòng thảo luận nhóm trong buổi học
5. **Micro Task** — giao nhiệm vụ cho từng nhóm khi đang trong breakout room
6. **Quick Action Button** — giáo viên nhanh chóng tạo câu hỏi hoặc chia nhóm trong buổi học
7. **Teacher Dashboard** — thống kê kết quả theo từng câu hỏi, danh sách học sinh và kết quả
8. **Student Session Review** — danh sách câu hỏi, số đúng/sai/không trả lời trong buổi học

## System architecture

| Layer | Technology |
|-------|------------|
| Frontend (this repo) | React 19 + TypeScript + Vite |
| Backend | Java (separate repo) |
| Realtime | WebSocket / Socket.io |
| Video | WebRTC |
| Database | PostgreSQL |

## Frontend stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS v4** (via `@tailwindcss/vite` — no `tailwind.config.js` needed)
- ESLint với `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

## Commands

```bash
npm run dev        # khởi động dev server với HMR
npm run build      # type-check (tsc -b) rồi build production
npm run lint       # chạy ESLint
npm run preview    # xem trước bản build
```

Chưa có test runner.

## TypeScript configuration

`tsconfig.app.json` bao phủ `src/` với strict settings: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. `tsc -b` chạy composite build gồm cả `tsconfig.app.json` và `tsconfig.node.json`.

## Project status

Đang ở giai đoạn scaffold ban đầu — `src/App.tsx` chỉ có placeholder. Chưa bắt đầu implement tính năng.