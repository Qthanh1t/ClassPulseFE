# Frontend Integration Guide — Phase 3

> Tài liệu tích hợp REST API cho **M09 Session**, **M10 Question**, **M11 Student Answer**.
> Base URL: `/api/v1` | Auth: `Authorization: Bearer <accessToken>`

---

## Mục lục

1. [TypeScript Types](#1-typescript-types)
2. [Session APIs](#2-session-apis)
3. [Question APIs](#3-question-apis)
4. [Student Answer APIs](#4-student-answer-apis)
5. [WebSocket — Trạng thái hiện tại](#5-websocket--trạng-thái-hiện-tại)
6. [Luồng hoạt động chính](#6-luồng-hoạt-động-chính)
7. [Error Codes](#7-error-codes)

---

## 1. TypeScript Types

```typescript
// ─── Enums ───────────────────────────────────────────────────────────────────

type SessionStatus = 'active' | 'ended' | 'waiting';
type QuestionType = 'single' | 'multiple' | 'essay';
type QuestionStatus = 'draft' | 'running' | 'ended';
type ConfidenceLevel = 'low' | 'medium' | 'high';

// ─── Session ─────────────────────────────────────────────────────────────────

interface SessionDto {
  id: string;               // UUID
  classroomId: string;
  classroomName?: string;
  scheduleId?: string;
  scheduleTitle?: string;
  status: SessionStatus;
  startedAt: string;        // ISO-8601
  endedAt?: string;
  questionCount?: number;
  studentCount?: number;
  wsTicket?: string;        // chỉ có khi start/join — dùng 1 lần, TTL 60s
}

interface SessionDetailDto {
  id: string;
  classroomId: string;
  classroomName: string;
  teacher: { id: string; name: string };
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  questionCount: number;
  presentStudentCount: number;
}

interface JoinSessionResponse {
  sessionId: string;
  classroomName: string;
  teacherName: string;
  wsTicket: string;         // dùng 1 lần để kết nối WebSocket
}

interface SessionEndResponse {
  sessionId: string;
  endedAt: string;
  duration: number;         // seconds
  questionCount: number;
  studentCount: number;
}

interface PresenceDto {
  studentId: string;
  name: string;
  avatarColor?: string;
  joinedAt: string;
  isOnline: boolean;
}

// ─── Question ────────────────────────────────────────────────────────────────

interface OptionDto {
  id: string;
  label: string;            // "A", "B", "C", "D"
  text: string;
  isCorrect: boolean;
  optionOrder: number;
}

interface QuestionDto {
  id: string;
  questionOrder: number;
  type: QuestionType;
  content: string;
  timerSeconds?: number;
  status: QuestionStatus;
  startedAt?: string;
  endsAt?: string;          // server timestamp — dùng để đếm ngược, đừng dùng client clock
  endedAt?: string;
  createdAt: string;
  options: OptionDto[];
}

interface QuestionStartResponse {
  id: string;
  status: 'running';
  startedAt: string;
  endsAt?: string;
}

interface QuestionEndResponse {
  id: string;
  status: 'ended';
  endedAt: string;
}

interface QuestionStatsDto {
  questionId: string;
  totalStudents: number;
  answeredCount: number;
  skippedCount: number;
  correctCount: number;
  wrongCount: number;
  optionDistribution: {
    optionId: string;
    label: string;
    text: string;
    isCorrect: boolean;
    count: number;
  }[];
  confidenceBreakdown: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  silentStudents: {
    id: string;
    name: string;
    avatarColor?: string;
  }[];
}

// ─── Student Answer ───────────────────────────────────────────────────────────

interface SubmitAnswerRequest {
  selectedOptionIds?: string[];   // UUID[] — bắt buộc với single/multiple
  essayText?: string;             // max 5000 chars — bắt buộc với essay
  confidence?: ConfidenceLevel;   // optional cho tất cả loại
}

interface StudentAnswerDto {
  id: string;
  questionId: string;
  student: { id: string; name: string };
  selectedOptionIds: string[];
  essayText?: string;
  confidence?: ConfidenceLevel;
  isCorrect?: boolean;            // null với essay
  answeredAt: string;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PageMeta;
  error?: { code: string; message: string };
}

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

---

## 2. Session APIs

### 2.1 Bắt đầu session `[TEACHER/OWNER]`

```
POST /api/v1/classrooms/{classroomId}/sessions
```

**Request body** (optional):
```json
{ "scheduleId": "uuid-nếu-có" }
```

**Response `201`**:
```json
{
  "success": true,
  "data": {
    "id": "sess-uuid",
    "classroomId": "cls-uuid",
    "classroomName": "Toán 10A",
    "scheduleId": "sched-uuid",
    "status": "active",
    "startedAt": "2025-05-06T08:00:00Z",
    "wsTicket": "abc123xyz"
  }
}
```

> **Quan trọng:** Lưu `wsTicket` vào state ngay lập tức — dùng 1 lần duy nhất để kết nối WebSocket trong vòng 60 giây. Không lưu vào localStorage.

**Lỗi thường gặp:**
- `409 SESSION_ALREADY_ACTIVE` — lớp đã có session đang chạy

---

### 2.2 Danh sách session của lớp `[MEMBER]`

```
GET /api/v1/classrooms/{classroomId}/sessions?page=1&limit=20
```

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "sess-uuid",
      "scheduleTitle": "Bài 5: Giải phương trình",
      "status": "ended",
      "startedAt": "2025-05-06T08:00:00Z",
      "endedAt": "2025-05-06T09:00:00Z",
      "questionCount": 5,
      "studentCount": 28
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

---

### 2.3 Chi tiết session `[AUTH]`

```
GET /api/v1/sessions/{sessionId}
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "id": "sess-uuid",
    "classroomId": "cls-uuid",
    "classroomName": "Toán 10A",
    "teacher": { "id": "user-uuid", "name": "Nguyễn Văn A" },
    "status": "active",
    "startedAt": "2025-05-06T08:00:00Z",
    "questionCount": 3,
    "presentStudentCount": 25
  }
}
```

---

### 2.4 Kết thúc session `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/end
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid",
    "endedAt": "2025-05-06T09:00:00Z",
    "duration": 3600,
    "questionCount": 5,
    "studentCount": 28
  }
}
```

---

### 2.5 Học sinh tham gia session `[STUDENT]`

```
POST /api/v1/sessions/{sessionId}/join
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid",
    "classroomName": "Toán 10A",
    "teacherName": "Nguyễn Văn A",
    "wsTicket": "xyz789abc"
  }
}
```

> Học sinh dùng `wsTicket` này để kết nối WebSocket. Nếu ngắt kết nối rồi kết nối lại, gọi `/join` một lần nữa để lấy ticket mới.

---

### 2.6 Học sinh rời session `[STUDENT]`

```
POST /api/v1/sessions/{sessionId}/leave
```

**Response `204 No Content`**

---

### 2.7 Danh sách học sinh đang online `[PARTICIPANT]`

```
GET /api/v1/sessions/{sessionId}/presence
```

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "studentId": "user-uuid",
      "name": "Trần Thị B",
      "avatarColor": "#FF6B6B",
      "joinedAt": "2025-05-06T08:02:00Z",
      "isOnline": true
    }
  ]
}
```

> `isOnline: false` nghĩa là học sinh đã join nhưng hiện không kết nối WebSocket (ví dụ mất mạng, reload trang).

---

## 3. Question APIs

### 3.1 Danh sách câu hỏi `[AUTH]`

```
GET /api/v1/sessions/{sessionId}/questions
```

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "q-uuid",
      "questionOrder": 1,
      "type": "single",
      "content": "Nghiệm của phương trình 2x + 4 = 0 là?",
      "timerSeconds": 30,
      "status": "ended",
      "startedAt": "2025-05-06T08:10:00Z",
      "endsAt": "2025-05-06T08:10:30Z",
      "endedAt": "2025-05-06T08:10:30Z",
      "createdAt": "2025-05-06T08:05:00Z",
      "options": [
        { "id": "opt-1", "label": "A", "text": "x = -2", "isCorrect": true, "optionOrder": 1 },
        { "id": "opt-2", "label": "B", "text": "x = 2", "isCorrect": false, "optionOrder": 2 }
      ]
    }
  ]
}
```

---

### 3.2 Tạo câu hỏi `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/questions
```

**Request body — trắc nghiệm 1 đáp án:**
```json
{
  "type": "single",
  "content": "Nghiệm của phương trình 2x + 4 = 0 là?",
  "timerSeconds": 30,
  "options": [
    { "label": "A", "text": "x = -2", "isCorrect": true },
    { "label": "B", "text": "x = 2", "isCorrect": false },
    { "label": "C", "text": "x = 0", "isCorrect": false }
  ]
}
```

**Request body — trắc nghiệm nhiều đáp án:**
```json
{
  "type": "multiple",
  "content": "Những số nào là số nguyên tố?",
  "timerSeconds": 45,
  "options": [
    { "label": "A", "text": "2", "isCorrect": true },
    { "label": "B", "text": "3", "isCorrect": true },
    { "label": "C", "text": "4", "isCorrect": false },
    { "label": "D", "text": "5", "isCorrect": true }
  ]
}
```

**Request body — câu hỏi tự luận:**
```json
{
  "type": "essay",
  "content": "Giải thích định lý Pythagore bằng lời của bạn.",
  "timerSeconds": 120
}
```

> `options` không cần thiết cho `essay`. `timerSeconds` là optional — nếu không có thì câu hỏi không tự động kết thúc.

**Response `201`**: trả về `QuestionDto` đầy đủ.

**Lỗi thường gặp:**
- `400 OPTIONS_REQUIRED` — quên gửi options cho single/multiple
- `400 NO_CORRECT_OPTION` — không đánh dấu đáp án đúng

---

### 3.3 Bắt đầu câu hỏi `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/questions/{questionId}/start
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "id": "q-uuid",
    "status": "running",
    "startedAt": "2025-05-06T08:10:00Z",
    "endsAt": "2025-05-06T08:10:30Z"
  }
}
```

> `endsAt` là `null` nếu câu hỏi không có timer. Frontend nên dùng `endsAt` từ server để tính đồng hồ đếm ngược — **không dùng client clock** vì có thể lệch.

**Lỗi thường gặp:**
- `409 QUESTION_ALREADY_RUNNING` — đã có câu hỏi đang chạy trong session
- `400 QUESTION_NOT_DRAFT` — câu hỏi không ở trạng thái draft

---

### 3.4 Kết thúc câu hỏi thủ công `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/questions/{questionId}/end
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "id": "q-uuid",
    "status": "ended",
    "endedAt": "2025-05-06T08:10:25Z"
  }
}
```

> Server cũng tự động gọi endpoint này khi timer hết. Frontend cần xử lý cả 2 trường hợp (teacher end thủ công hoặc auto-end).

---

### 3.5 Thống kê câu hỏi `[TEACHER/OWNER]`

```
GET /api/v1/sessions/{sessionId}/questions/{questionId}/stats
```

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "questionId": "q-uuid",
    "totalStudents": 28,
    "answeredCount": 25,
    "skippedCount": 3,
    "correctCount": 18,
    "wrongCount": 7,
    "optionDistribution": [
      { "optionId": "opt-1", "label": "A", "text": "x = -2", "isCorrect": true, "count": 18 },
      { "optionId": "opt-2", "label": "B", "text": "x = 2", "isCorrect": false, "count": 7 }
    ],
    "confidenceBreakdown": {
      "high": 15,
      "medium": 7,
      "low": 3,
      "none": 3
    },
    "silentStudents": [
      { "id": "user-uuid", "name": "Nguyễn Văn C", "avatarColor": "#4ECDC4" }
    ]
  }
}
```

> `silentStudents` là danh sách học sinh **hiện đang online** nhưng chưa trả lời. Có thể poll endpoint này sau khi câu hỏi ended, hoặc chờ WebSocket event `question_ended` (M13).

---

## 4. Student Answer APIs

### 4.1 Nộp câu trả lời `[STUDENT]`

```
POST /api/v1/sessions/{sessionId}/questions/{questionId}/answers
```

**Request body — trắc nghiệm 1 đáp án:**
```json
{
  "selectedOptionIds": ["opt-1-uuid"],
  "confidence": "high"
}
```

**Request body — trắc nghiệm nhiều đáp án:**
```json
{
  "selectedOptionIds": ["opt-1-uuid", "opt-3-uuid"],
  "confidence": "medium"
}
```

**Request body — tự luận:**
```json
{
  "essayText": "Định lý Pythagore phát biểu rằng...",
  "confidence": "low"
}
```

> `confidence` là optional. `selectedOptionIds` có thể là mảng rỗng nếu học sinh muốn nộp trống (với MCQ). Server validate rằng các option ID phải thuộc câu hỏi đó.

**Response `201`**:
```json
{
  "success": true,
  "data": {
    "id": "answer-uuid",
    "questionId": "q-uuid",
    "student": { "id": "user-uuid", "name": "Trần Thị B" },
    "selectedOptionIds": ["opt-1-uuid"],
    "confidence": "high",
    "isCorrect": true,
    "answeredAt": "2025-05-06T08:10:15Z"
  }
}
```

> Sau khi nộp thành công, **disable UI nhập liệu** — server trả `409 ALREADY_ANSWERED` nếu nộp lần 2.

**Lỗi thường gặp:**
- `400 QUESTION_NOT_RUNNING` — câu hỏi chưa start hoặc đã ended
- `400 INVALID_OPTION` — selectedOptionIds chứa option không thuộc câu hỏi này
- `409 ALREADY_ANSWERED` — học sinh đã nộp rồi

---

### 4.2 Xem câu trả lời `[AUTH]`

```
GET /api/v1/sessions/{sessionId}/questions/{questionId}/answers
```

**Behavior phân quyền:**
- **Teacher**: nhận toàn bộ danh sách của tất cả học sinh
- **Student**: chỉ nhận câu trả lời của chính mình (wrapped trong mảng 1 phần tử)

**Response `200`** (Teacher):
```json
{
  "success": true,
  "data": [
    {
      "id": "answer-uuid",
      "questionId": "q-uuid",
      "student": { "id": "user-uuid-1", "name": "Trần Thị B" },
      "selectedOptionIds": ["opt-1-uuid"],
      "confidence": "high",
      "isCorrect": true,
      "answeredAt": "2025-05-06T08:10:15Z"
    },
    {
      "id": "answer-uuid-2",
      "questionId": "q-uuid",
      "student": { "id": "user-uuid-2", "name": "Lê Văn D" },
      "selectedOptionIds": ["opt-2-uuid"],
      "confidence": "low",
      "isCorrect": false,
      "answeredAt": "2025-05-06T08:10:22Z"
    }
  ]
}
```

> `isCorrect` là `null` cho câu hỏi `essay`. `essayText` xuất hiện thay vì `selectedOptionIds` với câu hỏi essay.

---

## 5. WebSocket — Trạng thái hiện tại

> **Lưu ý:** WebSocket broadcast (M13, T083–T087) **chưa được triển khai**. Kết nối WebSocket đã hoạt động nhưng server chưa push events cho các module Session/Question/Answer. Frontend cần **polling tạm thời** cho đến khi M13 hoàn thành.

### 5.1 Kết nối WebSocket

```typescript
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const client = new Client({
  webSocketFactory: () => new SockJS('/ws'),
  connectHeaders: {
    ticket: wsTicket,  // từ response của start/join, TTL 60s, dùng 1 lần
  },
  onConnect: () => {
    // subscribe sau khi connect
    client.subscribe(`/topic/session/${sessionId}`, (msg) => {
      const event = JSON.parse(msg.body);
      handleSessionEvent(event);
    });
  },
});

client.activate();
```

### 5.2 Events sẽ có sau M13

| Event type | Destination | Gửi đến | Payload chính |
|---|---|---|---|
| `session_started` | `/topic/session/{id}` | Tất cả | `sessionId`, `startedAt` |
| `session_ended` | `/topic/session/{id}` | Tất cả | `sessionId`, `endedAt`, `duration` |
| `question_started` | `/topic/session/{id}` | Tất cả | `QuestionDto` đầy đủ |
| `question_ended` | `/topic/session/{id}` | Tất cả | `questionId`, `endedAt` |
| `answer_aggregate` | `/topic/session/{id}` | Teacher | `optionDistribution`, `answeredCount` |
| `silent_alert` | `/user/queue/private` | Teacher | `silentStudents[]` |
| `presence_update` | `/topic/session/{id}` | Tất cả | `studentId`, `isOnline` |

### 5.3 Chiến lược polling tạm thời

```typescript
// Trong teacher dashboard — poll stats khi có câu hỏi đang chạy
useEffect(() => {
  if (!runningQuestionId) return;
  const interval = setInterval(async () => {
    const stats = await fetchQuestionStats(sessionId, runningQuestionId);
    setStats(stats);
  }, 3000); // poll mỗi 3 giây
  return () => clearInterval(interval);
}, [runningQuestionId]);

// Poll presence list
useEffect(() => {
  const interval = setInterval(async () => {
    const presence = await fetchPresence(sessionId);
    setPresence(presence);
  }, 5000);
  return () => clearInterval(interval);
}, [sessionId]);
```

---

## 6. Luồng hoạt động chính

### Luồng Teacher

```
1. POST /classrooms/{id}/sessions
   → Lấy wsTicket → Kết nối WebSocket
   → Lưu sessionId vào state

2. [Tạo câu hỏi trước session nếu muốn]
   POST /sessions/{id}/questions (status: draft)

3. POST /sessions/{id}/questions/{qid}/start
   → Câu hỏi chuyển sang running
   → Học sinh thấy câu hỏi (qua WS M13 hoặc polling)

4. Poll GET /sessions/{id}/questions/{qid}/stats
   → Hiển thị live chart đếm câu trả lời

5. POST /sessions/{id}/questions/{qid}/end (hoặc tự động khi timer hết)
   → GET /sessions/{id}/questions/{qid}/stats để xem kết quả cuối

6. POST /sessions/{id}/end
   → Nhận summary (duration, questionCount, studentCount)
```

### Luồng Student

```
1. POST /sessions/{sessionId}/join
   → Lấy wsTicket → Kết nối WebSocket
   → Subscribe /topic/session/{sessionId}

2. Chờ event question_started (WS M13) hoặc poll GET /sessions/{id}/questions

3. Khi câu hỏi running:
   → Hiển thị form trả lời với đồng hồ đếm ngược từ endsAt
   → POST /sessions/{id}/questions/{qid}/answers

4. Sau khi nộp:
   → Disable form (không nộp lần 2)
   → Chờ question_ended event / poll để xem kết quả

5. POST /sessions/{sessionId}/leave (khi thoát trang)
```

### Tính đồng hồ đếm ngược

```typescript
// Dùng endsAt từ server, KHÔNG dùng timerSeconds + Date.now()
function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(Math.ceil(diff / 1000));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining; // seconds còn lại
}
```

---

## 7. Error Codes

| Code | HTTP | Ngữ cảnh | Xử lý |
|---|---|---|---|
| `SESSION_ALREADY_ACTIVE` | 409 | Bắt đầu session | Thông báo lớp đang có session, điều hướng đến session đó |
| `QUESTION_ALREADY_RUNNING` | 409 | Bắt đầu câu hỏi | Disable nút start, chờ câu hiện tại kết thúc |
| `QUESTION_NOT_DRAFT` | 400 | Bắt đầu câu hỏi | Câu hỏi đã được dùng rồi (running/ended) |
| `QUESTION_NOT_RUNNING` | 400 | Nộp câu trả lời | Hiển thị "Câu hỏi đã kết thúc" |
| `ALREADY_ANSWERED` | 409 | Nộp câu trả lời | Disable form, hiển thị câu trả lời đã nộp |
| `INVALID_OPTION` | 400 | Nộp câu trả lời | Lỗi logic frontend — log và báo cáo |
| `OPTIONS_REQUIRED` | 400 | Tạo câu hỏi | Validation frontend thiếu |
| `NO_CORRECT_OPTION` | 400 | Tạo câu hỏi | Validate ít nhất 1 đáp án đúng |
| `NOT_FOUND` | 404 | Chung | Session/question không tồn tại |
| `FORBIDDEN` | 403 | Chung | Người dùng không có quyền |
| `UNAUTHORIZED` | 401 | Chung | Token hết hạn → refresh hoặc redirect login |

---

*Tài liệu này phản ánh trạng thái backend sau M09–M11. Cập nhật WebSocket events khi M13 hoàn thành.*
