import api from '../lib/api';
import type { ApiResponse, ScheduleDto, CreateScheduleRequest, UpdateScheduleRequest } from '../types/api';

export const scheduleService = {
  list: (classroomId: string, params?: { from?: string; to?: string }) =>
    api.get<ApiResponse<ScheduleDto[]>>(`/classrooms/${classroomId}/schedules`, { params })
      .then((r) => r.data.data ?? []),

  create: (classroomId: string, body: CreateScheduleRequest) =>
    api.post<ApiResponse<ScheduleDto>>(`/classrooms/${classroomId}/schedules`, body)
      .then((r) => r.data.data!),

  update: (classroomId: string, scheduleId: string, body: UpdateScheduleRequest) =>
    api.put<ApiResponse<ScheduleDto>>(`/classrooms/${classroomId}/schedules/${scheduleId}`, body)
      .then((r) => r.data.data!),

  remove: (classroomId: string, scheduleId: string) =>
    api.delete(`/classrooms/${classroomId}/schedules/${scheduleId}`),
};
