# ClassPulse — Frontend Integration Guide (Phase 1–2)

> Tài liệu này mô tả tất cả REST API đã hoàn thành (M01–M08) để frontend có thể tích hợp.
> Base URL: `http://localhost:8080/api/v1` (dev) | Swagger UI: `http://localhost:8080/swagger-ui.html`

---

## Mục lục

1. [Conventions](#1-conventions)
2. [Auth & Token Management](#2-auth--token-management)
3. [Error Handling](#3-error-handling)
4. [Pagination](#4-pagination)
5. [Auth Endpoints](#5-auth-endpoints)
6. [User Endpoints](#6-user-endpoints)
7. [Classroom Endpoints](#7-classroom-endpoints)
8. [Post Endpoints](#8-post-endpoints)
9. [Schedule Endpoints](#9-schedule-endpoints)
10. [Document Endpoints](#10-document-endpoints)
11. [Upload (Presigned URL)](#11-upload-presigned-url)
12. [WebSocket Ticket](#12-websocket-ticket)

---

## 1. Conventions

### Request Headers

```
Content-Type: application/json          # Mọi request có body JSON
Authorization: Bearer <accessToken>     # Mọi endpoint [AUTH] trở lên
```

### Response Envelope

Mọi response đều bọc trong:

```json
// Success
{
  "success": true,
  "data": { ... },      // null nếu không có data
  "meta": { ... }       // chỉ có khi paginated
}

// Error
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Auth Levels

| Level | Điều kiện |
|-------|-----------|
| `[PUBLIC]` | Không cần token |
| `[AUTH]` | Cần `Authorization: Bearer <token>` |
| `[TEACHER]` | `[AUTH]` + role = `teacher` |
| `[STUDENT]` | `[AUTH]` + role = `student` |
| `[MEMBER]` | `[AUTH]` + là thành viên lớp (teacher hoặc student đã join) |
| `[OWNER]` | `[AUTH]` + là teacher chủ lớp |
| `[ADMIN]` | `[AUTH]` + role = `admin` |

### UUID & Timestamps

- Mọi ID đều là **UUID v4** dạng string: `"550e8400-e29b-41d4-a716-446655440000"`
- Timestamps là **ISO 8601 UTC**: `"2025-05-01T08:30:00Z"`
- Ngày: `"2025-05-15"` (YYYY-MM-DD)
- Giờ: `"09:00"` (HH:mm, 24h)

---

## 2. Auth & Token Management

### Access Token

- JWT, thời hạn **15 phút**
- Lưu trong **memory (React state / Zustand)** — **KHÔNG lưu localStorage**
- Gửi qua header: `Authorization: Bearer <accessToken>`

### Refresh Token

- Thời hạn **30 ngày**
- Server tự set qua **httpOnly cookie** `refresh_token`
- Path cookie: `/api/v1/auth` — tự động gửi khi gọi `/refresh` hay `/logout`
- Frontend **không thể đọc** cookie này (httpOnly)

### Token Flow

```
1. login/register → nhận accessToken + server set cookie refresh_token
2. Khi accessToken hết hạn (401) → gọi POST /auth/refresh
   → server đọc cookie refresh_token, trả accessToken mới
3. logout → gọi POST /auth/logout → server xóa cookie
```

### Interceptor gợi ý (Axios)

```typescript
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

axios.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise(resolve =>
          queue.push(token => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(axios(original));
          })
        );
      }
      isRefreshing = true;
      const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
      const newToken = data.data.accessToken;
      setAccessToken(newToken); // cập nhật store
      queue.forEach(cb => cb(newToken));
      queue = [];
      isRefreshing = false;
      original.headers.Authorization = `Bearer ${newToken}`;
      return axios(original);
    }
    return Promise.reject(err);
  }
);
```

> **Lưu ý:** Mọi request cần cookie phải có `withCredentials: true` (Axios) hoặc `credentials: 'include'` (fetch).
> Chỉ cần cho `/auth/refresh` và `/auth/logout`.

---

## 3. Error Handling

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| `200` | OK |
| `201` | Created |
| `204` | No Content (DELETE thành công) |
| `400` | Validation error |
| `401` | Chưa auth hoặc token hết hạn |
| `403` | Không có quyền |
| `404` | Không tìm thấy |
| `409` | Conflict (trùng email, đã là thành viên...) |
| `500` | Server error |

### Error Codes thường gặp

| Code | Endpoint | Ý nghĩa |
|------|----------|---------|
| `EMAIL_TAKEN` | register | Email đã đăng ký |
| `MISSING_REFRESH_TOKEN` | refresh | Không có cookie |
| `INVALID_REFRESH_TOKEN` | refresh | Token hết hạn / đã dùng |
| `CLASSROOM_NOT_FOUND` | classroom | Lớp không tồn tại |
| `ALREADY_MEMBER` | join | Đã là thành viên |
| `JOIN_CODE_NOT_FOUND` | join | Mã lớp sai |
| `CANNOT_DELETE_POST_ATTACHMENT` | document delete | Chỉ xóa được direct upload |

### Validation Error (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email: Email is invalid; password: Password must be 8–100 characters"
  }
}
```

---

## 4. Pagination

Các endpoint paginated nhận query params:

| Param | Default | Mô tả |
|-------|---------|-------|
| `page` | `1` | Trang hiện tại (bắt đầu từ 1) |
| `limit` | `20` | Số item mỗi trang |

Response có thêm `meta`:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "size": 20,
    "totalElements": 57,
    "totalPages": 3
  }
}
```

---

## 5. Auth Endpoints

### POST `/auth/register` [PUBLIC]

Tạo tài khoản mới.

**Request:**
```json
{
  "email": "teacher@example.com",
  "password": "password123",
  "name": "Nguyễn Văn A",
  "role": "teacher"         // "teacher" | "student"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "teacher@example.com",
      "name": "Nguyễn Văn A",
      "role": "teacher",
      "avatarColor": null,
      "avatarUrl": null,
      "createdAt": "2025-05-01T08:00:00Z"
    },
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```
Server cũng set httpOnly cookie `refresh_token`.

---

### POST `/auth/login` [PUBLIC]

**Request:**
```json
{
  "email": "teacher@example.com",
  "password": "password123"
}
```

**Response 200:** Giống register.

---

### POST `/auth/refresh` [PUBLIC]

Dùng cookie `refresh_token` để lấy access token mới. Không cần body.

```
// Yêu cầu: withCredentials: true
POST /api/v1/auth/refresh
```

**Response 200:** Giống login (trả `accessToken` mới, set cookie mới).

---

### POST `/auth/logout` [PUBLIC]

```
// Yêu cầu: withCredentials: true
POST /api/v1/auth/logout
```

**Response 200:**
```json
{ "success": true }
```
Server clear cookie `refresh_token`.

---

## 6. User Endpoints

### GET `/users/me` [AUTH]

Lấy thông tin user hiện tại kèm stats.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "teacher@example.com",
    "name": "Nguyễn Văn A",
    "role": "teacher",
    "avatarColor": "#6366f1",
    "avatarUrl": "http://minio/avatars/uuid.jpg",
    "createdAt": "2025-05-01T08:00:00Z",
    "stats": {
      "classroomsCount": 3,
      "sessionsCount": 12,
      "questionsAsked": 0,
      "studentsReached": 45
    }
  }
}
```

> `stats.questionsAsked` và `studentsReached` sẽ có dữ liệu sau khi M09–M10 hoàn thành.

---

### PUT `/users/me` [AUTH]

Cập nhật tên và màu avatar.

**Request:**
```json
{
  "name": "Nguyễn Văn B",
  "avatarColor": "#6366f1"   // optional, hex color (#RRGGBB)
}
```

**Response 200:** `data` là `UserDto` đã cập nhật.

---

### POST `/users/me/avatar` [AUTH]

Upload ảnh avatar. Dùng `multipart/form-data`.

```
POST /api/v1/users/me/avatar
Content-Type: multipart/form-data

file: <binary>   // jpg | png | webp, tối đa 5MB
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "http://minio:9000/classpulse/avatars/uuid.jpg"
  }
}
```

---

### GET `/users` [ADMIN]

Danh sách tất cả users, có filter.

**Query params:**

| Param | Mô tả |
|-------|-------|
| `page` | Trang (default 1) |
| `limit` | Số item (default 20) |
| `role` | `teacher` \| `student` \| `admin` |
| `search` | Tìm theo email hoặc name |

**Response 200:** Paginated list `UserDto`.

---

### PUT `/users/:userId` [ADMIN]

Admin cập nhật role hoặc ban/unban user.

**Request:**
```json
{
  "isActive": false,      // optional
  "role": "teacher"       // optional: "teacher" | "student" | "admin"
}
```

**Response 200:** `UserDto` đã cập nhật.

---

## 7. Classroom Endpoints

### GET `/classrooms` [AUTH]

Danh sách lớp của user hiện tại:
- Teacher: các lớp mình tạo
- Student: các lớp đã join

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Toán 10A",
      "description": "Lớp toán nâng cao",
      "subject": "Toán",
      "joinCode": "ABC123",
      "teacher": {
        "id": "uuid",
        "name": "Nguyễn Văn A",
        "avatarColor": "#6366f1"
      },
      "studentCount": 28,
      "nextSchedule": {                 // null nếu không có lịch sắp tới
        "id": "uuid",
        "title": "Buổi học tuần 1",
        "scheduledDate": "2025-05-10",
        "startTime": "08:00",
        "endTime": "10:00"
      },
      "isArchived": false,
      "createdAt": "2025-05-01T08:00:00Z"
    }
  ]
}
```

---

### POST `/classrooms` [TEACHER]

Tạo lớp học mới.

**Request:**
```json
{
  "name": "Toán 10A",
  "description": "Lớp toán nâng cao",   // optional
  "subject": "Toán"                       // optional
}
```

**Response 201:** `ClassroomDto`.

---

### GET `/classrooms/:classroomId` [MEMBER]

**Response 200:** `ClassroomDto` đầy đủ (kèm `joinCode`).

---

### PUT `/classrooms/:classroomId` [OWNER]

**Request:**
```json
{
  "name": "Toán 10A (cập nhật)",
  "description": "...",
  "subject": "Toán",
  "isArchived": false     // optional: set true để archive
}
```

**Response 200:** `ClassroomDto`.

---

### DELETE `/classrooms/:classroomId` [OWNER]

Soft delete (archive). **Response 204.**

---

### POST `/classrooms/join` [STUDENT]

Student tham gia lớp bằng mã.

**Request:**
```json
{
  "joinCode": "ABC123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "classroomId": "uuid",
    "classroomName": "Toán 10A",
    "joinedAt": "2025-05-01T09:00:00Z"
  }
}
```

---

### GET `/classrooms/:classroomId/members` [MEMBER]

Danh sách thành viên.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Trần Thị B",
      "avatarColor": "#f43f5e",
      "role": "student",
      "joinedAt": "2025-05-01T09:00:00Z"
    }
  ]
}
```

---

### DELETE `/classrooms/:classroomId/members/:studentId` [OWNER]

Kick thành viên. **Response 204.**

---

### POST `/classrooms/:classroomId/join-code/regenerate` [OWNER]

Tạo mã tham gia mới.

**Response 200:**
```json
{
  "success": true,
  "data": { "joinCode": "XYZ789" }
}
```

---

## 8. Post Endpoints

Base path: `/classrooms/:classroomId/posts`

### GET `/classrooms/:classroomId/posts` [MEMBER]

Danh sách bài post, sắp xếp mới nhất trước.

**Query:** `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "author": {
        "id": "uuid",
        "name": "Nguyễn Văn A",
        "role": "teacher",
        "avatarColor": "#6366f1"
      },
      "content": "Nội dung bài post...",
      "attachments": [
        {
          "id": "uuid",
          "fileName": "slide.pdf",
          "fileExt": "pdf",
          "fileSizeBytes": 2048000,
          "url": "http://minio:9000/classpulse/post-attachments/...",
          "uploadedAt": "2025-05-01T08:00:00Z"
        }
      ],
      "createdAt": "2025-05-01T08:00:00Z",
      "updatedAt": "2025-05-01T08:05:00Z"
    }
  ],
  "meta": { "page": 1, "size": 20, "totalElements": 5, "totalPages": 1 }
}
```

---

### POST `/classrooms/:classroomId/posts` [MEMBER]

**Request:**
```json
{
  "content": "Nội dung bài post..."
}
```

**Response 201:** `PostDto`.

---

### PUT `/classrooms/:classroomId/posts/:postId` [MEMBER]

Chỉ author hoặc teacher mới được sửa.

**Request:**
```json
{
  "content": "Nội dung đã cập nhật..."
}
```

**Response 200:** `PostDto`.

---

### DELETE `/classrooms/:classroomId/posts/:postId` [MEMBER]

Chỉ author hoặc teacher mới được xóa. **Response 204.**

---

### POST `/classrooms/:classroomId/posts/:postId/attachments` [MEMBER]

Upload file đính kèm cho bài post. Dùng `multipart/form-data`.

```
POST .../attachments
Content-Type: multipart/form-data

files: <binary>    // 1 hoặc nhiều file, mỗi file tối đa 50MB
```

**Response 201:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fileName": "slide.pdf",
      "fileExt": "pdf",
      "fileSizeBytes": 2048000,
      "url": "http://minio:9000/...",
      "uploadedAt": "2025-05-01T08:00:00Z"
    }
  ]
}
```

---

### DELETE `/classrooms/:classroomId/posts/:postId/attachments/:attachmentId` [MEMBER]

Chỉ author hoặc teacher. **Response 204.**

---

## 9. Schedule Endpoints

Base path: `/classrooms/:classroomId/schedules`

### GET `/classrooms/:classroomId/schedules` [MEMBER]

Danh sách lịch học. Có thể lọc theo khoảng ngày.

**Query params:**

| Param | Format | Mô tả |
|-------|--------|-------|
| `from` | `YYYY-MM-DD` | Từ ngày (optional) |
| `to` | `YYYY-MM-DD` | Đến ngày (optional) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Buổi học tuần 1",
      "scheduledDate": "2025-05-10",
      "startTime": "08:00",
      "endTime": "10:00",
      "description": "Chương 1: Số tự nhiên",
      "sessionId": null,       // sẽ có giá trị sau khi session được tạo (M09)
      "createdAt": "2025-05-01T08:00:00Z",
      "updatedAt": "2025-05-01T08:00:00Z"
    }
  ]
}
```

---

### POST `/classrooms/:classroomId/schedules` [OWNER]

**Request:**
```json
{
  "title": "Buổi học tuần 1",
  "scheduledDate": "2025-05-10",      // YYYY-MM-DD
  "startTime": "08:00:00",             // HH:mm:ss hoặc HH:mm
  "endTime": "10:00:00",
  "description": "Chương 1..."         // optional
}
```

**Response 201:** `ScheduleDto`.

---

### PUT `/classrooms/:classroomId/schedules/:scheduleId` [OWNER]

Partial update — chỉ gửi các field muốn cập nhật.

**Request:**
```json
{
  "title": "Buổi học tuần 1 (đã đổi giờ)",
  "startTime": "09:00:00",
  "endTime": "11:00:00"
}
```

**Response 200:** `ScheduleDto`.

---

### DELETE `/classrooms/:classroomId/schedules/:scheduleId` [OWNER]

**Response 204.**

---

## 10. Document Endpoints

Base path: `/classrooms/:classroomId/documents`

Tài liệu lớp bao gồm 2 nguồn:
- **`direct`**: Teacher upload thẳng vào thư viện tài liệu
- **`post`**: File đính kèm trong các bài post

### GET `/classrooms/:classroomId/documents` [MEMBER]

**Query params:**

| Param | Giá trị | Mô tả |
|-------|---------|-------|
| `source` | `direct` \| `post` \| _(bỏ trống)_ | Lọc theo nguồn. Bỏ trống = lấy tất cả |
| `page` | number | Trang (default 1) |
| `limit` | number | Số item (default 20) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fileName": "slide.pdf",
      "fileExt": "pdf",
      "fileSizeBytes": 2048000,
      "url": "http://minio:9000/classpulse/...",
      "source": "direct",              // "direct" | "post"
      "postId": null,                  // UUID nếu source = "post"
      "uploadedBy": {
        "id": "uuid",
        "name": "Nguyễn Văn A"
      },
      "uploadedAt": "2025-05-01T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "size": 20, "totalElements": 10, "totalPages": 1 }
}
```

---

### POST `/classrooms/:classroomId/documents` [OWNER]

Upload tài liệu trực tiếp vào thư viện. `multipart/form-data`.

```
POST .../documents
Content-Type: multipart/form-data

files: <binary>   // 1 hoặc nhiều file, mỗi file tối đa 50MB
```

**Response 201:** Danh sách `DocumentDto`.

---

### DELETE `/classrooms/:classroomId/documents/:documentId` [OWNER]

Chỉ xóa được tài liệu `source = "direct"`. File `source = "post"` xóa qua post attachment API.

**Response 204.**

---

## 11. Upload (Presigned URL)

Flow upload trực tiếp lên MinIO (không qua server):

```
1. Frontend → POST /uploads/presign → nhận uploadUrl + fileKey
2. Frontend → PUT <uploadUrl> (trực tiếp đến MinIO, không Bearer token)
3. Frontend dùng fileKey để lưu reference trong DB qua API khác
```

### POST `/uploads/presign` [AUTH]

**Request:**
```json
{
  "purpose": "post_attachment",    // "post_attachment" | "classroom_document" | "avatar"
  "files": [
    {
      "fileName": "slide.pdf",
      "contentType": "application/pdf",
      "fileSizeBytes": 2048000
    },
    {
      "fileName": "image.png",
      "contentType": "image/png",
      "fileSizeBytes": 512000
    }
  ]
}
```

**Giới hạn kích thước:**
| Purpose | Max size |
|---------|---------|
| `avatar` | 5 MB |
| `post_attachment` | 50 MB |
| `classroom_document` | 50 MB |

**Số file tối đa:** 10 file / request.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "fileName": "slide.pdf",
      "fileKey": "uploads/2025/05/550e8400-slide.pdf",
      "uploadUrl": "http://minio:9000/classpulse/uploads/...?X-Amz-Signature=...",
      "expiresAt": "2025-05-01T08:05:00Z"
    }
  ]
}
```

**Upload lên MinIO:**
```javascript
// PUT thẳng đến uploadUrl, KHÔNG gửi Authorization header
await fetch(presignedUrl.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
});
// Sau khi upload xong, dùng presignedUrl.fileKey để reference
```

> **Lưu ý:** `uploadUrl` có thời hạn **5 phút**. Nên gọi presign ngay trước khi upload.

---

## 12. WebSocket Ticket

WebSocket auth dùng **one-time ticket** thay vì JWT header (SockJS không hỗ trợ custom header).

### POST `/auth/ws-ticket` [AUTH]

Tạo WS ticket (TTL 60 giây, dùng một lần).

**Response 200:**
```json
{
  "success": true,
  "data": { "ticket": "a3f7bc91-2e4d-4f8a-9c1b-6d8e5f2a1b0c" }
}
```

**Kết nối WebSocket:**
```javascript
const { data } = await api.post('/auth/ws-ticket');
const ticket = data.data.ticket;

const socket = new SockJS(`http://localhost:8080/ws?ticket=${ticket}`);
const stompClient = Stomp.over(socket);
stompClient.connect({}, frame => {
  // connected
});
```

> Ticket hết hạn sau 60s hoặc sau lần dùng đầu tiên — gọi endpoint này ngay trước khi connect WS.

---

## Appendix: TypeScript Types

```typescript
// Response envelope
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PageMeta;
  error?: { code: string; message: string };
}

interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Auth
interface AuthResponse {
  user: UserSummary;
  accessToken: string;
  expiresIn: number; // seconds (900 = 15 phút)
}

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  avatarColor: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// User
interface UserDto extends UserSummary {
  isActive?: boolean;
  stats?: {
    classroomsCount: number;
    sessionsCount: number;
    questionsAsked: number;
    studentsReached: number;
  };
}

// Classroom
interface ClassroomDto {
  id: string;
  name: string;
  description: string | null;
  subject: string | null;
  joinCode: string;
  teacher: { id: string; name: string; avatarColor: string | null };
  studentCount: number;
  nextSchedule: {
    id: string;
    title: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
  } | null;
  isArchived: boolean;
  createdAt: string;
}

// Post
interface PostDto {
  id: string;
  author: { id: string; name: string; role: string; avatarColor: string | null };
  content: string;
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

interface AttachmentDto {
  id: string;
  fileName: string;
  fileExt: string;
  fileSizeBytes: number;
  url: string;
  uploadedAt: string;
}

// Schedule
interface ScheduleDto {
  id: string;
  title: string;
  scheduledDate: string;  // "YYYY-MM-DD"
  startTime: string;      // "HH:mm"
  endTime: string;        // "HH:mm"
  description: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Document
interface DocumentDto {
  id: string;
  fileName: string;
  fileExt: string;
  fileSizeBytes: number;
  url: string;
  source: 'direct' | 'post';
  postId: string | null;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

// Upload presign
interface PresignedUrlDto {
  fileName: string;
  fileKey: string;
  uploadUrl: string;
  expiresAt: string;
}
```
