# Kế hoạch tích hợp Phase 3 & Phase 4 — ClassPulse Frontend

> Tài liệu này mô tả chi tiết các bước tích hợp REST API và WebSocket cho Phase 3 (M09–M11)
> và Phase 4 (M12–M16) vào frontend hiện tại (React 19 + TypeScript + Vite).
> **Điều kiện tiên quyết:** Phase 1–2 (M01–M08) đã tích hợp hoàn chỉnh.

---

## Tổng quan

| Phase | Module | Nội dung | Ưu tiên |
|-------|--------|----------|---------|
| 3 | M09 | Session service + types | P0 |
| 3 | M10 | Question service + types | P0 |
| 3 | M11 | Student Answer service + types | P0 |
| 4 | M13 | WebSocket layer (STOMP/SockJS) | P0 |
| 4 | M12 | Breakout Room service + types | P1 |
| 4 | M14 | Dashboard service + types | P1 |
| 4 | M15 | Student Review service + types | P1 |
| 4 | M16 | Admin service + types | P2 |

---

## Phần 1 — Mở rộng `src/types/api.ts`

Thêm tất cả DTO types mới vào cuối file `src/types/api.ts`.

### 1.1 Session Types (M09)

```typescript
// ── Session ────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'ended' | 'waiting';

export interface SessionDto {
  id: string;
  classroomId: string;
  classroomName?: string;
  scheduleId?: string;
  scheduleTitle?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  questionCount?: number;
  studentCount?: number;
  wsTicket?: string; // chỉ có khi start/join
}

export interface SessionDetailDto {
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

export interface JoinSessionResponse {
  sessionId: string;
  classroomName: string;
  teacherName: string;
  wsTicket: string;
}

export interface SessionEndResponse {
  sessionId: string;
  endedAt: string;
  duration: number; // seconds
  questionCount: number;
  studentCount: number;
}

export interface PresenceDto {
  studentId: string;
  name: string;
  avatarColor?: string;
  joinedAt: string;
  isOnline: boolean;
}

export interface StartSessionRequest {
  scheduleId?: string;
}
```

### 1.2 Question Types (M10)

```typescript
// ── Question ───────────────────────────────────────────────────────

export type QuestionType = 'single' | 'multiple' | 'essay';
export type QuestionStatus = 'draft' | 'running' | 'ended';

export interface OptionDto {
  id: string;
  label: string;     // "A", "B", "C", "D"
  text: string;
  isCorrect: boolean;
  optionOrder: number;
}

export interface QuestionDto {
  id: string;
  questionOrder: number;
  type: QuestionType;
  content: string;
  timerSeconds?: number;
  status: QuestionStatus;
  startedAt?: string;
  endsAt?: string;   // server timestamp — dùng để đếm ngược
  endedAt?: string;
  createdAt: string;
  options: OptionDto[];
}

export interface CreateOptionRequest {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionRequest {
  type: QuestionType;
  content: string;
  timerSeconds?: number;
  options?: CreateOptionRequest[]; // không cần với essay
}

export interface QuestionStartResponse {
  id: string;
  status: 'running';
  startedAt: string;
  endsAt?: string;
}

export interface QuestionEndResponse {
  id: string;
  status: 'ended';
  endedAt: string;
}

export interface QuestionStatsDto {
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
```

### 1.3 Student Answer Types (M11)

```typescript
// ── Student Answer ─────────────────────────────────────────────────

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface SubmitAnswerRequest {
  selectedOptionIds?: string[];
  essayText?: string;
  confidence?: ConfidenceLevel;
}

export interface StudentAnswerDto {
  id: string;
  questionId: string;
  student: { id: string; name: string };
  selectedOptionIds: string[];
  essayText?: string;
  confidence?: ConfidenceLevel;
  isCorrect?: boolean; // null với essay
  answeredAt: string;
}
```

### 1.4 Breakout Types (M12)

```typescript
// ── Breakout ───────────────────────────────────────────────────────

export interface RoomStudentInfo {
  id: string;
  name: string;
  avatarColor?: string;
}

export interface RoomDto {
  id: string;
  name: string;
  task?: string;
  order: number;
  students: RoomStudentInfo[];
}

export interface BreakoutSessionDto {
  breakoutSessionId: string;
  startedAt: string;
  endedAt?: string;
  rooms: RoomDto[];
}

export interface CreateRoomRequest {
  name: string;
  task?: string;
  studentIds: string[];
}

export interface CreateBreakoutRequest {
  rooms: CreateRoomRequest[];
}

export interface BreakoutEndResponse {
  breakoutSessionId: string;
  endedAt: string;
}

export interface BroadcastRequest {
  content: string;
}

export interface BroadcastResponse {
  sentAt: string;
  recipientCount: number;
}

export interface JoinRoomResponse {
  roomId: string;
  roomName: string;
  joinedAt: string;
}
```

### 1.5 Chat Types (M13)

```typescript
// ── Chat ──────────────────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  sender: {
    id: string;
    name: string;
    role: 'teacher' | 'student';
    avatarColor?: string;
  };
  content: string;
  breakoutRoomId?: string; // null = session chính
  sentAt: string;
}

export interface ChatCursorMeta {
  hasMore: boolean;
  oldestId?: string;
}
```

### 1.6 Dashboard Types (M14)

```typescript
// ── Dashboard ─────────────────────────────────────────────────────

export interface OptionResult {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  count: number;
}

export interface QuestionSummary {
  id: string;
  questionOrder: number;
  type: QuestionType;
  content: string;
  totalStudents: number;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  options?: OptionResult[];
}

export interface StudentResult {
  studentId: string;
  name: string;
  avatarColor?: string;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  scorePercent: number;
}

export interface DashboardResponse {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  totalStudents: number;
  totalQuestions: number;
  overallStats: {
    avgScorePercent: number;
    participantCount: number;
  };
  questions: QuestionSummary[];
  students: StudentResult[];
}
```

### 1.7 Student Review Types (M15)

```typescript
// ── Student Review ────────────────────────────────────────────────

export type ReviewResult = 'correct' | 'wrong' | 'skipped' | 'pending_review';

export interface OptionReview {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  selectedByMe: boolean;
}

export interface QuestionReview {
  id: string;
  questionOrder: number;
  type: QuestionType;
  content: string;
  mySelectedOptionIds?: string[];
  myEssayText?: string;
  confidence?: ConfidenceLevel;
  options?: OptionReview[];
  result: ReviewResult;
}

export interface ReviewResponse {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  skippedCount: number;
  scorePercent: number;
  questions: QuestionReview[];
}
```

### 1.8 Admin Types (M16)

```typescript
// ── Admin ─────────────────────────────────────────────────────────

export interface AdminStatsDto {
  totalUsers: number;
  teacherCount: number;
  studentCount: number;
  activeClassrooms: number;
  archivedClassrooms: number;
  activeSessions: number;
}

export interface AdminClassroomDto {
  id: string;
  name: string;
  subject?: string;
  joinCode: string;
  teacher: { id: string; name: string; avatarColor: string | null };
  studentCount: number;
  createdAt: string;
  archived: boolean;
}

export interface UpdateUserRequest {
  isActive?: boolean;
  role?: 'teacher' | 'student' | 'admin';
}
```

---

## Phần 2 — Tạo Services mới

### 2.1 `src/services/session.service.ts`

```typescript
import api from '../lib/api';
import type {
  ApiResponse, SessionDto, SessionDetailDto, SessionEndResponse,
  JoinSessionResponse, PresenceDto, StartSessionRequest,
} from '../types/api';

const sessionService = {
  // M09 — Teacher bắt đầu session
  start: (classroomId: string, body: StartSessionRequest = {}) =>
    api.post<ApiResponse<SessionDto>>(
      `/classrooms/${classroomId}/sessions`, body
    ).then(r => r.data),

  // M09 — Danh sách session của lớp
  listByClassroom: (classroomId: string, page = 1, limit = 20) =>
    api.get<ApiResponse<SessionDto[]>>(
      `/classrooms/${classroomId}/sessions`, { params: { page, limit } }
    ).then(r => r.data),

  // M09 — Chi tiết session
  get: (sessionId: string) =>
    api.get<ApiResponse<SessionDetailDto>>(
      `/sessions/${sessionId}`
    ).then(r => r.data),

  // M09 — Kết thúc session
  end: (sessionId: string) =>
    api.post<ApiResponse<SessionEndResponse>>(
      `/sessions/${sessionId}/end`
    ).then(r => r.data),

  // M09 — Student tham gia session
  join: (sessionId: string) =>
    api.post<ApiResponse<JoinSessionResponse>>(
      `/sessions/${sessionId}/join`
    ).then(r => r.data),

  // M09 — Student rời session
  leave: (sessionId: string) =>
    api.post<ApiResponse<void>>(
      `/sessions/${sessionId}/leave`
    ).then(r => r.data),

  // M09 — Danh sách HS đang online
  getPresence: (sessionId: string) =>
    api.get<ApiResponse<PresenceDto[]>>(
      `/sessions/${sessionId}/presence`
    ).then(r => r.data),
};

export default sessionService;
```

### 2.2 `src/services/question.service.ts`

```typescript
import api from '../lib/api';
import type {
  ApiResponse, QuestionDto, CreateQuestionRequest,
  QuestionStartResponse, QuestionEndResponse, QuestionStatsDto,
} from '../types/api';

const questionService = {
  // M10 — Danh sách câu hỏi
  list: (sessionId: string) =>
    api.get<ApiResponse<QuestionDto[]>>(
      `/sessions/${sessionId}/questions`
    ).then(r => r.data),

  // M10 — Tạo câu hỏi mới (status: draft)
  create: (sessionId: string, body: CreateQuestionRequest) =>
    api.post<ApiResponse<QuestionDto>>(
      `/sessions/${sessionId}/questions`, body
    ).then(r => r.data),

  // M10 — Bắt đầu câu hỏi
  start: (sessionId: string, questionId: string) =>
    api.post<ApiResponse<QuestionStartResponse>>(
      `/sessions/${sessionId}/questions/${questionId}/start`
    ).then(r => r.data),

  // M10 — Kết thúc câu hỏi thủ công
  end: (sessionId: string, questionId: string) =>
    api.post<ApiResponse<QuestionEndResponse>>(
      `/sessions/${sessionId}/questions/${questionId}/end`
    ).then(r => r.data),

  // M10 — Thống kê câu hỏi (live + sau khi kết thúc)
  getStats: (sessionId: string, questionId: string) =>
    api.get<ApiResponse<QuestionStatsDto>>(
      `/sessions/${sessionId}/questions/${questionId}/stats`
    ).then(r => r.data),
};

export default questionService;
```

### 2.3 `src/services/answer.service.ts`

```typescript
import api from '../lib/api';
import type { ApiResponse, SubmitAnswerRequest, StudentAnswerDto } from '../types/api';

const answerService = {
  // M11 — Student nộp câu trả lời
  submit: (sessionId: string, questionId: string, body: SubmitAnswerRequest) =>
    api.post<ApiResponse<StudentAnswerDto>>(
      `/sessions/${sessionId}/questions/${questionId}/answers`, body
    ).then(r => r.data),

  // M11 — Xem câu trả lời (teacher: tất cả; student: của mình)
  list: (sessionId: string, questionId: string) =>
    api.get<ApiResponse<StudentAnswerDto[]>>(
      `/sessions/${sessionId}/questions/${questionId}/answers`
    ).then(r => r.data),
};

export default answerService;
```

### 2.4 `src/services/breakout.service.ts`

```typescript
import api from '../lib/api';
import type {
  ApiResponse, BreakoutSessionDto, CreateBreakoutRequest,
  BreakoutEndResponse, BroadcastRequest, BroadcastResponse, JoinRoomResponse,
} from '../types/api';

const breakoutService = {
  // M12 — Tạo breakout session
  create: (sessionId: string, body: CreateBreakoutRequest) =>
    api.post<ApiResponse<BreakoutSessionDto>>(
      `/sessions/${sessionId}/breakouts`, body
    ).then(r => r.data),

  // M12 — Lấy breakout đang active (null nếu không có)
  getActive: (sessionId: string) =>
    api.get<ApiResponse<BreakoutSessionDto | null>>(
      `/sessions/${sessionId}/breakouts/active`
    ).then(r => r.data),

  // M12 — Kết thúc breakout
  end: (sessionId: string, breakoutId: string) =>
    api.post<ApiResponse<BreakoutEndResponse>>(
      `/sessions/${sessionId}/breakouts/${breakoutId}/end`
    ).then(r => r.data),

  // M12 — Broadcast thông báo đến tất cả phòng
  broadcast: (sessionId: string, breakoutId: string, body: BroadcastRequest) =>
    api.post<ApiResponse<BroadcastResponse>>(
      `/sessions/${sessionId}/breakouts/${breakoutId}/broadcast`, body
    ).then(r => r.data),

  // M12 — Teacher vào thăm phòng nhỏ
  joinRoom: (sessionId: string, breakoutId: string, roomId: string) =>
    api.post<ApiResponse<JoinRoomResponse>>(
      `/sessions/${sessionId}/breakouts/${breakoutId}/rooms/${roomId}/join`
    ).then(r => r.data),

  // M12 — Teacher rời phòng nhỏ
  leaveRoom: (sessionId: string, breakoutId: string, roomId: string) =>
    api.post<ApiResponse<void>>(
      `/sessions/${sessionId}/breakouts/${breakoutId}/rooms/${roomId}/leave`
    ).then(r => r.data),
};

export default breakoutService;
```

### 2.5 `src/services/chat.service.ts`

```typescript
import api from '../lib/api';
import type { ApiResponse, ChatMessageDto, ChatCursorMeta } from '../types/api';

const chatService = {
  // M13 — Lịch sử chat (cursor-based)
  getHistory: (sessionId: string, limit = 50, before?: string) =>
    api.get<ApiResponse<ChatMessageDto[]> & { meta: ChatCursorMeta }>(
      `/sessions/${sessionId}/chat`,
      { params: { limit, ...(before ? { before } : {}) } }
    ).then(r => r.data),
};

export default chatService;
```

### 2.6 `src/services/dashboard.service.ts`

```typescript
import api from '../lib/api';
import type { ApiResponse, DashboardResponse, ReviewResponse } from '../types/api';

const dashboardService = {
  // M14 — Thống kê session (teacher, chỉ sau khi ended)
  getTeacherDashboard: (sessionId: string) =>
    api.get<ApiResponse<DashboardResponse>>(
      `/sessions/${sessionId}/dashboard`
    ).then(r => r.data),

  // M15 — Xem lại kết quả cá nhân (student, chỉ sau khi ended)
  getStudentReview: (sessionId: string) =>
    api.get<ApiResponse<ReviewResponse>>(
      `/sessions/${sessionId}/review`
    ).then(r => r.data),
};

export default dashboardService;
```

### 2.7 `src/services/admin.service.ts`

```typescript
import api from '../lib/api';
import type {
  ApiResponse, AdminStatsDto, AdminClassroomDto,
  UserDto, UpdateUserRequest, PageMeta,
} from '../types/api';

const adminService = {
  // M16 — Thống kê hệ thống
  getStats: () =>
    api.get<ApiResponse<AdminStatsDto>>('/admin/stats').then(r => r.data),

  // M16 — Danh sách tất cả lớp học
  listClassrooms: (params: { search?: string; page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<AdminClassroomDto[]> & { meta: PageMeta }>(
      '/admin/classrooms', { params }
    ).then(r => r.data),

  // M16 — Danh sách users (đã có trong user.service cho ADMIN route)
  listUsers: (params: { role?: string; search?: string; page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<UserDto[]>>('/users', { params }).then(r => r.data),

  // M16 — Cập nhật user (ban/unban, đổi role)
  updateUser: (userId: string, body: UpdateUserRequest) =>
    api.put<ApiResponse<UserDto>>(`/users/${userId}`, body).then(r => r.data),
};

export default adminService;
```

---

## Phần 3 — WebSocket Layer (M13)

### 3.1 Tạo `src/lib/websocket.ts`

File này bọc toàn bộ logic STOMP/SockJS. Dùng pattern factory để dễ mock trong test.

```typescript
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { IMessage } from '@stomp/stompjs';

export type WsEventType =
  | 'student_presence'
  | 'question_started'
  | 'question_ended'
  | 'raise_hand_changed'
  | 'focus_changed'
  | 'breakout_started'
  | 'breakout_ended'
  | 'broadcast_message'
  | 'chat_message'
  | 'answer_aggregate'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice_candidate'
  | 'teacher_joined_room'
  | 'teacher_left_room';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
}

export type WsEventHandler = (event: WsEvent) => void;

export interface SessionWsClient {
  subscribe: (handler: WsEventHandler) => void;
  subscribeRoom: (roomId: string, handler: WsEventHandler) => void;
  unsubscribeRoom: (roomId: string) => void;
  sendChat: (content: string, breakoutRoomId?: string) => void;
  sendRaiseHand: (raised: boolean) => void;
  sendFocus: (studentId: string | null) => void;
  sendHeartbeat: () => void;
  sendWebRtcOffer: (targetId: string, sdp: string) => void;
  sendWebRtcAnswer: (targetId: string, sdp: string) => void;
  sendWebRtcIceCandidate: (targetId: string, candidate: RTCIceCandidate) => void;
  disconnect: () => void;
}

export function createSessionWsClient(
  wsTicket: string,
  sessionId: string,
  onReconnect: () => Promise<string>, // gọi lại API join/start để lấy ticket mới
): SessionWsClient {
  let mainHandler: WsEventHandler | null = null;
  const roomHandlers = new Map<string, WsEventHandler>();
  let roomSubs = new Map<string, ReturnType<InstanceType<typeof Client>['subscribe']>>();

  const client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    connectHeaders: { ticket: wsTicket },
    reconnectDelay: 5000,

    onConnect: () => {
      // Subscribe session chính
      client.subscribe(`/topic/session/${sessionId}`, (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Subscribe unicast (answer_aggregate, webrtc signals)
      client.subscribe('/user/queue/private', (msg: IMessage) => {
        const event = JSON.parse(msg.body) as WsEvent;
        mainHandler?.(event);
      });

      // Heartbeat mỗi 25 giây
      const hbInterval = setInterval(() => {
        if (client.connected) {
          client.publish({ destination: `/app/session/${sessionId}/heartbeat`, body: '{}' });
        }
      }, 25_000);

      client.onDisconnect = async () => {
        clearInterval(hbInterval);
        try {
          const newTicket = await onReconnect();
          client.connectHeaders = { ticket: newTicket };
        } catch {
          // ignore — STOMP sẽ retry sau reconnectDelay
        }
      };
    },
  });

  client.activate();

  return {
    subscribe(handler) {
      mainHandler = handler;
    },

    subscribeRoom(roomId, handler) {
      roomHandlers.set(roomId, handler);
      if (client.connected) {
        const sub = client.subscribe(
          `/topic/session/${sessionId}/room/${roomId}`,
          (msg: IMessage) => {
            const event = JSON.parse(msg.body) as WsEvent;
            handler(event);
          }
        );
        roomSubs.set(roomId, sub);
      }
    },

    unsubscribeRoom(roomId) {
      roomSubs.get(roomId)?.unsubscribe();
      roomSubs.delete(roomId);
      roomHandlers.delete(roomId);
    },

    sendChat(content, breakoutRoomId) {
      client.publish({
        destination: `/app/session/${sessionId}/chat`,
        body: JSON.stringify({ content, breakoutRoomId: breakoutRoomId ?? null }),
      });
    },

    sendRaiseHand(raised) {
      client.publish({
        destination: `/app/session/${sessionId}/raise-hand`,
        body: JSON.stringify({ raised }),
      });
    },

    sendFocus(studentId) {
      client.publish({
        destination: `/app/session/${sessionId}/focus`,
        body: JSON.stringify({ studentId }),
      });
    },

    sendHeartbeat() {
      client.publish({
        destination: `/app/session/${sessionId}/heartbeat`,
        body: '{}',
      });
    },

    sendWebRtcOffer(targetId, sdp) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/offer`,
        body: JSON.stringify({ targetId, sdp }),
      });
    },

    sendWebRtcAnswer(targetId, sdp) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/answer`,
        body: JSON.stringify({ targetId, sdp }),
      });
    },

    sendWebRtcIceCandidate(targetId, candidate) {
      client.publish({
        destination: `/app/session/${sessionId}/webrtc/ice-candidate`,
        body: JSON.stringify({ targetId, candidate }),
      });
    },

    disconnect() {
      client.deactivate();
    },
  };
}
```

### 3.2 Cài đặt dependencies

```bash
npm install @stomp/stompjs sockjs-client
npm install -D @types/sockjs-client
```

---

## Phần 4 — Tích hợp TeacherSessionPage

### 4.1 State thay thế mock data

**Xóa:** import từ `../../mock/*`, `DemoState`, `Segmented` demo control.

**Thêm vào:**

```typescript
// State thực tế từ API
const [session, setSession] = useState<SessionDto | null>(null);
const [questions, setQuestions] = useState<QuestionDto[]>([]);
const [runningQuestion, setRunningQuestion] = useState<QuestionDto | null>(null);
const [questionStats, setQuestionStats] = useState<QuestionStatsDto | null>(null);
const [presence, setPresence] = useState<PresenceDto[]>([]);
const [breakout, setBreakout] = useState<BreakoutSessionDto | null>(null);
const wsRef = useRef<SessionWsClient | null>(null);
```

### 4.2 Khởi tạo session + WebSocket

```typescript
useEffect(() => {
  // id = classroomId từ params
  sessionService.start(id!, {}).then(res => {
    const sess = res.data!;
    setSession(sess);
    // Kết nối WS ngay với ticket nhận được
    wsRef.current = createSessionWsClient(
      sess.wsTicket!,
      sess.id,
      // onReconnect: lấy ticket mới (teacher không cần join lại nhưng có thể dùng ws-ticket)
      async () => {
        const tkRes = await authService.getWsTicket();
        return tkRes.data!.ticket;
      }
    );
    wsRef.current.subscribe(handleSessionEvent);
  });

  return () => { wsRef.current?.disconnect(); };
}, [id]);
```

### 4.3 handleSessionEvent trong TeacherSessionPage

```typescript
function handleSessionEvent(event: WsEvent) {
  switch (event.type) {
    case 'student_presence': {
      const { studentId, action } = event.payload as { studentId: string; action: 'joined' | 'left' };
      setPresence(prev =>
        action === 'joined'
          ? prev.map(p => p.studentId === studentId ? { ...p, isOnline: true } : p)
          : prev.map(p => p.studentId === studentId ? { ...p, isOnline: false } : p)
      );
      break;
    }
    case 'question_started':
      setRunningQuestion(event.payload as QuestionDto);
      setQuestionStats(null);
      break;
    case 'question_ended':
      setRunningQuestion(prev => prev ? { ...prev, status: 'ended' } : null);
      // Fetch stats cuối
      if (session) {
        const q = event.payload as { id: string };
        questionService.getStats(session.id, q.id).then(r => setQuestionStats(r.data!));
      }
      break;
    case 'answer_aggregate':
      // Live chart cập nhật
      setQuestionStats(prev => prev
        ? { ...prev, ...event.payload }
        : prev
      );
      break;
    case 'raise_hand_changed': {
      const { studentId, raised } = event.payload as { studentId: string; raised: boolean };
      setPresence(prev => prev.map(p =>
        p.studentId === studentId ? { ...p, raisedHand: raised } : p
      ));
      break;
    }
    case 'breakout_started':
      setBreakout(event.payload as BreakoutSessionDto);
      break;
    case 'breakout_ended':
      setBreakout(null);
      break;
    case 'chat_message':
      // Append vào chat state
      setChatMessages(prev => [...prev, event.payload as ChatMessageDto]);
      break;
    case 'broadcast_message':
      message.info((event.payload as { content: string }).content);
      break;
  }
}
```

### 4.4 Tạo câu hỏi + bắt đầu/kết thúc

```typescript
// Tạo câu hỏi mới từ CreateQuestionModal
async function handleCreateQuestion(req: CreateQuestionRequest) {
  const res = await questionService.create(session!.id, req);
  const q = res.data!;
  setQuestions(prev => [...prev, q]);
  // Tự động bắt đầu ngay sau khi tạo
  const startRes = await questionService.start(session!.id, q.id);
  setRunningQuestion({ ...q, ...startRes.data! });
}

// Kết thúc câu hỏi thủ công
async function handleEndQuestion() {
  if (!runningQuestion || !session) return;
  await questionService.end(session.id, runningQuestion.id);
  // WS event question_ended sẽ cập nhật state
}

// Kết thúc session
async function handleEndSession() {
  const res = await sessionService.end(session!.id);
  navigate(`/dashboard/${res.data!.sessionId}`);
}
```

---

## Phần 5 — Tích hợp StudentSessionPage

### 5.1 State thực tế

```typescript
const [session, setSession] = useState<JoinSessionResponse | null>(null);
const [activeQuestion, setActiveQuestion] = useState<QuestionDto | null>(null);
const [myAnswer, setMyAnswer] = useState<StudentAnswerDto | null>(null);
const [chatMessages, setChatMessages] = useState<ChatMessageDto[]>([]);
const [myRoom, setMyRoom] = useState<RoomDto | null>(null);
const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);
const [raisedHand, setRaisedHand] = useState(false);
const wsRef = useRef<SessionWsClient | null>(null);
```

### 5.2 Tham gia session + WebSocket

```typescript
useEffect(() => {
  // id = sessionId từ params
  sessionService.join(id!).then(res => {
    const joinRes = res.data!;
    setSession(joinRes);
    wsRef.current = createSessionWsClient(
      joinRes.wsTicket,
      joinRes.sessionId,
      // onReconnect: join lại để lấy ticket mới
      async () => {
        const r = await sessionService.join(id!);
        return r.data!.wsTicket;
      }
    );
    wsRef.current.subscribe(handleStudentEvent);
    // Load chat history
    chatService.getHistory(joinRes.sessionId).then(r => setChatMessages(r.data ?? []));
  });

  return () => {
    sessionService.leave(id!);
    wsRef.current?.disconnect();
  };
}, [id]);
```

### 5.3 handleSessionEvent trong StudentSessionPage

```typescript
function handleStudentEvent(event: WsEvent) {
  switch (event.type) {
    case 'question_started':
      setActiveQuestion(event.payload as QuestionDto);
      setMyAnswer(null);
      break;
    case 'question_ended':
      setActiveQuestion(prev => prev ? { ...prev, status: 'ended' } : null);
      break;
    case 'breakout_started': {
      const payload = event.payload as { breakoutSessionId: string; rooms: { id: string; name: string; task?: string; studentIds: string[] }[] };
      const userId = authStore.getState().user!.id;
      const room = payload.rooms.find(r => r.studentIds.includes(userId));
      if (room) {
        setMyRoom(room as unknown as RoomDto);
        wsRef.current?.subscribeRoom(room.id, handleRoomEvent);
      }
      break;
    }
    case 'breakout_ended':
      wsRef.current?.unsubscribeRoom(myRoom?.id ?? '');
      setMyRoom(null);
      break;
    case 'broadcast_message':
      setBroadcastMsg((event.payload as { content: string }).content);
      break;
    case 'chat_message':
      setChatMessages(prev => [...prev, event.payload as ChatMessageDto]);
      break;
    case 'raise_hand_changed':
      // Cập nhật UI danh sách thành viên
      break;
  }
}

function handleRoomEvent(event: WsEvent) {
  if (event.type === 'chat_message') {
    setChatMessages(prev => [...prev, event.payload as ChatMessageDto]);
  }
}
```

### 5.4 Nộp câu trả lời

```typescript
async function handleSubmitAnswer(body: SubmitAnswerRequest) {
  if (!session || !activeQuestion || myAnswer) return;
  try {
    const res = await answerService.submit(session.sessionId, activeQuestion.id, body);
    setMyAnswer(res.data!);
    // Disable form — không cho nộp lần 2
  } catch (err: unknown) {
    const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
    if (code === 'ALREADY_ANSWERED') {
      // Đã nộp rồi, disable form
    }
  }
}
```

---

## Phần 6 — Tích hợp TeacherDashboardPage

### 6.1 Xóa mock, dùng API thực

```typescript
useEffect(() => {
  // sessionId từ params
  dashboardService.getTeacherDashboard(sessionId!).then(res => {
    setDashboard(res.data!);
    setLoading(false);
  }).catch(err => {
    const code = err?.response?.data?.error?.code;
    if (code === 'SESSION_NOT_ENDED') {
      // Thử lại sau 1.5s (server tính async)
      setTimeout(() => fetchDashboard(), 1500);
    }
  });
}, [sessionId]);
```

### 6.2 Mapping data thực sang chart data

`DashboardResponse.questions` → BarChart data (dùng `questionOrder` làm label).
`DashboardResponse.students` → Table data (đã sorted `scorePercent DESC`).
`DashboardResponse.overallStats.avgScorePercent` → Progress circle tổng quan.

---

## Phần 7 — Tích hợp StudentReviewPage

```typescript
useEffect(() => {
  dashboardService.getStudentReview(sessionId!).then(res => {
    setReview(res.data!);
    setLoading(false);
  });
}, [sessionId]);
```

Mapping `ReviewResponse.questions` sang UI:
- `result === 'correct'` → border-left emerald
- `result === 'wrong'` → border-left rose
- `result === 'skipped'` → border-left slate
- `result === 'pending_review'` → border-left amber, text "Chờ chấm"

---

## Phần 8 — Routing mới (Admin)

Thêm vào `App.tsx`:

```typescript
import AdminPage from './pages/admin/AdminPage';

// Trong ProtectedRoute (sau khi xác thực role admin)
<Route path="/admin" element={<AdminPage />} />
```

### 8.1 Tạo `src/pages/admin/AdminPage.tsx`

Dùng `AppLayout`. Tabs: "Tổng quan" (AdminStatsDto) + "Người dùng" (GET /users) + "Lớp học" (GET /admin/classrooms).

---

## Phần 9 — Thứ tự thực hiện

### Sprint 1 — Foundation (2–3 ngày)

1. **Thêm types** vào `src/types/api.ts` (Phần 1)
2. **Tạo services**: session, question, answer, breakout, chat, dashboard, admin (Phần 2)
3. **Tạo WebSocket layer** `src/lib/websocket.ts` (Phần 3)
4. **Cài dependencies**: `npm install @stomp/stompjs sockjs-client`

### Sprint 2 — Teacher Flow (3–4 ngày)

5. **TeacherSessionPage**: thay mock → API (Phần 4)
   - Gọi `sessionService.start` khi vào trang
   - Kết nối WS với ticket nhận được
   - Xử lý tất cả WS events
   - Tạo/bắt đầu/kết thúc câu hỏi qua API
   - Kết thúc session → navigate dashboard
6. **TeacherDashboardPage**: thay mock → API (Phần 6)

### Sprint 3 — Student Flow (3–4 ngày)

7. **StudentSessionPage**: thay mock → API (Phần 5)
   - Gọi `sessionService.join`
   - Kết nối WS, lắng nghe `question_started`
   - Hiển thị câu hỏi + nộp đáp án
   - Breakout room flow
8. **StudentReviewPage**: thay mock → API (Phần 7)

### Sprint 4 — Breakout + Chat + Admin (2–3 ngày)

9. **BreakoutPanel**: tích hợp `breakoutService.create/end/broadcast/joinRoom/leaveRoom`
10. **ChatPanel**: tích hợp `chatService.getHistory` + WS `sendChat`
11. **AdminPage**: tạo mới, gọi `adminService.getStats/listClassrooms/listUsers` (Phần 8)

---

## Phần 10 — Lưu ý kỹ thuật quan trọng

### WebSocket Ticket
- Ticket **dùng 1 lần**, TTL **60 giây** — phải kết nối ngay sau khi nhận
- **Không lưu vào localStorage** — chỉ lưu trong state/ref
- Khi mất kết nối: gọi lại API join để lấy ticket mới

### Đồng hồ đếm ngược
- Dùng `endsAt` từ server, **không dùng** `timerSeconds + Date.now()`
- `endsAt` là null nếu câu hỏi không có timer

### Submit answer
- Sau khi nộp thành công: disable toàn bộ UI nhập liệu
- Server trả `409 ALREADY_ANSWERED` nếu nộp lần 2

### Dashboard timing
- Gọi `GET /sessions/{id}/dashboard` sau khi `POST /sessions/{id}/end` trả về
- Server tính async, thường < 1s — nếu nhận `SESSION_NOT_ENDED` thì retry sau 1.5s

### Error handling cần xử lý
| Code | Xử lý |
|------|-------|
| `SESSION_ALREADY_ACTIVE` | Thông báo + điều hướng đến session đang chạy |
| `QUESTION_ALREADY_RUNNING` | Disable nút start, chờ câu hiện tại kết thúc |
| `ALREADY_ANSWERED` | Disable form |
| `QUESTION_NOT_RUNNING` | Hiển thị "Câu hỏi đã kết thúc" |
| `BREAKOUT_ALREADY_ACTIVE` | Kết thúc breakout cũ trước |
| `SESSION_NOT_ENDED` | Retry sau 1.5s (dashboard) |

### Cleanup
- `useEffect` return phải gọi `wsRef.current?.disconnect()`
- Student: gọi `sessionService.leave` trước khi disconnect

---

## Phần 11 — Kiểm tra sau tích hợp

### Teacher flow checklist
- [ ] Vào trang `/session/teacher/:classroomId` → session được tạo tự động
- [ ] WS kết nối thành công (không lỗi 401/403)
- [ ] Tạo câu hỏi MCQ single/multiple và essay
- [ ] Bắt đầu câu hỏi → HS thấy ngay (qua WS)
- [ ] Live chart cập nhật khi HS trả lời
- [ ] Silent student alert hiển thị đúng tên
- [ ] Timer đếm ngược theo `endsAt` server
- [ ] Câu hỏi tự kết thúc khi hết giờ
- [ ] Kết thúc session → navigate `/dashboard/:sessionId`
- [ ] Dashboard hiển thị đúng số liệu thực

### Student flow checklist
- [ ] Vào trang `/session/student/:sessionId` → join thành công
- [ ] WS kết nối, nhận `question_started`
- [ ] Floating panel hiển thị câu hỏi + countdown từ `endsAt`
- [ ] Nộp đáp án → form bị disable
- [ ] Breakout: nhận `breakout_started` → subscribe phòng của mình
- [ ] Chat trong phòng nhỏ hoạt động
- [ ] Rời lớp → navigate `/review/:sessionId`
- [ ] Review hiển thị đúng/sai theo `result`

---

*Tài liệu cập nhật lần cuối: Phase 3 (M09–M11) + Phase 4 (M12–M16). Tất cả type và service được thiết kế nhất quán với codebase Phase 1–2 hiện có.*
