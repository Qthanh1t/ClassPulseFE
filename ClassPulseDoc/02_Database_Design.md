# ClassPulse — Database Design

> **Database:** PostgreSQL 16 | **Date:** 2026-04-25  
> **Xem thêm:** Tổng quan → [01_System_Overview.md](01_System_Overview.md) | Index → [00_Index.md](00_Index.md)

---

## 1. Table Definitions

### 1.1 `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK, default gen_random_uuid() | |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt |
| `name` | `VARCHAR(100)` | NOT NULL | |
| `role` | `VARCHAR(20)` | NOT NULL, CHECK IN ('teacher','student','admin') | |
| `avatar_color` | `VARCHAR(7)` | NULL | hex e.g. #6366f1 |
| `avatar_url` | `TEXT` | NULL | MinIO URL |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT TRUE | soft ban |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_users_email` ON `email` (unique lookup)
- `idx_users_role` ON `role` (admin queries)

---

### 1.2 `classrooms`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `name` | `VARCHAR(200)` | NOT NULL | |
| `description` | `TEXT` | NULL | |
| `subject` | `VARCHAR(100)` | NULL | e.g. "Frontend", "Database" |
| `join_code` | `VARCHAR(12)` | UNIQUE, NOT NULL | mã để HS tham gia |
| `teacher_id` | `UUID` | FK → users.id, NOT NULL | |
| `is_archived` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_classrooms_teacher` ON `teacher_id`
- `idx_classrooms_join_code` ON `join_code` (unique, used for join-by-code)

---

### 1.3 `classroom_memberships`

> N-N: students ↔ classrooms

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `classroom_id` | `UUID` | PK (composite), FK → classrooms.id | |
| `student_id` | `UUID` | PK (composite), FK → users.id | |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT TRUE | kick/re-add |

**Indexes:**
- PK is (`classroom_id`, `student_id`)
- `idx_memberships_student` ON `student_id` (lấy lớp của 1 HS)

---

### 1.4 `posts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `classroom_id` | `UUID` | FK → classrooms.id, NOT NULL | |
| `author_id` | `UUID` | FK → users.id, NOT NULL | |
| `content` | `TEXT` | NOT NULL | HTML từ rich text editor |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_posts_classroom` ON `classroom_id` DESC `created_at` (bảng tin)

---

### 1.5 `post_attachments`

> 1 post → N files. Tách ra để dễ query file riêng (tab Tài liệu).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `post_id` | `UUID` | FK → posts.id, ON DELETE CASCADE | |
| `file_name` | `VARCHAR(255)` | NOT NULL | tên gốc |
| `storage_key` | `TEXT` | NOT NULL | MinIO object key |
| `file_size_bytes` | `BIGINT` | NOT NULL | |
| `file_ext` | `VARCHAR(20)` | NOT NULL | pdf, docx, png... |
| `uploaded_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_attachments_post` ON `post_id`

---

### 1.6 `classroom_documents`

> File upload trực tiếp bởi GV (không kèm bài đăng) — nguồn thứ 2 trong tab Tài liệu.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `classroom_id` | `UUID` | FK → classrooms.id, NOT NULL | |
| `uploader_id` | `UUID` | FK → users.id, NOT NULL | |
| `file_name` | `VARCHAR(255)` | NOT NULL | |
| `storage_key` | `TEXT` | NOT NULL | MinIO object key |
| `file_size_bytes` | `BIGINT` | NOT NULL | |
| `file_ext` | `VARCHAR(20)` | NOT NULL | |
| `uploaded_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_documents_classroom` ON `classroom_id`

---

### 1.7 `schedules`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `classroom_id` | `UUID` | FK → classrooms.id, NOT NULL | |
| `title` | `VARCHAR(200)` | NOT NULL | |
| `scheduled_date` | `DATE` | NOT NULL | |
| `start_time` | `TIME` | NOT NULL | |
| `end_time` | `TIME` | NOT NULL | |
| `description` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_schedules_classroom_date` ON (`classroom_id`, `scheduled_date`)

---

### 1.8 `sessions`

> Một buổi học = 1 session record. Kết nối lịch học với dữ liệu thực tế.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `classroom_id` | `UUID` | FK → classrooms.id, NOT NULL | |
| `schedule_id` | `UUID` | FK → schedules.id, NULL | NULL nếu GV bắt đầu không theo lịch |
| `teacher_id` | `UUID` | FK → users.id, NOT NULL | |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'waiting', CHECK IN ('waiting','active','ended') | |
| `started_at` | `TIMESTAMPTZ` | NULL | set khi status → active |
| `ended_at` | `TIMESTAMPTZ` | NULL | set khi status → ended |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_sessions_classroom` ON `classroom_id`
- `idx_sessions_status` ON `status` WHERE `status` = 'active' (partial index — tìm session đang chạy)

---

### 1.9 `session_presences`

> Theo dõi HS nào đã tham gia phiên, khi nào vào/rời.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `session_id` | `UUID` | PK (composite), FK → sessions.id | |
| `student_id` | `UUID` | PK (composite), FK → users.id | |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `left_at` | `TIMESTAMPTZ` | NULL | NULL = vẫn còn trong phòng |

**Indexes:**
- PK is (`session_id`, `student_id`)
- `idx_presences_session` ON `session_id`

---

### 1.10 `questions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `session_id` | `UUID` | FK → sessions.id, NOT NULL | |
| `question_order` | `SMALLINT` | NOT NULL | thứ tự trong buổi học |
| `type` | `VARCHAR(20)` | NOT NULL, CHECK IN ('single','multiple','essay') | |
| `content` | `TEXT` | NOT NULL | HTML (hỗ trợ LaTeX) |
| `timer_seconds` | `INTEGER` | NULL | NULL = không có timer |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','running','ended') | |
| `started_at` | `TIMESTAMPTZ` | NULL | set khi status → running |
| `ends_at` | `TIMESTAMPTZ` | NULL | started_at + timer_seconds; authoritative timer |
| `ended_at` | `TIMESTAMPTZ` | NULL | thực tế kết thúc (sớm hơn ends_at nếu GV stop thủ công) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_questions_session` ON (`session_id`, `question_order`)
- `idx_questions_running` ON `session_id` WHERE `status` = 'running' (partial — tìm câu đang chạy)

---

### 1.11 `question_options`

> Chỉ cho type = 'single' hoặc 'multiple'. Essay không có options.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `question_id` | `UUID` | FK → questions.id, ON DELETE CASCADE | |
| `label` | `VARCHAR(5)` | NOT NULL | 'A', 'B', 'C', 'D', 'E', 'F' |
| `text` | `TEXT` | NOT NULL | hỗ trợ LaTeX inline |
| `is_correct` | `BOOLEAN` | NOT NULL | |
| `option_order` | `SMALLINT` | NOT NULL | |

**Indexes:**
- `idx_options_question` ON `question_id`

---

### 1.12 `student_answers`

> Mỗi HS nộp 1 lần duy nhất cho mỗi câu hỏi (UNIQUE constraint). Không cho phép thay đổi sau khi nộp.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `question_id` | `UUID` | FK → questions.id, NOT NULL | |
| `student_id` | `UUID` | FK → users.id, NOT NULL | |
| `selected_option_ids` | `UUID[]` | NULL | PostgreSQL array — NULL cho essay |
| `essay_text` | `TEXT` | NULL | NULL cho MCQ |
| `confidence` | `VARCHAR(10)` | NULL, CHECK IN ('low','medium','high') | |
| `is_correct` | `BOOLEAN` | NULL | NULL cho essay (chấm tay); server tính tự động cho MCQ |
| `answered_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Constraints:**
- `UNIQUE (question_id, student_id)` — 1 HS 1 câu trả lời

**Indexes:**
- UNIQUE INDEX trên (`question_id`, `student_id`)
- `idx_answers_question` ON `question_id` (aggregate stats per question)
- `idx_answers_student_session` ON `student_id` (student review)

---

### 1.13 `breakout_sessions`

> Mỗi lần GV bật breakout trong 1 phiên học = 1 record.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `session_id` | `UUID` | FK → sessions.id, NOT NULL | |
| `started_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |
| `ended_at` | `TIMESTAMPTZ` | NULL | |

**Indexes:**
- `idx_breakout_sessions_session` ON `session_id`

---

### 1.14 `breakout_rooms`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `breakout_session_id` | `UUID` | FK → breakout_sessions.id, ON DELETE CASCADE | |
| `name` | `VARCHAR(100)` | NOT NULL | e.g. "Nhóm 1" |
| `task` | `TEXT` | NULL | |
| `room_order` | `SMALLINT` | NOT NULL | |

**Indexes:**
- `idx_rooms_breakout_session` ON `breakout_session_id`

---

### 1.15 `breakout_assignments`

> N-N: students ↔ breakout_rooms

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `room_id` | `UUID` | PK (composite), FK → breakout_rooms.id, ON DELETE CASCADE | |
| `student_id` | `UUID` | PK (composite), FK → users.id | |

**Indexes:**
- PK is (`room_id`, `student_id`)
- `idx_breakout_assign_student` ON `student_id`

---

### 1.16 `chat_messages`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `session_id` | `UUID` | FK → sessions.id, NOT NULL | |
| `sender_id` | `UUID` | FK → users.id, NOT NULL | |
| `content` | `TEXT` | NOT NULL | |
| `breakout_room_id` | `UUID` | FK → breakout_rooms.id, NULL | NULL = main room; set nếu chat trong breakout |
| `sent_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_chat_session_time` ON (`session_id`, `sent_at`)
- `idx_chat_breakout` ON `breakout_room_id` WHERE `breakout_room_id` IS NOT NULL

---

### 1.17 `raised_hands`

> Log sự kiện raise/lower hand. Dùng để replay timeline nếu cần.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `session_id` | `UUID` | FK → sessions.id, NOT NULL | |
| `student_id` | `UUID` | FK → users.id, NOT NULL | |
| `raised` | `BOOLEAN` | NOT NULL | TRUE=giơ, FALSE=hạ |
| `event_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_raised_session` ON `session_id`

> **Note:** Trạng thái raised hand hiện tại (is_raised) được lưu trong Redis để tránh query DB mỗi event realtime.

---

### 1.18 `session_student_summaries`

> Precomputed aggregates sau khi session ended. Tránh tính lại từ đầu mỗi khi load dashboard.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `session_id` | `UUID` | PK (composite), FK → sessions.id | |
| `student_id` | `UUID` | PK (composite), FK → users.id | |
| `total_questions` | `SMALLINT` | NOT NULL | |
| `answered_count` | `SMALLINT` | NOT NULL | |
| `correct_count` | `SMALLINT` | NOT NULL | |
| `skipped_count` | `SMALLINT` | NOT NULL | |
| `score_percent` | `NUMERIC(5,2)` | NOT NULL | 0.00 – 100.00 |
| `computed_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PK is (`session_id`, `student_id`)
- `idx_summaries_session` ON `session_id` (dashboard: tất cả HS của 1 session)

---

### 1.19 `refresh_tokens`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users.id, NOT NULL | |
| `token_hash` | `VARCHAR(255)` | UNIQUE, NOT NULL | SHA-256 của token |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | |
| `revoked` | `BOOLEAN` | NOT NULL, DEFAULT FALSE | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | |

**Indexes:**
- `idx_refresh_token_hash` ON `token_hash` (unique lookup)
- `idx_refresh_user` ON `user_id`

---

## 2. Entity Relationship Diagram (Text Format)

```
users
 ├─[1:N]──────────────────────── classrooms (teacher_id)
 ├─[N:N via classroom_memberships]─ classrooms (student side)
 ├─[1:N]──────────────────────── posts (author_id)
 ├─[1:N]──────────────────────── sessions (teacher_id)
 ├─[N:N via session_presences]──── sessions (student side)
 ├─[1:N]──────────────────────── student_answers (student_id)
 ├─[1:N]──────────────────────── chat_messages (sender_id)
 ├─[1:N]──────────────────────── raised_hands (student_id)
 ├─[N:N via breakout_assignments]── breakout_rooms (student side)
 └─[N:N via session_student_summaries] sessions

classrooms
 ├─[1:N]──── posts
 ├─[1:N]──── classroom_documents
 ├─[1:N]──── schedules
 └─[1:N]──── sessions

posts
 └─[1:N]──── post_attachments

sessions
 ├─[1:N]──── questions
 ├─[1:N]──── breakout_sessions
 ├─[1:N]──── chat_messages
 └─[1:N]──── raised_hands

questions
 ├─[1:N]──── question_options
 └─[1:N]──── student_answers

breakout_sessions
 └─[1:N]──── breakout_rooms
               └─[N:N via breakout_assignments]── users
```

---

## 3. Relationships Summary

| Relationship | Type | Via |
|---|---|---|
| User → Classroom (teacher owns) | 1:N | `classrooms.teacher_id` |
| User ↔ Classroom (student member) | N:N | `classroom_memberships` |
| Classroom → Post | 1:N | `posts.classroom_id` |
| Post → Attachment | 1:N | `post_attachments.post_id` |
| Classroom → Document | 1:N | `classroom_documents.classroom_id` |
| Classroom → Schedule | 1:N | `schedules.classroom_id` |
| Classroom → Session | 1:N | `sessions.classroom_id` |
| Schedule → Session | 1:0..1 | `sessions.schedule_id` (nullable) |
| User ↔ Session (presence) | N:N | `session_presences` |
| Session → Question | 1:N | `questions.session_id` |
| Question → Option | 1:N | `question_options.question_id` |
| Question → StudentAnswer | 1:N | `student_answers.question_id` |
| User → StudentAnswer | 1:N | `student_answers.student_id` |
| Session → BreakoutSession | 1:N | `breakout_sessions.session_id` |
| BreakoutSession → Room | 1:N | `breakout_rooms.breakout_session_id` |
| User ↔ Room (assignment) | N:N | `breakout_assignments` |
| Session → ChatMessage | 1:N | `chat_messages.session_id` |
| Room → ChatMessage | 1:N | `chat_messages.breakout_room_id` (nullable) |
| Session → RaisedHand | 1:N | `raised_hands.session_id` |
| Session ↔ User (summary) | N:N | `session_student_summaries` |
| User → RefreshToken | 1:N | `refresh_tokens.user_id` |

---

## 4. Index Strategy Summary

| Table | Index | Reason |
|---|---|---|
| `users` | `email` (unique) | Login lookup |
| `classrooms` | `teacher_id` | GV xem lớp của mình |
| `classrooms` | `join_code` (unique) | HS join bằng mã |
| `classroom_memberships` | `student_id` | HS xem lớp đang học |
| `posts` | (`classroom_id`, `created_at` DESC) | Feed bảng tin |
| `schedules` | (`classroom_id`, `scheduled_date`) | Xem lịch học |
| `sessions` | `classroom_id` | Lịch sử buổi học của lớp |
| `sessions` | partial WHERE `status='active'` | Tìm session đang chạy |
| `questions` | (`session_id`, `question_order`) | Load câu hỏi của session |
| `questions` | partial WHERE `status='running'` | Câu đang chạy trong session |
| `question_options` | `question_id` | Load options của câu |
| `student_answers` | UNIQUE(`question_id`, `student_id`) | Prevent duplicate submission |
| `student_answers` | `question_id` | Aggregate stats |
| `chat_messages` | (`session_id`, `sent_at`) | Chat history |
| `session_student_summaries` | `session_id` | Dashboard load |

---

## 5. Key Design Decisions

### 5.1 UUID vs BIGSERIAL
Dùng UUID cho tất cả PK để:
- Tránh lộ thứ tự/số lượng record qua URL
- Dễ merge data từ nhiều môi trường (dev/staging/prod)
- Phù hợp với distributed system sau này

### 5.2 `selected_option_ids UUID[]`
PostgreSQL native array cho đáp án MCQ:
- Không cần join table riêng để đọc đáp án của 1 HS
- `= ANY(selected_option_ids)` hoạt động tốt với GIN index nếu cần
- Đủ đơn giản cho scale của đồ án

### 5.3 `is_correct` tính server-side
Server tự tính `is_correct` khi nhận StudentAnswer (so sánh `selected_option_ids` với `question_options.is_correct`):
- Essay: `is_correct = NULL` (chấm tay)
- Single: đúng khi selected = {correct_option_id}
- Multiple: đúng khi selected == {tất cả correct_option_ids}, không thừa không thiếu

### 5.4 `ends_at` là nguồn sự thật (authoritative timer)
Timer không phụ thuộc client clock. Server tính `ends_at = started_at + timer_seconds` và gửi timestamp đến client. Client đếm ngược dựa trên `ends_at`. Server có scheduled job (hoặc delay message qua Redis) để tự đóng câu hỏi khi `ends_at` đến.

### 5.5 `session_student_summaries` (precomputed)
Computed ngay khi session ended (async job). Dashboard chỉ cần SELECT, không cần aggregate lại. Nếu cần recalculate: DELETE + re-insert.

### 5.6 `breakout_sessions` (nested entity)
Tách `breakout_sessions` khỏi `sessions` để một session có thể có nhiều lần breakout (GV có thể mở breakout nhiều lần trong 1 buổi).

### 5.7 Redis Usage
| Key pattern | TTL | Content |
|---|---|---|
| `session:{id}:raised_hands` | session lifetime | SET of studentIds currently raising hand |
| `session:{id}:active_question` | 5 min | questionId hiện tại đang running |
| `session:{id}:presence` | session lifetime | SET of studentIds đang online |
| `refresh_token:{hash}` | 30 days | cached revocation check |

---

## 6. SQL DDL (Bootstrap Script — Excerpt)

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('teacher','student','admin')),
    avatar_color  VARCHAR(7),
    avatar_url    TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

-- Classrooms
CREATE TABLE classrooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    subject     VARCHAR(100),
    join_code   VARCHAR(12) UNIQUE NOT NULL,
    teacher_id  UUID NOT NULL REFERENCES users(id),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_classrooms_teacher ON classrooms(teacher_id);

-- Memberships
CREATE TABLE classroom_memberships (
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (classroom_id, student_id)
);
CREATE INDEX idx_memberships_student ON classroom_memberships(student_id);

-- Sessions
CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id),
    schedule_id  UUID REFERENCES schedules(id),
    teacher_id   UUID NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting','active','ended')),
    started_at   TIMESTAMPTZ,
    ended_at     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_classroom ON sessions(classroom_id);
CREATE INDEX idx_sessions_active ON sessions(id) WHERE status = 'active';

-- Questions
CREATE TABLE questions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES sessions(id),
    question_order SMALLINT NOT NULL,
    type           VARCHAR(20) NOT NULL CHECK (type IN ('single','multiple','essay')),
    content        TEXT NOT NULL,
    timer_seconds  INTEGER,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','running','ended')),
    started_at     TIMESTAMPTZ,
    ends_at        TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_session ON questions(session_id, question_order);
CREATE INDEX idx_questions_running ON questions(session_id) WHERE status = 'running';

-- Student Answers
CREATE TABLE student_answers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id         UUID NOT NULL REFERENCES questions(id),
    student_id          UUID NOT NULL REFERENCES users(id),
    selected_option_ids UUID[],
    essay_text          TEXT,
    confidence          VARCHAR(10) CHECK (confidence IN ('low','medium','high')),
    is_correct          BOOLEAN,
    answered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, student_id)
);
CREATE INDEX idx_answers_question ON student_answers(question_id);
CREATE INDEX idx_answers_student ON student_answers(student_id);
```

---

## 7. Sample Queries

### Dashboard: Per-question stats
```sql
SELECT
    q.id,
    q.question_order,
    q.content,
    COUNT(sa.id)                                        AS total_answered,
    COUNT(*) FILTER (WHERE sa.is_correct = TRUE)        AS correct_count,
    COUNT(*) FILTER (WHERE sa.is_correct = FALSE)       AS wrong_count,
    COUNT(*) FILTER (WHERE sa.id IS NULL)               AS skipped_count,
    COUNT(*) FILTER (WHERE sa.confidence = 'high')      AS conf_high,
    COUNT(*) FILTER (WHERE sa.confidence = 'medium')    AS conf_medium,
    COUNT(*) FILTER (WHERE sa.confidence = 'low')       AS conf_low
FROM questions q
CROSS JOIN session_presences sp
LEFT JOIN student_answers sa ON sa.question_id = q.id AND sa.student_id = sp.student_id
WHERE q.session_id = :sessionId
  AND sp.session_id = :sessionId
GROUP BY q.id, q.question_order, q.content
ORDER BY q.question_order;
```

### Student Review: Per-question result
```sql
SELECT
    q.question_order,
    q.content,
    q.type,
    sa.selected_option_ids,
    sa.essay_text,
    sa.confidence,
    sa.is_correct,
    sa.answered_at,
    -- Correct options for review
    ARRAY_AGG(qo.id) FILTER (WHERE qo.is_correct = TRUE) AS correct_option_ids
FROM questions q
LEFT JOIN student_answers sa ON sa.question_id = q.id AND sa.student_id = :studentId
LEFT JOIN question_options qo ON qo.question_id = q.id
WHERE q.session_id = :sessionId
GROUP BY q.id, q.question_order, q.content, q.type,
         sa.selected_option_ids, sa.essay_text, sa.confidence, sa.is_correct, sa.answered_at
ORDER BY q.question_order;
```
