import api from '../lib/api';
import type { ApiResponse, ChatMessageDto, ChatCursorMeta } from '../types/api';

const chatService = {
  getHistory: (sessionId: string, limit = 50, before?: string) =>
    api
      .get<ApiResponse<ChatMessageDto[]> & { meta: ChatCursorMeta }>(`/sessions/${sessionId}/chat`, {
        params: { limit, ...(before ? { before } : {}) },
      })
      .then((r) => r.data),
};

export default chatService;
