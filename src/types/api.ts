// ── API Response Envelope ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PageMeta;
  error?: { code: string; message: string };
}

export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ── Auth ───────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  avatarColor: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: UserSummary;
  accessToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'teacher' | 'student';
}

// ── User ───────────────────────────────────────────────────────────

export interface UserDto extends UserSummary {
  isActive?: boolean;
  stats?: {
    classroomsCount: number;
    sessionsCount: number;
    questionsAsked: number;
    studentsReached: number;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  avatarColor?: string;
}

// ── Classroom ──────────────────────────────────────────────────────

export interface ClassroomDto {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  joinCode: string;
  teacher: { id: string; name: string; avatarColor: string | null; avatarUrl: string | null };
  studentCount: number;
  nextSchedule: {
    id: string;
    title: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
  } | null;
  isArchived: boolean;
  createdAt: string;
}

export interface CreateClassroomRequest {
  name: string;
  description?: string;
  subject?: string;
}

export interface UpdateClassroomRequest {
  name?: string;
  description?: string;
  subject?: string;
  isArchived?: boolean;
}

export interface MemberDto {
  id: string;
  name: string;
  avatarColor: string | null;
  avatarUrl: string | null;
  role: 'teacher' | 'student';
  joinedAt: string;
}

export interface JoinClassroomResponse {
  classroomId: string;
  classroomName: string;
  joinedAt: string;
}

// ── Post ───────────────────────────────────────────────────────────

export interface AttachmentDto {
  id: string;
  fileName: string;
  fileExt: string;
  fileSizeBytes: number;
  url: string;
  uploadedAt: string;
}

export interface PostDto {
  id: string;
  author: { id: string; name: string; role: string; avatarColor: string | null; avatarUrl: string | null };
  content: string;
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostRequest {
  content: string;
}

// ── Schedule ───────────────────────────────────────────────────────

export interface ScheduleDto {
  id: string;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  description: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export interface UpdateScheduleRequest {
  title?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

// ── Document ───────────────────────────────────────────────────────

export interface DocumentDto {
  id: string;
  fileName: string;
  fileExt: string;
  fileSizeBytes: number;
  url: string;
  source: 'direct' | 'post';
  postId: string | null;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

// ── Upload ─────────────────────────────────────────────────────────

export type UploadPurpose = 'post_attachment' | 'classroom_document' | 'avatar';

export interface PresignRequest {
  purpose: UploadPurpose;
  files: { fileName: string; contentType: string; fileSizeBytes: number }[];
}

export interface PresignedUrlDto {
  fileName: string;
  fileKey: string;
  uploadUrl: string;
  expiresAt: string;
}

// ── WebSocket Ticket ───────────────────────────────────────────────

export interface WsTicketResponse {
  ticket: string;
}

// ── Session (M09) ──────────────────────────────────────────────────

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
  wsTicket?: string;
}

export interface SessionDetailDto {
  id: string;
  classroomId: string;
  classroomName: string;
  scheduleId?: string;
  scheduleTitle?: string;
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
  teacherId: string;
  teacherAvatarColor?: string | null;
  teacherAvatarUrl?: string | null;
  wsTicket: string;
}

export interface SessionEndResponse {
  sessionId: string;
  endedAt: string;
  duration: number;
  questionCount: number;
  studentCount: number;
}

export interface PresenceDto {
  studentId: string;
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  joinedAt: string;
  isOnline: boolean;
}

export interface StartSessionRequest {
  scheduleId?: string;
}

// ── Question (M10) ─────────────────────────────────────────────────

export type QuestionType = 'single' | 'multiple' | 'essay';
export type QuestionStatus = 'draft' | 'running' | 'ended';

export interface OptionDto {
  id: string;
  label: string;
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
  endsAt?: string;
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
  options?: CreateOptionRequest[];
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
    avatarUrl?: string;
  }[];
}

// ── Student Answer (M11) ───────────────────────────────────────────

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
  isCorrect?: boolean;
  answeredAt: string;
}

// ── Breakout (M12) ─────────────────────────────────────────────────

export interface RoomStudentInfo {
  id: string;
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
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

// ── Chat (M13) ─────────────────────────────────────────────────────

export interface ChatMessageDto {
  id: string;
  sender: {
    id: string;
    name: string;
    role: 'teacher' | 'student';
    avatarColor?: string;
    avatarUrl?: string;
  };
  content: string;
  breakoutRoomId?: string;
  sentAt: string;
}

export interface ChatCursorMeta {
  hasMore: boolean;
  oldestId?: string;
}

// ── Dashboard (M14) ────────────────────────────────────────────────

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
  avatarUrl?: string;
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

// ── Student Review (M15) ───────────────────────────────────────────

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

// ── Admin (M16) ────────────────────────────────────────────────────

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
  teacher: { id: string; name: string; avatarColor: string | null; avatarUrl: string | null };
  studentCount: number;
  createdAt: string;
  archived: boolean;
}

export interface UpdateUserRequest {
  isActive?: boolean;
  role?: 'teacher' | 'student' | 'admin';
}
