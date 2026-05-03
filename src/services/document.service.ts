import api from '../lib/api';
import type { ApiResponse, DocumentDto, PageMeta } from '../types/api';

export const documentService = {
  list: (classroomId: string, params?: { source?: 'direct' | 'post'; page?: number; limit?: number }) =>
    api.get<ApiResponse<DocumentDto[]>>(`/classrooms/${classroomId}/documents`, { params })
      .then((r) => ({ documents: r.data.data ?? [], meta: r.data.meta as PageMeta })),

  upload: (classroomId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post<ApiResponse<DocumentDto[]>>(
      `/classrooms/${classroomId}/documents`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data.data ?? []);
  },

  remove: (classroomId: string, documentId: string) =>
    api.delete(`/classrooms/${classroomId}/documents/${documentId}`),
};
