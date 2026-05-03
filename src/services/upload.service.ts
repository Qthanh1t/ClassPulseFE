import axios from 'axios';
import api from '../lib/api';
import type { ApiResponse, PresignRequest, PresignedUrlDto, UploadPurpose } from '../types/api';

export const uploadService = {
  presign: (body: PresignRequest) =>
    api.post<ApiResponse<PresignedUrlDto[]>>('/uploads/presign', body)
      .then((r) => r.data.data ?? []),

  // Upload a single file directly to MinIO via presigned URL (no Bearer token)
  putToMinIO: (uploadUrl: string, file: File) =>
    axios.put(uploadUrl, file, {
      headers: { 'Content-Type': file.type },
    }),

  // Convenience: presign + upload in one call
  uploadFile: async (file: File, purpose: UploadPurpose) => {
    const [presigned] = await uploadService.presign({
      purpose,
      files: [{ fileName: file.name, contentType: file.type, fileSizeBytes: file.size }],
    });
    await uploadService.putToMinIO(presigned.uploadUrl, file);
    return presigned.fileKey;
  },
};
