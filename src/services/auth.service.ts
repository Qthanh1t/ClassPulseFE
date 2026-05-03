import api from '../lib/api';
import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest, WsTicketResponse } from '../types/api';

export const authService = {
  login: (body: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', body, { withCredentials: true })
      .then((r) => r.data.data!),

  register: (body: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', body, { withCredentials: true })
      .then((r) => r.data.data!),

  refresh: () =>
    api.post<ApiResponse<AuthResponse>>('/auth/refresh', {}, { withCredentials: true })
      .then((r) => r.data.data!),

  logout: () =>
    api.post('/auth/logout', {}, { withCredentials: true }),

  getWsTicket: () =>
    api.post<ApiResponse<WsTicketResponse>>('/auth/ws-ticket')
      .then((r) => r.data.data!),
};
