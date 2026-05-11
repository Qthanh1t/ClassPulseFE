import api from '../lib/api';
import type {
  ApiResponse,
  BreakoutSessionDto,
  CreateBreakoutRequest,
  BreakoutEndResponse,
  BroadcastRequest,
  BroadcastResponse,
  JoinRoomResponse,
} from '../types/api';

const breakoutService = {
  create: (sessionId: string, body: CreateBreakoutRequest) =>
    api
      .post<ApiResponse<BreakoutSessionDto>>(`/sessions/${sessionId}/breakouts`, body)
      .then((r) => r.data),

  getActive: (sessionId: string) =>
    api
      .get<ApiResponse<BreakoutSessionDto | null>>(`/sessions/${sessionId}/breakouts/active`)
      .then((r) => r.data),

  end: (sessionId: string, breakoutId: string) =>
    api
      .post<ApiResponse<BreakoutEndResponse>>(`/sessions/${sessionId}/breakouts/${breakoutId}/end`)
      .then((r) => r.data),

  broadcast: (sessionId: string, breakoutId: string, body: BroadcastRequest) =>
    api
      .post<ApiResponse<BroadcastResponse>>(
        `/sessions/${sessionId}/breakouts/${breakoutId}/broadcast`,
        body,
      )
      .then((r) => r.data),

  joinRoom: (sessionId: string, breakoutId: string, roomId: string) =>
    api
      .post<ApiResponse<JoinRoomResponse>>(
        `/sessions/${sessionId}/breakouts/${breakoutId}/rooms/${roomId}/join`,
      )
      .then((r) => r.data),

  leaveRoom: (sessionId: string, breakoutId: string, roomId: string) =>
    api
      .post<ApiResponse<void>>(
        `/sessions/${sessionId}/breakouts/${breakoutId}/rooms/${roomId}/leave`,
      )
      .then((r) => r.data),
};

export default breakoutService;
