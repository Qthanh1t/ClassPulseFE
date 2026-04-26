# ClassPulse — System Overview

> **Project:** ClassPulse / StudyQuest (đồ án tốt nghiệp)  
> **Date:** 2026-04-25  
> **Xem thêm:** Tech stack & kiến trúc hệ thống → [06_System_Architecture.md](06_System_Architecture.md)

---

## 1. Mô tả hệ thống

ClassPulse là nền tảng tương tác thời gian thực cho lớp học nhỏ (≤ 30 học sinh). Trong mỗi buổi học online, giáo viên (GV) quản lý toàn bộ tương tác — video WebRTC, đặt câu hỏi kèm timer, xem kết quả live, chia nhóm breakout, spotlight từng học sinh, và gửi broadcast — tất cả trong cùng một phiên. Học sinh trả lời câu hỏi (trắc nghiệm / tự luận) kèm mức tự tin, giơ tay, chat realtime, và xem lại kết quả sau buổi học.

Backend hỗ trợ hai lớp vận hành song song:
- **CRUD bất đồng bộ** — quản lý lớp, tài liệu, lịch học (REST API)
- **Realtime event bus** — câu hỏi, chat, breakout, raise hand, focus (WebSocket + STOMP)

---

## 2. Roles

| Role | Quyền hạn |
|------|-----------|
| **teacher** | Tạo/quản lý lớp; bắt đầu/kết thúc phiên học; đặt câu hỏi; điều phối breakout/focus/broadcast; xem dashboard |
| **student** | Tham gia lớp (bằng mã); vào phiên học; trả lời câu hỏi; raise hand; chat; xem kết quả cá nhân |
| **admin** | Quản lý tất cả user, lớp học, và cấu hình hệ thống |

---

## 3. Core Features

### 3.1 Classroom Management (Async CRUD)

| Feature | Mô tả |
|---------|-------|
| Tạo / tham gia lớp | GV tạo lớp → sinh mã. HS nhập mã → vào lớp |
| Bảng tin | Đăng bài rich text + đính kèm file (PDF, PPTX, DOCX...) |
| Lịch học | Thêm/sửa/xóa lịch; xem lịch sử buổi học đã diễn ra |
| Thành viên | Danh sách HS, GV kick HS |
| Kho tài liệu | Tổng hợp từ bài đăng + upload trực tiếp |

### 3.2 Live Session — Realtime Core

| Feature | Mô tả |
|---------|-------|
| Video / Audio | WebRTC Mesh P2P; signaling qua WebSocket |
| Session lifecycle | `waiting → active → ended` |
| Q&A với confidence | GV tạo câu hỏi (single / multiple / essay) + timer tùy chọn; HS trả lời kèm mức tự tin (low / medium / high); server tự đóng khi hết giờ |
| Silent student detection | Phát hiện HS chưa trả lời, cảnh báo GV kèm tên cụ thể |
| Raise Hand | HS giơ tay; GV thấy ngay trên thumbnail và danh sách |
| Live Chat | Tin nhắn realtime trong phiên |
| Breakout Rooms | GV tạo N phòng tùy ý, gán HS, đặt task; GV vào/rời phòng; broadcast đến tất cả phòng |
| Focus / Spotlight | GV chọn 1 HS → layout 2 ô (GV + HS) trong phòng chính |

### 3.3 Analytics & Review

| Feature | Mô tả |
|---------|-------|
| Teacher Dashboard | Per-question stats: đúng/sai/bỏ qua, phân phối đáp án, confidence breakdown; bảng điểm từng HS |
| Student Review | HS xem lại từng câu hỏi, đáp án đúng, đáp án đã chọn, mức tự tin |

---

## 4. Main Workflows

### WF-1: Classroom Lifecycle

```
GV đăng ký → tạo lớp → lấy mã lớp → mời HS
HS đăng ký → nhập mã lớp → vào lớp
GV/HS xem bảng tin, lịch học, tài liệu
GV đăng bài / upload file / thêm lịch
```

### WF-2: Session — Teacher Journey

```
GV bấm "Bắt đầu buổi học"
  → POST /api/v1/classrooms/:id/sessions
  → Server tạo Session (status=active), trả wsTicket
  → GV connect WebSocket, WebRTC P2P với từng HS

GV tạo câu hỏi + bấm "Phát câu hỏi"
  → POST /api/v1/sessions/:id/questions
  → POST /api/v1/sessions/:id/questions/:qid/start
  → Server lưu Question (status=running), set endsAt = now + timerSeconds
  → Server broadcast [question_started] đến tất cả HS
  → QuestionTimerService schedule auto-end tại endsAt

Timer hết / GV bấm "Kết thúc câu hỏi"
  → Server đặt Question.status = ended
  → Server broadcast [question_ended] kèm aggregated stats

GV bấm "Kết thúc buổi học"
  → POST /api/v1/sessions/:id/end
  → Server đặt Session.status = ended, endedAt = now
  → Server async compute SessionStudentSummaries
  → GV navigate → /dashboard/:sessionId
```

### WF-3: Session — Student Journey

```
HS nhận [session_started] event qua WebSocket
  → HS connect WebSocket + WebRTC
  → Vào StudentSessionPage

HS nhận [question_started] event
  → Hiện notification modal + floating question panel
  → Client đếm ngược từ endsAt (server timestamp — không dùng local clock)

HS chọn đáp án + confidence → bấm "Nộp"
  → POST /api/v1/sessions/:id/questions/:qid/answers
  → Server lưu StudentAnswer, tính isCorrect (MCQ), null (essay)
  → Server broadcast [answer_aggregate] cho GV (chỉ số đếm, không lộ đáp án cụ thể)
  → Frontend: setSubmitted(true), hiện "Đã nộp"

Timer hết / nhận [question_ended]
  → Input bị disable
  → GV xem stats, chuyển câu tiếp

HS bấm "Rời lớp"
  → POST /api/v1/sessions/:id/leave
  → Navigate → /review/:sessionId
```

### WF-4: Breakout Rooms

```
GV setup: tạo N phòng, gán HS, nhập task
  → POST /api/v1/sessions/:id/breakouts
  → Server broadcast [breakout_started] kèm assignment đến tất cả

HS nhận event → chuyển sang breakout grid (chỉ thành viên cùng nhóm)

GV vào phòng cụ thể
  → POST /api/v1/sessions/:id/breakouts/:bid/rooms/:rid/join
  → Server broadcast [teacher_joined_room] đến HS trong phòng đó

GV gửi broadcast
  → POST /api/v1/sessions/:id/breakouts/:bid/broadcast
  → Server fan-out [broadcast_message] đến tất cả HS kể cả ở breakout

GV kết thúc breakout
  → POST /api/v1/sessions/:id/breakouts/:bid/end
  → Server broadcast [breakout_ended] → tất cả trở về main session
```

### WF-5: Post-Session Analytics

```
Session ended
  → GV navigate /dashboard/:sessionId
  → GET /api/v1/sessions/:id/dashboard
      → Trả per-question stats + per-student scores (từ precomputed summaries)

HS navigate /review/:sessionId
  → GET /api/v1/sessions/:id/review
      → Per-question: myAnswer, correctAnswer, confidence, result (correct/wrong/skipped)
```

---

## 5. Non-functional Requirements

| Requirement | Target |
|-------------|--------|
| Concurrent users / session | ≤ 30 students + 1 teacher |
| WebSocket latency | < 200ms |
| REST API response time | < 300ms (p95) |
| File upload size limit | ≤ 50MB / file |
| Session data retention | Vĩnh viễn (audit + review) |
| Authentication | JWT access token (15 phút) + refresh token (30 ngày, httpOnly cookie) |
| Authorization | Role-based: teacher / student / admin |
| WebRTC media | Peer-to-peer (Mesh); Coturn TURN/STUN cho NAT traversal |

---

## 6. Tài liệu liên quan

| File | Nội dung |
|------|---------|
| [02_Database_Design.md](02_Database_Design.md) | Schema 19 bảng, ERD, DDL, index strategy |
| [03_API_Design.md](03_API_Design.md) | ~58 REST endpoints + WebSocket event contract |
| [04_Realtime_Architecture.md](04_Realtime_Architecture.md) | Spring STOMP, Redis Pub/Sub, WebRTC signaling, Silent Detection |
| [05_Auth_Authorization.md](05_Auth_Authorization.md) | JWT flow, Spring Security config, RBAC, WS Ticket |
| [06_System_Architecture.md](06_System_Architecture.md) | Tech stack, folder structure, Docker Compose, app config |
| [07_Best_Practices.md](07_Best_Practices.md) | Naming conventions, error handling, logging, API versioning |
