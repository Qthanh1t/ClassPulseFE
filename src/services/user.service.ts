import api from '../lib/api';
import type { ApiResponse, UserDto, UpdateProfileRequest } from '../types/api';

export const userService = {
  getMe: () =>
    api.get<ApiResponse<UserDto>>('/users/me')
      .then((r) => r.data.data!),

  updateMe: (body: UpdateProfileRequest) =>
    api.put<ApiResponse<UserDto>>('/users/me', body)
      .then((r) => r.data.data!),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ApiResponse<{ avatarUrl: string }>>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data!);
  },
};
