import api from '../lib/api';
import type {
  ApiResponse, ClassroomDto, CreateClassroomRequest, UpdateClassroomRequest,
  MemberDto, JoinClassroomResponse,
} from '../types/api';

export const classroomService = {
  list: () =>
    api.get<ApiResponse<ClassroomDto[]>>('/classrooms')
      .then((r) => r.data.data ?? []),

  get: (id: string) =>
    api.get<ApiResponse<ClassroomDto>>(`/classrooms/${id}`)
      .then((r) => r.data.data!),

  create: (body: CreateClassroomRequest) =>
    api.post<ApiResponse<ClassroomDto>>('/classrooms', body)
      .then((r) => r.data.data!),

  update: (id: string, body: UpdateClassroomRequest) =>
    api.put<ApiResponse<ClassroomDto>>(`/classrooms/${id}`, body)
      .then((r) => r.data.data!),

  remove: (id: string) =>
    api.delete(`/classrooms/${id}`),

  join: (joinCode: string) =>
    api.post<ApiResponse<JoinClassroomResponse>>('/classrooms/join', { joinCode })
      .then((r) => r.data.data!),

  getMembers: (id: string) =>
    api.get<ApiResponse<MemberDto[]>>(`/classrooms/${id}/members`)
      .then((r) => r.data.data ?? []),

  kickMember: (classroomId: string, studentId: string) =>
    api.delete(`/classrooms/${classroomId}/members/${studentId}`),

  regenerateJoinCode: (id: string) =>
    api.post<ApiResponse<{ joinCode: string }>>(`/classrooms/${id}/join-code/regenerate`)
      .then((r) => r.data.data!),
};
