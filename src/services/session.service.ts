import api from '../lib/api';
import type {
  ApiResponse,
  SessionDto,
  SessionDetailDto,
  SessionEndResponse,
  JoinSessionResponse,
  PresenceDto,
  StartSessionRequest,
} from '../types/api';

const sessionService = {
  start: (classroomId: string, body: StartSessionRequest = {}) =>
    api.post<ApiResponse<SessionDto>>(`/classrooms/${classroomId}/sessions`, body).then((r) => r.data),

  listByClassroom: (classroomId: string, page = 1, limit = 20) =>
    api
      .get<ApiResponse<SessionDto[]>>(`/classrooms/${classroomId}/sessions`, { params: { page, limit } })
      .then((r) => r.data),

  get: (sessionId: string) =>
    api.get<ApiResponse<SessionDetailDto>>(`/sessions/${sessionId}`).then((r) => r.data),

  end: (sessionId: string) =>
    api.post<ApiResponse<SessionEndResponse>>(`/sessions/${sessionId}/end`).then((r) => r.data),

  join: (sessionId: string) =>
    api.post<ApiResponse<JoinSessionResponse>>(`/sessions/${sessionId}/join`).then((r) => r.data),

  leave: (sessionId: string) =>
    api.post<ApiResponse<void>>(`/sessions/${sessionId}/leave`).then((r) => r.data),

  getPresence: (sessionId: string) =>
    api.get<ApiResponse<PresenceDto[]>>(`/sessions/${sessionId}/presence`).then((r) => r.data),
};

export default sessionService;
