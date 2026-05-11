import api from '../lib/api';
import type { ApiResponse, DashboardResponse, ReviewResponse } from '../types/api';

const dashboardService = {
  getTeacherDashboard: (sessionId: string) =>
    api.get<ApiResponse<DashboardResponse>>(`/sessions/${sessionId}/dashboard`).then((r) => r.data),

  getStudentReview: (sessionId: string) =>
    api.get<ApiResponse<ReviewResponse>>(`/sessions/${sessionId}/review`).then((r) => r.data),
};

export default dashboardService;
