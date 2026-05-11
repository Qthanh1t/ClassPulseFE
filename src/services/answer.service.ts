import api from '../lib/api';
import type { ApiResponse, SubmitAnswerRequest, StudentAnswerDto } from '../types/api';

const answerService = {
  submit: (sessionId: string, questionId: string, body: SubmitAnswerRequest) =>
    api
      .post<ApiResponse<StudentAnswerDto>>(
        `/sessions/${sessionId}/questions/${questionId}/answers`,
        body,
      )
      .then((r) => r.data),

  list: (sessionId: string, questionId: string) =>
    api
      .get<ApiResponse<StudentAnswerDto[]>>(`/sessions/${sessionId}/questions/${questionId}/answers`)
      .then((r) => r.data),
};

export default answerService;
