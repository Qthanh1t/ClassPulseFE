import api from '../lib/api';
import type { ApiResponse, PostDto, CreatePostRequest, AttachmentDto, PageMeta } from '../types/api';

export const postService = {
  list: (classroomId: string, page = 1, limit = 20) =>
    api.get<ApiResponse<PostDto[]>>(`/classrooms/${classroomId}/posts`, {
      params: { page, limit },
    }).then((r) => ({ posts: r.data.data ?? [], meta: r.data.meta as PageMeta })),

  create: (classroomId: string, body: CreatePostRequest) =>
    api.post<ApiResponse<PostDto>>(`/classrooms/${classroomId}/posts`, body)
      .then((r) => r.data.data!),

  update: (classroomId: string, postId: string, body: CreatePostRequest) =>
    api.put<ApiResponse<PostDto>>(`/classrooms/${classroomId}/posts/${postId}`, body)
      .then((r) => r.data.data!),

  remove: (classroomId: string, postId: string) =>
    api.delete(`/classrooms/${classroomId}/posts/${postId}`),

  addAttachments: (classroomId: string, postId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return api.post<ApiResponse<AttachmentDto[]>>(
      `/classrooms/${classroomId}/posts/${postId}/attachments`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data.data ?? []);
  },

  removeAttachment: (classroomId: string, postId: string, attachmentId: string) =>
    api.delete(`/classrooms/${classroomId}/posts/${postId}/attachments/${attachmentId}`),
};
