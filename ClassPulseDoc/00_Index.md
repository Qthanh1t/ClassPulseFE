# ClassPulse Backend — Tài liệu thiết kế

> **Project:** ClassPulse / StudyQuest (đồ án tốt nghiệp)  
> **Stack:** Java 21 + Spring Boot 3.x + PostgreSQL + Redis + WebSocket/STOMP + WebRTC  
> **Date:** 2026-04-25

---

## Danh mục tài liệu

| # | File | Nội dung chính |
|---|------|----------------|
| 00 | `00_Index.md` ← *bạn đang ở đây* | Danh mục, hướng dẫn đọc |
| 01 | [01_System_Overview.md](01_System_Overview.md) | Mô tả hệ thống, roles, features, 5 main workflows, NFRs |
| 02 | [02_Database_Design.md](02_Database_Design.md) | 19 bảng PostgreSQL, ERD, DDL, index strategy, design decisions |
| 03 | [03_API_Design.md](03_API_Design.md) | ~58 REST endpoints theo 17 module + WebSocket event contract |
| 04 | [04_Realtime_Architecture.md](04_Realtime_Architecture.md) | Spring STOMP, Redis Pub/Sub, authoritative timer, WebRTC Mesh + Coturn |
| 05 | [05_Auth_Authorization.md](05_Auth_Authorization.md) | JWT flow, Spring Security, RBAC, WS Ticket, refresh token |
| 06 | [06_System_Architecture.md](06_System_Architecture.md) | Monolith vs Microservices, tech stack đầy đủ, folder structure, Docker |
| 07 | [07_Best_Practices.md](07_Best_Practices.md) | Naming, error handling, API versioning, logging, transaction, security |

---

## Thứ tự đọc khuyến nghị

### Nếu bạn là developer mới vào dự án
```
01 → 06 → 02 → 05 → 03 → 04 → 07
```
Hiểu hệ thống → kiến trúc → DB → auth → API → realtime → conventions

### Nếu bạn đang implement 1 feature cụ thể
```
01 (workflow liên quan) → 02 (bảng liên quan) → 03 (endpoint) → 07 (conventions)
```

### Nếu bạn đang setup môi trường
```
06 (Docker Compose + application.yml + folder structure)
```

### Nếu bạn đang implement realtime/WebSocket
```
03 (Module 15 — WS event contract) → 04 (implementation) → 05 (WS Ticket)
```

---

## Kiến trúc tóm tắt

```
React Frontend
  ├── REST (HTTP)      → Spring Boot API (/api/v1/*)
  ├── WebSocket/STOMP  → Spring WebSocket (/ws)
  └── WebRTC (P2P)    → Coturn TURN/STUN

Spring Boot (Modular Monolith — 15 feature modules)
  ├── PostgreSQL 16    (primary datastore — 19 tables)
  ├── Redis 7          (presence, tickets, pub/sub, timer state)
  └── MinIO            (file storage — S3-compatible)
```

---

## Database — 19 bảng (tóm tắt)

| Domain | Tables |
|--------|--------|
| Auth | `users`, `refresh_tokens` |
| Classroom | `classrooms`, `classroom_memberships`, `posts`, `post_attachments`, `classroom_documents`, `schedules` |
| Session | `sessions`, `session_presences`, `session_student_summaries` |
| Q&A | `questions`, `question_options`, `student_answers` |
| Breakout | `breakout_sessions`, `breakout_rooms`, `breakout_assignments` |
| Interaction | `chat_messages`, `raised_hands` |

---

## API — 17 modules (tóm tắt)

| Module | Số endpoints | Auth |
|--------|-------------|------|
| Auth | 4 | PUBLIC / AUTH |
| Users | 5 | AUTH / ADMIN |
| Classrooms | 8 | AUTH / TEACHER / OWNER |
| Posts + Attachments | 7 | AUTH / OWNER |
| Schedules | 4 | AUTH / OWNER |
| Documents | 3 | AUTH / OWNER |
| Sessions | 7 | AUTH / OWNER / STUDENT |
| Questions | 5 | AUTH / OWNER |
| Student Answers | 2 | STUDENT |
| Breakout Rooms | 6 | OWNER |
| Chat | 1 | AUTH |
| Dashboard | 1 | TEACHER (owner) |
| Student Review | 1 | STUDENT |
| File Upload | 1 | AUTH |
| WebSocket Events | ∞ | AUTH (ticket) |
| Admin | 3 | ADMIN |
| **Tổng** | **~58 REST + WS** | |

---

## WebSocket Events (tóm tắt)

| Direction | Events |
|-----------|--------|
| Server → All | `session_started`, `session_ended`, `question_started`, `question_ended`, `answer_aggregate`, `breakout_started`, `breakout_ended`, `broadcast_message`, `student_presence`, `raise_hand_changed`, `chat_message`, `focus_changed`, `silent_alert` |
| Client → Server | `raise_hand`, `chat_send`, `focus_student`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `heartbeat` |

> Chi tiết payload: [03_API_Design.md → Module 15](03_API_Design.md)  
> Implementation: [04_Realtime_Architecture.md](04_Realtime_Architecture.md)

---

## Key Design Decisions

| Decision | Choice | Lý do |
|---------|--------|-------|
| Architecture | Modular Monolith | Team nhỏ (đồ án), WS dễ quản lý hơn microservice |
| Auth | JWT stateless + httpOnly refresh cookie | Secure, không cần session store |
| Realtime | Spring STOMP + Redis relay | Native Spring Security integration |
| WebRTC | Mesh P2P + Coturn | Đủ cho ≤ 30 người, không cần SFU |
| Timer | Server-side ScheduledExecutorService | Authoritative — không tin client clock |
| DB schema | UUID PK, Flyway migrations | Không lộ ID, versioned schema |
| File storage | MinIO + Presigned URL | File bypass server, giảm bandwidth |
| Error format | `{ success, data, error }` wrapper | Consistent mọi response |
