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
  teacher: { id: string; name: string; avatarColor: string | null };
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
  author: { id: string; name: string; role: string; avatarColor: string | null };
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
