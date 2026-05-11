import api from '../lib/api';
import type {
  ApiResponse,
  QuestionDto,
  CreateQuestionRequest,
  QuestionStartResponse,
  QuestionEndResponse,
  QuestionStatsDto,
} from '../types/api';

const questionService = {
  list: (sessionId: string) =>
    api.get<ApiResponse<QuestionDto[]>>(`/sessions/${sessionId}/questions`).then((r) => r.data),

  create: (sessionId: string, body: CreateQuestionRequest) =>
    api.post<ApiResponse<QuestionDto>>(`/sessions/${sessionId}/questions`, body).then((r) => r.data),

  start: (sessionId: string, questionId: string) =>
    api
      .post<ApiResponse<QuestionStartResponse>>(`/sessions/${sessionId}/questions/${questionId}/start`)
      .then((r) => r.data),

  end: (sessionId: string, questionId: string) =>
    api
      .post<ApiResponse<QuestionEndResponse>>(`/sessions/${sessionId}/questions/${questionId}/end`)
      .then((r) => r.data),

  getStats: (sessionId: string, questionId: string) =>
    api
      .get<ApiResponse<QuestionStatsDto>>(`/sessions/${sessionId}/questions/${questionId}/stats`)
      .then((r) => r.data),
};

export default questionService;
