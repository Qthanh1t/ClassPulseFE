import api from '../lib/api';
import type {
  ApiResponse,
  AdminStatsDto,
  AdminClassroomDto,
  UserDto,
  UpdateUserRequest,
  PageMeta,
} from '../types/api';

const adminService = {
  getStats: () =>
    api.get<ApiResponse<AdminStatsDto>>('/admin/stats').then((r) => r.data),

  listClassrooms: (params: { search?: string; page?: number; limit?: number } = {}) =>
    api
      .get<ApiResponse<AdminClassroomDto[]> & { meta: PageMeta }>('/admin/classrooms', { params })
      .then((r) => r.data),

  listUsers: (params: { role?: string; search?: string; page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<UserDto[]>>('/users', { params }).then((r) => r.data),

  updateUser: (userId: string, body: UpdateUserRequest) =>
    api.put<ApiResponse<UserDto>>(`/users/${userId}`, body).then((r) => r.data),
};

export default adminService;
