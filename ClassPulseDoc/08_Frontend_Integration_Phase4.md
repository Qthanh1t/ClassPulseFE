# Frontend Integration Guide — Phase 4

> Tài liệu tích hợp cho **M12 Breakout Rooms**, **M13 Realtime WebSocket**, **M14 Dashboard**, **M15 Student Review**, **M16 Admin**.
> Base URL: `/api/v1` | Auth: `Authorization: Bearer <accessToken>`

---

## Mục lục

1. [TypeScript Types](#1-typescript-types)
2. [Breakout Room APIs (M12)](#2-breakout-room-apis-m12)
3. [Chat APIs (M13)](#3-chat-apis-m13)
4. [WebSocket — Hướng dẫn đầy đủ (M13)](#4-websocket--hướng-dẫn-đầy-đủ-m13)
5. [Dashboard API (M14)](#5-dashboard-api-m14)
6. [Student Review API (M15)](#6-student-review-api-m15)
7. [Admin APIs (M16)](#7-admin-apis-m16)
8. [Luồng hoạt động chính](#8-luồng-hoạt-động-chính)
9. [Error Codes](#9-error-codes)

---

## 1. TypeScript Types

```typescript
// ─── Breakout ─────────────────────────────────────────────────────────────────

interface BreakoutSessionDto {
  breakoutSessionId: string;   // UUID
  startedAt: string;           // ISO-8601
  endedAt?: string;            // null nếu chưa kết thúc
  rooms: RoomDto[];
}

interface RoomDto {
  id: string;                  // UUID
  name: string;
  task?: string;               // optional — hướng dẫn cho nhóm
  order: number;
  students: StudentInfo[];
}

interface StudentInfo {
  id: string;
  name: string;
  avatarColor?: string;
}

interface BreakoutEndResponse {
  breakoutSessionId: string;
  endedAt: string;
}

interface BroadcastResponse {
  sentAt: string;
  recipientCount: number;
}

interface JoinRoomResponse {
  roomId: string;
  roomName: string;
  joinedAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

interface ChatMessageDto {
  id: string;
  sender: {
    id: string;
    name: string;
    role: 'teacher' | 'student';
    avatarColor?: string;
  };
  content: string;
  breakoutRoomId?: string;     // null = tin nhắn session chính
  sentAt: string;
}

interface ChatCursorMeta {
  hasMore: boolean;
  oldestId?: string;           // UUID — dùng làm cursor `before` cho lần load tiếp
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

interface DashboardResponse {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  totalStudents: number;
  totalQuestions: number;
  overallStats: {
    avgScorePercent: number;   // 0-100, 2 chữ số thập phân
    participantCount: number;
  };
  questions: QuestionSummary[];
  students: StudentResult[];   // sắp xếp theo score DESC
}

interface QuestionSummary {
  id: string;
  questionOrder: number;
  type: 'single' | 'multiple' | 'essay';
  content: string;
  totalStudents: number;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  options?: OptionResult[];    // null với essay
}

interface OptionResult {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  count: number;               // số học sinh chọn option này
}

interface StudentResult {
  studentId: string;
  name: string;
  avatarColor?: string;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  scorePercent: number;        // 0-100
}

// ─── Student Review ───────────────────────────────────────────────────────────

interface ReviewResponse {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  scorePercent: number;        // 0-100 (từ pre-computed summary)
  questions: QuestionReview[];
}

type ReviewResult = 'correct' | 'wrong' | 'skipped' | 'pending_review';

interface QuestionReview {
  id: string;
  questionOrder: number;
  type: 'single' | 'multiple' | 'essay';
  content: string;
  mySelectedOptionIds?: string[];  // null với essay
  myEssayText?: string;            // null với MCQ
  confidence?: 'low' | 'medium' | 'high';
  options?: OptionReview[];        // null với essay
  result: ReviewResult;
}

interface OptionReview {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  selectedByMe: boolean;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

interface AdminStatsDto {
  totalUsers: number;
  teacherCount: number;
  studentCount: number;
  activeClassrooms: number;
  archivedClassrooms: number;
  activeSessions: number;
}
```

---

## 2. Breakout Room APIs (M12)

### 2.1 Tạo breakout session `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/breakouts
```

**Request body:**
```json
{
  "rooms": [
    {
      "name": "Nhóm A",
      "task": "Giải bài toán tích phân bề mặt",
      "studentIds": ["uuid-student-1", "uuid-student-2"]
    },
    {
      "name": "Nhóm B",
      "task": "Giải bài toán tích phân đường",
      "studentIds": ["uuid-student-3", "uuid-student-4"]
    }
  ]
}
```

> Mỗi student chỉ được assign vào **một phòng**. `task` là optional.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "breakoutSessionId": "bo-uuid",
    "startedAt": "2025-05-10T08:30:00Z",
    "rooms": [
      {
        "id": "room-uuid-1",
        "name": "Nhóm A",
        "task": "Giải bài toán tích phân bề mặt",
        "order": 1,
        "students": [
          { "id": "student-uuid-1", "name": "Trần Thị B", "avatarColor": "#FF6B6B" },
          { "id": "student-uuid-2", "name": "Lê Văn C", "avatarColor": null }
        ]
      }
    ]
  }
}
```

> Server tự động broadcast WebSocket event `breakout_started` đến tất cả học sinh.

**Lỗi thường gặp:**
- `409 BREAKOUT_ALREADY_ACTIVE` — đã có breakout đang chạy trong session
- `400 SESSION_NOT_ACTIVE` — session chưa bắt đầu hoặc đã kết thúc

---

### 2.2 Lấy breakout đang active `[AUTH]`

```
GET /api/v1/sessions/{sessionId}/breakouts/active
```

**Response `200`:** trả về `BreakoutSessionDto` hoặc `data: null` nếu không có breakout đang chạy.

---

### 2.3 Kết thúc breakout `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/breakouts/{breakoutId}/end
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "breakoutSessionId": "bo-uuid",
    "endedAt": "2025-05-10T08:55:00Z"
  }
}
```

> Server broadcast `breakout_ended` đến tất cả.

---

### 2.4 Broadcast thông báo đến tất cả phòng `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/breakouts/{breakoutId}/broadcast
```

**Request body:**
```json
{ "content": "Còn 5 phút, các nhóm chuẩn bị kết quả!" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sentAt": "2025-05-10T08:50:00Z",
    "recipientCount": 28
  }
}
```

> Tất cả học sinh nhận event `broadcast_message` qua WebSocket.

---

### 2.5 Teacher vào thăm phòng nhỏ `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/breakouts/{breakoutId}/rooms/{roomId}/join
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "roomId": "room-uuid-1",
    "roomName": "Nhóm A",
    "joinedAt": "2025-05-10T08:40:00Z"
  }
}
```

> Học sinh trong phòng nhận event `teacher_joined_room`. Teacher subscribe thêm `/topic/session/{id}/room/{roomId}` để nhận chat của phòng đó.

---

### 2.6 Teacher rời phòng nhỏ `[TEACHER/OWNER]`

```
POST /api/v1/sessions/{sessionId}/breakouts/{breakoutId}/rooms/{roomId}/leave
```

**Response `204 No Content`**

> Học sinh nhận event `teacher_left_room`.

---

## 3. Chat APIs (M13)

### 3.1 Lịch sử chat (cursor-based) `[PARTICIPANT]`

```
GET /api/v1/sessions/{sessionId}/chat?limit=50&before={messageId}
```

**Query params:**
| Param | Default | Mô tả |
|-------|---------|-------|
| `limit` | 50 | Số tin nhắn tối đa (1-100) |
| `before` | — | UUID của tin cũ nhất đang hiển thị — load thêm cũ hơn |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid",
      "sender": {
        "id": "user-uuid",
        "name": "Nguyễn Văn A",
        "role": "teacher",
        "avatarColor": "#6366f1"
      },
      "content": "Các em chú ý bài này nhé!",
      "breakoutRoomId": null,
      "sentAt": "2025-05-10T08:35:00Z"
    }
  ],
  "meta": {
    "hasMore": true,
    "oldestId": "oldest-msg-uuid"
  }
}
```

> Messages trả về theo thứ tự **cũ → mới** (chronological). Dùng `oldestId` làm `before` để load thêm. `breakoutRoomId != null` nghĩa là tin thuộc phòng nhỏ.

---

## 4. WebSocket — Hướng dẫn đầy đủ (M13)

> **M13 đã hoàn thành.** Không cần polling nữa — tất cả events được push realtime.

### 4.1 Kết nối WebSocket

```typescript
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function connectWebSocket(wsTicket: string, sessionId: string) {
  const client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    connectHeaders: {
      ticket: wsTicket,   // từ POST /sessions/{id}/join hoặc start, TTL 60s, dùng 1 lần
    },
    onConnect: () => {
      // Subscribe session chính
      client.subscribe(`/topic/session/${sessionId}`, (msg) => {
        const event = JSON.parse(msg.body);
        handleSessionEvent(event.type, event.payload);
      });

      // Subscribe unicast (WebRTC signals)
      client.subscribe('/user/queue/private', (msg) => {
        const event = JSON.parse(msg.body);
        handlePrivateEvent(event.type, event.payload);
      });

      // Heartbeat mỗi 25 giây để giữ kết nối
      setInterval(() => {
        client.publish({ destination: `/app/session/${sessionId}/heartbeat` });
      }, 25_000);
    },
    onDisconnect: () => {
      // Gọi POST /sessions/{id}/join lấy ticket mới rồi reconnect
    },
  });

  client.activate();
  return client;
}
```

**Quan trọng:**
- `wsTicket` **dùng 1 lần duy nhất**, TTL 60 giây — phải kết nối ngay sau khi nhận
- Không lưu ticket vào `localStorage`
- Khi mất kết nối: gọi lại `/join` để lấy ticket mới

---

### 4.2 Subscribe breakout room

Khi teacher vào thăm phòng nhỏ, hoặc học sinh đang ở phòng nhỏ:

```typescript
const roomSub = client.subscribe(
  `/topic/session/${sessionId}/room/${roomId}`,
  (msg) => {
    const event = JSON.parse(msg.body);
    handleRoomEvent(event.type, event.payload);
  }
);

// Hủy khi rời phòng
roomSub.unsubscribe();
```

---

### 4.3 Tất cả WebSocket Events

#### Events nhận tại `/topic/session/{sessionId}` (broadcast tất cả)

| Event type | Gửi khi | Payload |
|---|---|---|
| `student_presence` | Học sinh connect/disconnect WS | `{ studentId, action: "joined"\|"left" }` |
| `question_started` | Teacher bắt đầu câu hỏi | `{ id, questionOrder, type, content, timerSeconds, status, startedAt, endsAt, options[] }` |
| `question_ended` | Câu hỏi kết thúc (manual hoặc timer) | `{ id, status: "ended", endedAt }` |
| `raise_hand_changed` | Học sinh giơ/hạ tay | `{ studentId, raised: true\|false }` |
| `focus_changed` | Teacher focus học sinh | `{ focusedStudentId }` — `null` = unfocus |
| `breakout_started` | Teacher tạo breakout | `{ breakoutSessionId, rooms[{ id, name, task?, studentIds[] }] }` |
| `breakout_ended` | Teacher kết thúc breakout | `{ breakoutSessionId }` |
| `broadcast_message` | Teacher broadcast vào tất cả phòng | `{ content, sentAt }` |
| `chat_message` | Tin nhắn chat session chính | `{ id, senderId, senderName, senderRole, avatarColor, content, breakoutRoomId: null, sentAt }` |

#### Events nhận tại `/topic/session/{sessionId}/room/{roomId}` (breakout room)

| Event type | Payload |
|---|---|
| `chat_message` | `{ id, senderId, senderName, senderRole, avatarColor?, content, breakoutRoomId, sentAt }` |
| `teacher_joined_room` | `{ roomId, roomName }` |
| `teacher_left_room` | `{ roomId }` |

#### Events nhận tại `/user/queue/private` (unicast)

| Event type | Payload | Ghi chú |
|---|---|---|
| `answer_aggregate` | `{ questionId, answeredCount, optionDistribution[] }` | Chỉ teacher nhận — cập nhật live chart |
| `webrtc_offer` | `{ fromId, sdp }` | WebRTC — signaling P2P |
| `webrtc_answer` | `{ fromId, sdp }` | WebRTC — signaling P2P |
| `webrtc_ice_candidate` | `{ fromId, candidate }` | WebRTC — ICE candidate |

---

### 4.4 Gửi STOMP Messages (Client → Server)

#### Gửi chat

```typescript
client.publish({
  destination: `/app/session/${sessionId}/chat`,
  body: JSON.stringify({
    content: 'Thầy ơi em chưa hiểu phần này!',
    breakoutRoomId: null,    // null = chat session chính, UUID = chat phòng nhỏ
  }),
});
```

#### Giơ/hạ tay (Student only)

```typescript
client.publish({
  destination: `/app/session/${sessionId}/raise-hand`,
  body: JSON.stringify({ raised: true }),   // false = hạ tay
});
```

#### Focus học sinh (Teacher only)

```typescript
client.publish({
  destination: `/app/session/${sessionId}/focus`,
  body: JSON.stringify({ studentId: 'uuid-or-null' }),  // null = unfocus
});
```

#### Heartbeat (mỗi 25 giây)

```typescript
client.publish({
  destination: `/app/session/${sessionId}/heartbeat`,
  body: '{}',
});
```

---

### 4.5 WebRTC Signaling qua WebSocket

Signaling P2P — tất cả đều đi qua `/user/queue/private` của người nhận.

```typescript
// Gửi SDP offer đến peer
client.publish({
  destination: `/app/session/${sessionId}/webrtc/offer`,
  body: JSON.stringify({
    targetId: 'target-user-uuid',
    sdp: peerConnection.localDescription.sdp,
  }),
});

// Gửi SDP answer
client.publish({
  destination: `/app/session/${sessionId}/webrtc/answer`,
  body: JSON.stringify({ targetId, sdp }),
});

// Gửi ICE candidate
client.publish({
  destination: `/app/session/${sessionId}/webrtc/ice-candidate`,
  body: JSON.stringify({
    targetId: 'target-user-uuid',
    candidate: iceEvent.candidate,
  }),
});

// Nhận events từ /user/queue/private
function handlePrivateEvent(type: string, payload: any) {
  switch (type) {
    case 'webrtc_offer':
      handleRemoteOffer(payload.fromId, payload.sdp);
      break;
    case 'webrtc_answer':
      handleRemoteAnswer(payload.fromId, payload.sdp);
      break;
    case 'webrtc_ice_candidate':
      handleRemoteIce(payload.fromId, payload.candidate);
      break;
    case 'answer_aggregate':
      updateLiveChart(payload);    // Teacher view
      break;
  }
}
```

---

### 4.6 Xử lý tất cả session events

```typescript
function handleSessionEvent(type: string, payload: any) {
  switch (type) {
    // ── Presence ──────────────────────────────────────────────
    case 'student_presence':
      if (payload.action === 'joined') {
        addOnlineStudent(payload.studentId);
      } else {
        removeOnlineStudent(payload.studentId);
      }
      break;

    // ── Question ──────────────────────────────────────────────
    case 'question_started':
      setActiveQuestion(payload);      // payload = QuestionDto đầy đủ
      startCountdown(payload.endsAt);  // null nếu không có timer
      break;

    case 'question_ended':
      clearActiveQuestion();
      stopCountdown();
      // Fetch stats nếu là teacher: GET /sessions/{id}/questions/{qid}/stats
      break;

    // ── Raise Hand ────────────────────────────────────────────
    case 'raise_hand_changed':
      updateRaisedHand(payload.studentId, payload.raised);
      break;

    // ── Focus ─────────────────────────────────────────────────
    case 'focus_changed':
      setFocusedStudent(payload.focusedStudentId);  // null = unfocus
      break;

    // ── Breakout ──────────────────────────────────────────────
    case 'breakout_started':
      const myRoom = payload.rooms.find(r =>
        r.studentIds.includes(currentUserId)
      );
      if (myRoom) {
        // Subscribe phòng của mình
        subscribeBreakoutRoom(myRoom.id);
        showBreakoutView(payload, myRoom);
      }
      break;

    case 'breakout_ended':
      unsubscribeBreakoutRoom();
      showMainSessionView();
      break;

    case 'broadcast_message':
      showTeacherBroadcast(payload.content, payload.sentAt);
      break;

    // ── Chat (session chính) ───────────────────────────────────
    case 'chat_message':
      appendChatMessage(payload);
      break;
  }
}
```

---

## 5. Dashboard API (M14)

### 5.1 Thống kê session `[TEACHER/OWNER]`

```
GET /api/v1/sessions/{sessionId}/dashboard
```

> Chỉ hoạt động khi session đã `ended`. Gọi ngay sau khi nhận response từ `POST /sessions/{id}/end` (server tính async, thường mất < 1 giây).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid",
    "startedAt": "2025-05-10T08:00:00Z",
    "endedAt": "2025-05-10T09:00:00Z",
    "durationSeconds": 3600,
    "totalStudents": 28,
    "totalQuestions": 5,
    "overallStats": {
      "avgScorePercent": 76.43,
      "participantCount": 26
    },
    "questions": [
      {
        "id": "q-uuid",
        "questionOrder": 1,
        "type": "single",
        "content": "Nghiệm của 2x + 4 = 0 là?",
        "totalStudents": 26,
        "answeredCount": 24,
        "correctCount": 18,
        "skippedCount": 2,
        "options": [
          { "id": "opt-1", "label": "A", "text": "x = -2", "correct": true, "count": 18 },
          { "id": "opt-2", "label": "B", "text": "x = 2",  "correct": false, "count": 6 }
        ]
      }
    ],
    "students": [
      {
        "studentId": "user-uuid-1",
        "name": "Trần Thị B",
        "avatarColor": "#FF6B6B",
        "answeredCount": 5,
        "correctCount": 5,
        "skippedCount": 0,
        "scorePercent": 100.00
      }
    ]
  }
}
```

> `students` được sắp xếp theo `scorePercent DESC`. Câu hỏi essay không có `options` trong dashboard.

**Lỗi thường gặp:**
- `400 SESSION_NOT_ENDED` — session chưa kết thúc
- `403 FORBIDDEN` — không phải teacher của session

---

## 6. Student Review API (M15)

### 6.1 Xem lại kết quả sau session `[STUDENT/PARTICIPANT]`

```
GET /api/v1/sessions/{sessionId}/review
```

> Chỉ hoạt động sau khi session `ended`. Mỗi học sinh chỉ xem được kết quả của **chính mình**.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid",
    "startedAt": "2025-05-10T08:00:00Z",
    "endedAt": "2025-05-10T09:00:00Z",
    "totalQuestions": 5,
    "answeredCount": 4,
    "correctCount": 3,
    "skippedCount": 1,
    "scorePercent": 60.00,
    "questions": [
      {
        "id": "q-uuid",
        "questionOrder": 1,
        "type": "single",
        "content": "Nghiệm của 2x + 4 = 0 là?",
        "mySelectedOptionIds": ["opt-1-uuid"],
        "myEssayText": null,
        "confidence": "high",
        "options": [
          { "id": "opt-1", "label": "A", "text": "x = -2", "correct": true,  "selectedByMe": true },
          { "id": "opt-2", "label": "B", "text": "x = 2",  "correct": false, "selectedByMe": false }
        ],
        "result": "correct"
      },
      {
        "id": "q-uuid-2",
        "questionOrder": 2,
        "type": "essay",
        "content": "Giải thích định lý Pythagore.",
        "mySelectedOptionIds": null,
        "myEssayText": "Trong tam giác vuông...",
        "confidence": null,
        "options": null,
        "result": "pending_review"
      },
      {
        "id": "q-uuid-3",
        "questionOrder": 3,
        "type": "single",
        "content": "1 + 1 = ?",
        "mySelectedOptionIds": null,
        "myEssayText": null,
        "confidence": null,
        "options": [
          { "id": "opt-x", "label": "A", "text": "2", "correct": true, "selectedByMe": false }
        ],
        "result": "skipped"
      }
    ]
  }
}
```

**Giá trị `result`:**

| Giá trị | Ý nghĩa |
|---------|---------|
| `correct` | MCQ — chọn đúng tất cả đáp án |
| `wrong` | MCQ — chọn sai |
| `skipped` | Không trả lời câu hỏi này |
| `pending_review` | Essay — chờ giáo viên chấm thủ công |

**Lỗi thường gặp:**
- `400 SESSION_NOT_ENDED` — session chưa kết thúc
- `403 FORBIDDEN` — không phải student hoặc không tham gia session này

---

## 7. Admin APIs (M16)

> Tất cả Admin API yêu cầu role `admin`.

### 7.1 Thống kê hệ thống `[ADMIN]`

```
GET /api/v1/admin/stats
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "teacherCount": 45,
    "studentCount": 1200,
    "activeClassrooms": 38,
    "archivedClassrooms": 12,
    "activeSessions": 3
  }
}
```

---

### 7.2 Danh sách tất cả lớp học `[ADMIN]`

```
GET /api/v1/admin/classrooms?search=&page=1&limit=20
```

**Query params:**
| Param | Default | Mô tả |
|-------|---------|-------|
| `search` | — | Tìm theo tên lớp, môn học, hoặc tên giáo viên |
| `page` | 1 | Trang (1-indexed) |
| `limit` | 20 | Số phần tử mỗi trang |

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cls-uuid",
      "name": "Giải tích 3",
      "subject": "Toán cao cấp",
      "joinCode": "ABCD12",
      "teacher": {
        "id": "teacher-uuid",
        "name": "Nguyễn Văn A",
        "avatarColor": "#6366f1"
      },
      "studentCount": 28,
      "createdAt": "2025-03-01T00:00:00Z",
      "archived": false
    }
  ],
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 50,
    "totalPages": 3
  }
}
```

> Trả về **cả lớp archived** (khác với API của teacher chỉ trả lớp chưa archive). Dùng field `archived` để hiển thị badge.

---

## 8. Luồng hoạt động chính

### Luồng Breakout Room

```
Teacher:
1. GET /sessions/{id}/presence
   → Lấy danh sách học sinh để phân nhóm

2. POST /sessions/{id}/breakouts
   → Server broadcast "breakout_started" → học sinh tự subscribe phòng của mình

3. [Trong breakout]
   → POST /breakouts/{id}/broadcast           — gửi thông báo toàn trường
   → POST /breakouts/{id}/rooms/{rid}/join    — vào thăm phòng nhỏ
   → POST /breakouts/{id}/rooms/{rid}/leave   — rời phòng nhỏ

4. POST /breakouts/{id}/end
   → Server broadcast "breakout_ended" → học sinh quay về session chính

Student (tự động qua WS):
1. Nhận "breakout_started"
   → Tìm phòng có studentId của mình
   → Subscribe /topic/session/{id}/room/{roomId}

2. Chat với nhóm qua WS: /app/session/{id}/chat với breakoutRoomId

3. Nhận "breakout_ended"
   → Unsubscribe phòng nhỏ, quay về main view
```

### Luồng sau khi session kết thúc

```
Teacher:
1. POST /sessions/{id}/end
   → Server tính summary async (~ < 1s)
2. Sau 1-2 giây: GET /sessions/{id}/dashboard
   → Hiển thị kết quả toàn lớp

Student:
1. Nhận WS event "session_ended" (nếu đang kết nối) hoặc polling
2. GET /sessions/{id}/review
   → Hiển thị kết quả cá nhân, đáp án đúng/sai
```

### Luồng WebRTC Video Call (Mesh P2P)

```
Tất cả participants đều kết nối trực tiếp với nhau (mesh).

1. Mỗi user A cần kết nối với user B:
   A tạo RTCPeerConnection
   A.createOffer()
   → Gửi WS: /webrtc/offer { targetId: B, sdp }
   → B nhận event "webrtc_offer" tại /user/queue/private

2. B.setRemoteDescription(offer)
   B.createAnswer()
   → Gửi WS: /webrtc/answer { targetId: A, sdp }
   → A nhận "webrtc_answer"

3. ICE negotiation (song song):
   A,B gửi /webrtc/ice-candidate khi có candidate mới
   → Peer nhận "webrtc_ice_candidate"
```

---

## 9. Error Codes

| Code | HTTP | Ngữ cảnh | Xử lý |
|---|---|---|---|
| `BREAKOUT_ALREADY_ACTIVE` | 409 | Tạo breakout | Kết thúc breakout cũ trước |
| `BREAKOUT_NOT_ACTIVE` | 400 | Join/leave room | Breakout đã kết thúc |
| `BREAKOUT_ALREADY_ENDED` | 409 | End breakout | Đã kết thúc rồi |
| `SESSION_NOT_ACTIVE` | 400 | Tạo breakout | Session chưa start hoặc đã end |
| `SESSION_NOT_ENDED` | 400 | Dashboard / Review | Gọi khi session vẫn còn active |
| `BREAKOUT_ROOM_NOT_FOUND` | 404 | Join/leave room | Room không tồn tại hoặc không thuộc breakout này |
| `NOT_FOUND` | 404 | Chung | Resource không tồn tại |
| `FORBIDDEN` | 403 | Chung | Không có quyền — sai role hoặc không phải chủ lớp/session |
| `UNAUTHORIZED` | 401 | Chung | Token hết hạn → gọi `POST /auth/refresh` rồi retry |

---

### Lưu ý tích hợp quan trọng

**Dashboard sau session end:**
```typescript
async function endSession(sessionId: string) {
  await api.post(`/sessions/${sessionId}/end`);

  // Server tính summary async — đợi ngắn rồi fetch dashboard
  await new Promise(r => setTimeout(r, 1500));
  const dashboard = await api.get(`/sessions/${sessionId}/dashboard`);
  navigate(`/sessions/${sessionId}/dashboard`, { state: { dashboard } });
}
```

**Tự động reconnect WebSocket:**
```typescript
const client = new Client({
  // ...
  reconnectDelay: 5000,
  onDisconnect: async () => {
    // Lấy ticket mới trước khi reconnect
    const { wsTicket } = await api.post(`/sessions/${sessionId}/join`);
    client.connectHeaders = { ticket: wsTicket };
    // STOMP client tự reconnect sau reconnectDelay
  },
});
```

**Tính score với essay:**
```typescript
// Essay không tính vào scorePercent — chỉ MCQ
// result === 'pending_review' → hiển thị "Chờ chấm" thay vì đúng/sai
const displayResult = (q: QuestionReview) => {
  if (q.result === 'pending_review') return '⏳ Chờ giáo viên chấm';
  if (q.result === 'correct') return '✅ Đúng';
  if (q.result === 'wrong') return '❌ Sai';
  return '— Bỏ qua';
};
```

---

*Tài liệu này phản ánh trạng thái backend sau M12–M16. Tất cả T001–T098 đã hoàn thành.*
