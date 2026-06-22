import api from '../lib/api';
import type { ApiResponse, LiveKitTokenResponse } from '../types/api';

export const livekitService = {
  /**
   * Lấy LiveKit access token cho phiên học.
   * @param roomName mặc định backend dùng `session-{id}`; truyền `session-{id}-room-{roomId}` cho breakout.
   */
  getToken: (sessionId: string, roomName?: string) =>
    api
      .post<ApiResponse<LiveKitTokenResponse>>(
        `/sessions/${sessionId}/livekit-token`,
        null,
        { params: roomName ? { roomName } : undefined },
      )
      .then((r) => r.data.data!),
};

export default livekitService;
