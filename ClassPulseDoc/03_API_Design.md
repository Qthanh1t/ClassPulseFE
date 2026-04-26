# ClassPulse — REST API Design

> **Base URL:** `/api/v1` | **Auth:** `Authorization: Bearer <accessToken>`  
> **Xem thêm:** DB Schema → [02_Database_Design.md](02_Database_Design.md) | WS Implementation → [04_Realtime_Architecture.md](04_Realtime_Architecture.md)  
> **Date:** 2026-04-25

---

## Conventions

### Standard Response Envelope

All endpoints return a consistent JSON wrapper.

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```
`meta` chỉ có khi response là danh sách (pagination).

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "CLASSROOM_NOT_FOUND",
    "message": "Classroom not found",
    "details": [
      { "field": "email", "message": "Email already registered" }
    ]
  },
  "request_id": "req_abc123"
}
```

### HTTP Status Codes

| Code | When |
|------|------|
| `200 OK` | GET, PUT/PATCH success |
| `201 Created` | POST tạo resource mới |
| `204 No Content` | DELETE success |
| `400 Bad Request` | Request malformed (sai JSON, thiếu required field) |
| `401 Unauthorized` | Chưa login hoặc token hết hạn |
| `403 Forbidden` | Login rồi nhưng không có quyền |
| `404 Not Found` | Resource không tồn tại |
| `409 Conflict` | Duplicate (đã tham gia lớp, câu hỏi đang chạy...) |
| `422 Unprocessable Entity` | Dữ liệu hợp lệ nhưng vi phạm business rule |
| `500 Internal Server Error` | Lỗi server không mong đợi |

### Auth Levels

| Symbol | Ý nghĩa |
|--------|---------|
| `[PUBLIC]` | Không cần đăng nhập |
| `[AUTH]` | Cần login (bất kỳ role) |
| `[TEACHER]` | Chỉ teacher |
| `[STUDENT]` | Chỉ student |
| `[ADMIN]` | Chỉ admin |
| `[OWNER]` | Teacher phải là chủ lớp/phiên |

### Pagination Query Params (cho list endpoints)

| Param | Default | Ý nghĩa |
|-------|---------|---------|
| `page` | `1` | Trang hiện tại |
| `limit` | `20` | Số item mỗi trang |
| `sort` | `created_at` | Trường sort |
| `order` | `desc` | `asc` hoặc `desc` |

---

## Module 1: Auth

### POST `/api/v1/auth/register` `[PUBLIC]`

Đăng ký tài khoản mới.

**Request body:**
```json
{
  "email": "teacher@example.com",
  "password": "P@ssword123",
  "name": "Nguyễn Thị Lan",
  "role": "teacher"
}
```
Validation: `role` phải là `teacher` hoặc `student`. Admin không được tự tạo.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "teacher@example.com",
      "name": "Nguyễn Thị Lan",
      "role": "teacher",
      "avatarColor": "#6366f1",
      "createdAt": "2026-04-25T08:00:00Z"
    },
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```
`refreshToken` được set via httpOnly cookie (`Set-Cookie: refresh_token=...`).

---

### POST `/api/v1/auth/login` `[PUBLIC]`

**Request body:**
```json
{
  "email": "teacher@example.com",
  "password": "P@ssword123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "teacher@example.com",
      "name": "Nguyễn Thị Lan",
      "role": "teacher",
      "avatarColor": "#6366f1",
      "avatarUrl": null
    },
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```

**Errors:** `401` nếu sai credentials; `403` nếu account bị ban.

---

### POST `/api/v1/auth/refresh` `[PUBLIC]`

Dùng httpOnly `refresh_token` cookie để lấy access token mới.

**Request:** Không có body. Cookie `refresh_token` tự động gửi.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900
  }
}
```

**Errors:** `401` nếu refresh token hết hạn hoặc bị revoke.

---

### POST `/api/v1/auth/logout` `[AUTH]`

Revoke refresh token, xóa cookie.

**Request:** Không có body.

**Response `204`:** Không có body.

---

## Module 2: Users

### GET `/api/v1/users/me` `[AUTH]`

Lấy thông tin người dùng hiện tại.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "teacher@example.com",
    "name": "Nguyễn Thị Lan",
    "role": "teacher",
    "avatarColor": "#6366f1",
    "avatarUrl": "https://minio.../avatars/uuid.jpg",
    "stats": {
      "classroomsCount": 3,
      "sessionsCount": 12,
      "questionsAsked": 48,
      "studentsReached": 24
    },
    "createdAt": "2026-01-15T08:00:00Z"
  }
}
```
`stats` tính từ data thực. Teacher thấy số liệu GV; student thấy số liệu HS.

---

### PUT `/api/v1/users/me` `[AUTH]`

Cập nhật profile.

**Request body:**
```json
{
  "name": "Nguyễn Thị Lan",
  "avatarColor": "#6366f1"
}
```

**Response `200`:** Trả về user object đã update (giống GET /me).

---

### POST `/api/v1/users/me/avatar` `[AUTH]`

Upload avatar. Dùng multipart/form-data (file nhỏ).

**Request:** `Content-Type: multipart/form-data`
```
file: <binary>   (max 5MB, chấp nhận jpg/png/webp)
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "avatarUrl": "https://minio.../avatars/uuid.jpg" }
}
```

---

### GET `/api/v1/users` `[ADMIN]`

Danh sách tất cả user (admin panel).

**Query params:** `page`, `limit`, `role`, `search` (tìm theo tên/email)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "...",
      "name": "...",
      "role": "student",
      "isActive": true,
      "createdAt": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

---

### PUT `/api/v1/users/:userId` `[ADMIN]`

Admin cập nhật user (đổi role, ban/unban).

**Request body:**
```json
{
  "isActive": false,
  "role": "student"
}
```

**Response `200`:** User object đã update.

---

## Module 3: Classrooms

### GET `/api/v1/classrooms` `[AUTH]`

Lấy danh sách lớp của người dùng hiện tại.
- Teacher: lớp do họ dạy
- Student: lớp họ đã tham gia (is_active=true)

**Query params:** `page`, `limit`, `search`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Lập trình Web nâng cao",
      "description": "...",
      "subject": "Frontend",
      "joinCode": "ABC123",
      "teacherName": "Nguyễn Thị Lan",
      "studentCount": 8,
      "nextSchedule": {
        "id": "uuid",
        "title": "Buổi 5",
        "scheduledDate": "2026-04-28",
        "startTime": "18:00",
        "endTime": "20:00"
      },
      "isArchived": false,
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

---

### POST `/api/v1/classrooms` `[TEACHER]`

Tạo lớp mới.

**Request body:**
```json
{
  "name": "Lập trình Web nâng cao",
  "description": "Khóa học về React, TypeScript và các công nghệ hiện đại",
  "subject": "Frontend"
}
```
Server tự sinh `joinCode` ngẫu nhiên (6-8 ký tự, uppercase).

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Lập trình Web nâng cao",
    "subject": "Frontend",
    "joinCode": "REACT24",
    "studentCount": 0,
    "createdAt": "..."
  }
}
```

---

### GET `/api/v1/classrooms/:classroomId` `[AUTH]`

Chi tiết lớp học. Chỉ member hoặc teacher của lớp mới xem được.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Lập trình Web nâng cao",
    "description": "...",
    "subject": "Frontend",
    "joinCode": "REACT24",
    "teacher": {
      "id": "uuid",
      "name": "Nguyễn Thị Lan",
      "avatarColor": "#6366f1"
    },
    "studentCount": 8,
    "isArchived": false,
    "createdAt": "..."
  }
}
```

---

### PUT `/api/v1/classrooms/:classroomId` `[OWNER]`

Cập nhật thông tin lớp.

**Request body:**
```json
{
  "name": "Lập trình Web nâng cao (2026)",
  "description": "Mô tả mới",
  "subject": "Frontend",
  "isArchived": false
}
```

**Response `200`:** Classroom object đã update.

---

### DELETE `/api/v1/classrooms/:classroomId` `[OWNER]`

Xóa lớp (soft delete — đặt `isArchived=true` và ẩn khỏi danh sách).

**Response `204`**

---

### POST `/api/v1/classrooms/join` `[STUDENT]`

HS tham gia lớp bằng mã.

**Request body:**
```json
{ "joinCode": "REACT24" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "classroomId": "uuid",
    "classroomName": "Lập trình Web nâng cao",
    "joinedAt": "..."
  }
}
```

**Errors:** `404` nếu mã không tồn tại; `409` nếu đã tham gia.

---

### GET `/api/v1/classrooms/:classroomId/members` `[AUTH]`

Danh sách thành viên lớp.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Nguyễn Văn An",
      "role": "student",
      "avatarColor": "#10b981",
      "joinedAt": "2026-01-20T..."
    }
  ],
  "meta": { "total": 8 }
}
```

---

### DELETE `/api/v1/classrooms/:classroomId/members/:studentId` `[OWNER]`

GV kick HS ra khỏi lớp (đặt `is_active=false` trong membership).

**Response `204`**

---

### POST `/api/v1/classrooms/:classroomId/join-code/regenerate` `[OWNER]`

Tái tạo mã tham gia (nếu bị lộ).

**Response `200`:**
```json
{
  "success": true,
  "data": { "joinCode": "XYZ789" }
}
```

---

## Module 4: Posts (Bảng tin)

### GET `/api/v1/classrooms/:classroomId/posts` `[AUTH]`

Danh sách bài đăng (feed), mới nhất trước.

**Query params:** `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "author": {
        "id": "uuid",
        "name": "Nguyễn Thị Lan",
        "role": "teacher",
        "avatarColor": "#6366f1"
      },
      "content": "<p>Bài tập tuần này...</p>",
      "attachments": [
        {
          "id": "uuid",
          "fileName": "bai-tap-tuan-3.pdf",
          "fileExt": "pdf",
          "fileSizeBytes": 204800,
          "url": "https://minio.../post-attachments/uuid.pdf",
          "uploadedAt": "..."
        }
      ],
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-20T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

---

### POST `/api/v1/classrooms/:classroomId/posts` `[AUTH]`

Đăng bài mới. Attachment upload riêng sau đó (xem Module 10).

**Request body:**
```json
{
  "content": "<p>Các em ôn tập chương 3 trước buổi học tới nhé!</p>"
}
```

**Response `201`:** Post object đầy đủ (không có attachment vì vừa tạo).

---

### PUT `/api/v1/classrooms/:classroomId/posts/:postId` `[AUTH]`

Chỉnh sửa bài. Chỉ tác giả hoặc teacher (nếu xóa bài của HS).

**Request body:**
```json
{
  "content": "<p>Nội dung đã sửa...</p>"
}
```

**Response `200`:** Post object đã update.

---

### DELETE `/api/v1/classrooms/:classroomId/posts/:postId` `[AUTH]`

Xóa bài. Chỉ tác giả hoặc teacher.

**Response `204`**

---

### POST `/api/v1/classrooms/:classroomId/posts/:postId/attachments` `[AUTH]`

Upload file đính kèm bài đăng.

**Request:** `Content-Type: multipart/form-data`
```
files: <binary[]>   (max 50MB mỗi file, nhiều file cùng lúc)
```

**Response `201`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fileName": "slide-chuong3.pptx",
      "fileExt": "pptx",
      "fileSizeBytes": 5242880,
      "url": "https://minio.../..."
    }
  ]
}
```

---

### DELETE `/api/v1/classrooms/:classroomId/posts/:postId/attachments/:attachmentId` `[AUTH]`

Xóa 1 attachment.

**Response `204`**

---

## Module 5: Schedules (Lịch học)

### GET `/api/v1/classrooms/:classroomId/schedules` `[AUTH]`

Danh sách lịch học.

**Query params:** `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Buổi 5 — React Hooks nâng cao",
      "scheduledDate": "2026-04-28",
      "startTime": "18:00",
      "endTime": "20:00",
      "description": "useCallback, useMemo, useRef",
      "sessionId": "uuid-or-null",
      "createdAt": "..."
    }
  ]
}
```
`sessionId` là UUID nếu buổi học đã xảy ra (có Session record linked), `null` nếu chưa.

---

### POST `/api/v1/classrooms/:classroomId/schedules` `[OWNER]`

Thêm lịch học.

**Request body:**
```json
{
  "title": "Buổi 5 — React Hooks nâng cao",
  "scheduledDate": "2026-04-28",
  "startTime": "18:00",
  "endTime": "20:00",
  "description": "useCallback, useMemo, useRef"
}
```

**Response `201`:** Schedule object.

---

### PUT `/api/v1/classrooms/:classroomId/schedules/:scheduleId` `[OWNER]`

Cập nhật lịch.

**Request body:** Tương tự POST, tất cả fields optional.

**Response `200`:** Schedule object đã update.

---

### DELETE `/api/v1/classrooms/:classroomId/schedules/:scheduleId` `[OWNER]`

Xóa lịch. Chỉ cho phép xóa lịch chưa có session.

**Errors:** `422` nếu lịch đã có session đã diễn ra.

**Response `204`**

---

## Module 6: Documents (Tài liệu)

### GET `/api/v1/classrooms/:classroomId/documents` `[AUTH]`

Lấy tất cả tài liệu: từ post attachments + direct uploads.

**Query params:** `source` (`post` | `direct` | all), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fileName": "slide-chuong3.pptx",
      "fileExt": "pptx",
      "fileSizeBytes": 5242880,
      "url": "https://minio.../...",
      "source": "post",
      "postId": "uuid",
      "uploadedBy": {
        "id": "uuid",
        "name": "Nguyễn Thị Lan"
      },
      "uploadedAt": "2026-04-20T10:00:00Z"
    },
    {
      "id": "uuid",
      "fileName": "de-cuong.pdf",
      "fileExt": "pdf",
      "source": "direct",
      "postId": null,
      "uploadedAt": "..."
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 12 }
}
```

---

### POST `/api/v1/classrooms/:classroomId/documents` `[OWNER]`

Upload file tài liệu trực tiếp (không qua bài đăng).

**Request:** `Content-Type: multipart/form-data`
```
files: <binary[]>
```

**Response `201`:** Mảng Document object vừa tạo.

---

### DELETE `/api/v1/classrooms/:classroomId/documents/:documentId` `[OWNER]`

Xóa tài liệu direct upload. Không thể xóa qua endpoint này nếu `source=post` (xóa qua attachment endpoint).

**Response `204`**

---

## Module 7: Sessions (Buổi học)

### POST `/api/v1/classrooms/:classroomId/sessions` `[OWNER]`

GV bắt đầu buổi học. Tạo Session record với `status=active`.

**Request body:**
```json
{
  "scheduleId": "uuid-optional"
}
```
`scheduleId` null nếu GV bắt đầu không theo lịch.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "classroomId": "uuid",
    "classroomName": "Lập trình Web nâng cao",
    "scheduleId": "uuid-or-null",
    "status": "active",
    "startedAt": "2026-04-25T18:00:00Z",
    "wsTicket": "ws_ticket_abc123"
  }
}
```
`wsTicket` là one-time token để connect WebSocket, hết hạn sau 60s.

**Errors:** `409` nếu lớp đang có session active khác.

---

### GET `/api/v1/classrooms/:classroomId/sessions` `[AUTH]`

Lịch sử buổi học.

**Query params:** `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "scheduleTitle": "Buổi 5",
      "status": "ended",
      "startedAt": "2026-04-20T18:00:00Z",
      "endedAt": "2026-04-20T20:05:00Z",
      "questionCount": 6,
      "studentCount": 8
    }
  ],
  "meta": { "page": 1, "total": 12 }
}
```

---

### GET `/api/v1/sessions/:sessionId` `[AUTH]`

Chi tiết session.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "classroomId": "uuid",
    "classroomName": "Lập trình Web nâng cao",
    "teacher": { "id": "uuid", "name": "Nguyễn Thị Lan" },
    "status": "active",
    "startedAt": "2026-04-25T18:00:00Z",
    "endedAt": null,
    "questionCount": 2,
    "presentStudentCount": 7
  }
}
```

---

### POST `/api/v1/sessions/:sessionId/end` `[OWNER]`

GV kết thúc buổi học. Server đặt `status=ended`, tính `session_student_summaries` bất đồng bộ.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "endedAt": "2026-04-25T20:05:00Z",
    "duration": 7500,
    "questionCount": 6,
    "studentCount": 8
  }
}
```

---

### POST `/api/v1/sessions/:sessionId/join` `[STUDENT]`

HS xin vào phiên học. Tạo/cập nhật `session_presences`. Trả về WS ticket.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "classroomName": "Lập trình Web nâng cao",
    "teacherName": "Nguyễn Thị Lan",
    "wsTicket": "ws_ticket_xyz789"
  }
}
```

**Errors:** `404` nếu session không tồn tại; `422` nếu session đã ended.

---

### POST `/api/v1/sessions/:sessionId/leave` `[STUDENT]`

HS rời buổi học. Đặt `session_presences.left_at = now()`.

**Response `204`**

---

### GET `/api/v1/sessions/:sessionId/presence` `[AUTH]`

Danh sách HS đang online trong phòng.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "studentId": "uuid",
      "name": "Nguyễn Văn An",
      "avatarColor": "#10b981",
      "joinedAt": "2026-04-25T18:02:00Z",
      "isOnline": true
    }
  ]
}
```

---

## Module 8: Questions (Câu hỏi)

### GET `/api/v1/sessions/:sessionId/questions` `[AUTH]`

Danh sách câu hỏi đã tạo trong session (kể cả đã ended).

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "questionOrder": 1,
      "type": "single",
      "content": "<p>Hook nào dùng để quản lý side effects?</p>",
      "timerSeconds": 60,
      "status": "ended",
      "startedAt": "...",
      "endsAt": "...",
      "endedAt": "...",
      "options": [
        { "id": "uuid", "label": "A", "text": "useState", "isCorrect": false, "order": 1 },
        { "id": "uuid", "label": "B", "text": "useEffect", "isCorrect": true, "order": 2 },
        { "id": "uuid", "label": "C", "text": "useMemo", "isCorrect": false, "order": 3 }
      ]
    }
  ]
}
```

---

### POST `/api/v1/sessions/:sessionId/questions` `[OWNER]`

GV tạo câu hỏi mới. Status bắt đầu là `draft`.

**Request body:**
```json
{
  "type": "single",
  "content": "<p>Hook nào dùng để quản lý side effects?</p>",
  "timerSeconds": 60,
  "options": [
    { "label": "A", "text": "useState", "isCorrect": false },
    { "label": "B", "text": "useEffect", "isCorrect": true },
    { "label": "C", "text": "useMemo", "isCorrect": false },
    { "label": "D", "text": "useRef", "isCorrect": false }
  ]
}
```
`options` bắt buộc nếu `type` là `single`/`multiple`; bỏ qua nếu `essay`.
`timerSeconds` null hoặc bỏ qua = không có timer.

**Response `201`:** Question object đầy đủ.

---

### POST `/api/v1/sessions/:sessionId/questions/:questionId/start` `[OWNER]`

GV phát câu hỏi (chuyển `draft → running`). Server set `startedAt` + `endsAt`.

**Request body:** Trống (không cần body).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "running",
    "startedAt": "2026-04-25T18:10:00Z",
    "endsAt": "2026-04-25T18:11:00Z"
  }
}
```

**Errors:** `409` nếu đang có câu hỏi khác `running`; `422` nếu session không `active`.

Server đồng thời broadcast WebSocket event `question_started` đến tất cả HS.

---

### POST `/api/v1/sessions/:sessionId/questions/:questionId/end` `[OWNER]`

GV kết thúc câu hỏi sớm (trước timer).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "ended",
    "endedAt": "2026-04-25T18:10:45Z"
  }
}
```

Server broadcast `question_ended` với aggregated stats.

---

### GET `/api/v1/sessions/:sessionId/questions/:questionId/stats` `[OWNER]`

Live stats cho câu hỏi đang chạy hoặc đã ended.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "questionId": "uuid",
    "totalStudents": 8,
    "answeredCount": 6,
    "skippedCount": 2,
    "correctCount": 5,
    "wrongCount": 1,
    "optionDistribution": [
      { "optionId": "uuid", "label": "A", "text": "useState", "isCorrect": false, "count": 1 },
      { "optionId": "uuid", "label": "B", "text": "useEffect", "isCorrect": true, "count": 5 },
      { "optionId": "uuid", "label": "C", "text": "useMemo", "isCorrect": false, "count": 0 }
    ],
    "confidenceBreakdown": {
      "high": 3,
      "medium": 2,
      "low": 1,
      "none": 2
    },
    "silentStudents": [
      { "id": "uuid", "name": "Hoàng Văn Em", "avatarColor": "#f59e0b" }
    ]
  }
}
```

---

## Module 9: Student Answers

### POST `/api/v1/sessions/:sessionId/questions/:questionId/answers` `[STUDENT]`

HS nộp câu trả lời. Chỉ được nộp 1 lần (UNIQUE constraint). Server tính `isCorrect` tự động cho MCQ.

**Request body:**
```json
{
  "selectedOptionIds": ["uuid-optionB"],
  "essayText": null,
  "confidence": "high"
}
```
`selectedOptionIds` array rỗng hoặc bỏ qua nếu essay.
`essayText` bỏ qua nếu MCQ.
`confidence` optional (có thể null).

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "questionId": "uuid",
    "studentId": "uuid",
    "selectedOptionIds": ["uuid-optionB"],
    "essayText": null,
    "confidence": "high",
    "isCorrect": true,
    "answeredAt": "2026-04-25T18:10:30Z"
  }
}
```

**Errors:**
- `409` nếu đã nộp trước đó
- `422` nếu câu hỏi không còn `running` (timer đã hết)
- `422` nếu `selectedOptionIds` chứa option không thuộc câu hỏi này

Server broadcast aggregate update `answer_aggregate` đến GV (chỉ số đếm, không lộ chi tiết đến HS).

---

### GET `/api/v1/sessions/:sessionId/questions/:questionId/answers` `[AUTH]`

- **Teacher:** Xem tất cả đáp án của mọi HS
- **Student:** Chỉ xem đáp án của bản thân

**Response `200` (teacher view):**
```json
{
  "success": true,
  "data": [
    {
      "student": { "id": "uuid", "name": "Nguyễn Văn An" },
      "selectedOptionIds": ["uuid-optionB"],
      "essayText": null,
      "confidence": "high",
      "isCorrect": true,
      "answeredAt": "..."
    }
  ]
}
```

---

## Module 10: Breakout Rooms

### POST `/api/v1/sessions/:sessionId/breakouts` `[OWNER]`

GV tạo và khởi động breakout session, gồm cả phân nhóm.

**Request body:**
```json
{
  "rooms": [
    {
      "name": "Nhóm 1",
      "task": "Tìm hiểu về React Context API và trình bày",
      "studentIds": ["uuid-s1", "uuid-s2", "uuid-s3"]
    },
    {
      "name": "Nhóm 2",
      "task": "Tìm hiểu về Redux Toolkit",
      "studentIds": ["uuid-s4", "uuid-s5"]
    },
    {
      "name": "Nhóm 3",
      "task": "So sánh Zustand và Jotai",
      "studentIds": ["uuid-s6", "uuid-s7", "uuid-s8"]
    }
  ]
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "breakoutSessionId": "uuid",
    "startedAt": "2026-04-25T18:30:00Z",
    "rooms": [
      {
        "id": "uuid",
        "name": "Nhóm 1",
        "task": "Tìm hiểu về React Context API và trình bày",
        "order": 1,
        "students": [
          { "id": "uuid", "name": "Nguyễn Văn An", "avatarColor": "#10b981" }
        ]
      }
    ]
  }
}
```

Server broadcast `breakout_started` event đến tất cả participants với assignment.

---

### GET `/api/v1/sessions/:sessionId/breakouts/active` `[AUTH]`

Lấy breakout session đang active (nếu có).

**Response `200`:** Breakout session object (giống response của POST), hoặc `data: null` nếu không có.

---

### POST `/api/v1/sessions/:sessionId/breakouts/:breakoutId/end` `[OWNER]`

Kết thúc breakout, đưa tất cả về main room.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "breakoutSessionId": "uuid",
    "endedAt": "2026-04-25T18:55:00Z"
  }
}
```

Server broadcast `breakout_ended`.

---

### POST `/api/v1/sessions/:sessionId/breakouts/:breakoutId/broadcast` `[OWNER]`

GV gửi broadcast message đến tất cả phòng.

**Request body:**
```json
{
  "content": "Còn 5 phút! Chuẩn bị báo cáo."
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "sentAt": "2026-04-25T18:50:00Z", "recipientCount": 8 }
}
```

Server broadcast `broadcast_message` event đến tất cả HS.

---

### POST `/api/v1/sessions/:sessionId/breakouts/:breakoutId/rooms/:roomId/join` `[OWNER]`

GV vào một phòng breakout cụ thể để trao đổi.

**Response `200`:**
```json
{
  "success": true,
  "data": { "roomId": "uuid", "joinedAt": "..." }
}
```

Server broadcast `teacher_joined_room` event đến HS trong phòng đó.

---

### POST `/api/v1/sessions/:sessionId/breakouts/:breakoutId/rooms/:roomId/leave` `[OWNER]`

GV rời phòng breakout.

**Response `204`**

---

## Module 11: Chat

### GET `/api/v1/sessions/:sessionId/chat` `[AUTH]`

Load lịch sử chat (dùng khi vào session hoặc cần scroll up).

**Query params:** `limit` (default 50), `before` (message ID — cursor-based pagination)

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sender": {
        "id": "uuid",
        "name": "Nguyễn Thị Lan",
        "role": "teacher",
        "avatarColor": "#6366f1"
      },
      "content": "Các em có câu hỏi không?",
      "breakoutRoomId": null,
      "sentAt": "2026-04-25T18:05:00Z"
    }
  ],
  "meta": { "hasMore": true, "oldestId": "uuid" }
}
```
Tin nhắn realtime được nhận qua WebSocket, không cần polling.

---

## Module 12: Dashboard (Teacher)

### GET `/api/v1/sessions/:sessionId/dashboard` `[AUTH]`

Dashboard tổng hợp của GV sau buổi học. Teacher xem lớp của mình; student không được phép.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "classroomName": "Lập trình Web nâng cao",
      "teacherName": "Nguyễn Thị Lan",
      "date": "2026-04-25",
      "duration": 7500,
      "totalStudents": 8,
      "presentStudents": 8
    },
    "overallStats": {
      "totalQuestions": 6,
      "avgCorrectRate": 72.5,
      "avgAnswerRate": 91.7,
      "avgConfidenceHigh": 3.2
    },
    "questionStats": [
      {
        "id": "uuid",
        "order": 1,
        "type": "single",
        "content": "<p>Hook nào dùng để quản lý side effects?</p>",
        "totalStudents": 8,
        "answeredCount": 8,
        "correctCount": 6,
        "wrongCount": 2,
        "skippedCount": 0,
        "correctRate": 75.0,
        "confidenceBreakdown": { "high": 4, "medium": 3, "low": 1, "none": 0 },
        "optionDistribution": [
          { "label": "A", "text": "useState", "isCorrect": false, "count": 0 },
          { "label": "B", "text": "useEffect", "isCorrect": true, "count": 6 },
          { "label": "C", "text": "useMemo", "isCorrect": false, "count": 2 }
        ]
      }
    ],
    "studentResults": [
      {
        "student": { "id": "uuid", "name": "Nguyễn Văn An", "avatarColor": "#10b981" },
        "totalQuestions": 6,
        "answeredCount": 6,
        "correctCount": 5,
        "scorePercent": 83.3,
        "questionResults": [
          {
            "questionId": "uuid",
            "order": 1,
            "result": "correct",
            "confidence": "high"
          },
          {
            "questionId": "uuid",
            "order": 2,
            "result": "wrong",
            "confidence": "medium"
          },
          {
            "questionId": "uuid",
            "order": 3,
            "result": "skipped",
            "confidence": null
          }
        ]
      }
    ]
  }
}
```

---

## Module 13: Student Review

### GET `/api/v1/sessions/:sessionId/review` `[STUDENT]`

HS xem lại kết quả cá nhân. Chỉ xem được session của lớp mình đang học.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "classroomName": "Lập trình Web nâng cao",
      "date": "2026-04-25"
    },
    "summary": {
      "totalQuestions": 6,
      "answeredCount": 6,
      "correctCount": 5,
      "wrongCount": 1,
      "skippedCount": 0,
      "scorePercent": 83.3,
      "performanceLevel": "excellent"
    },
    "questions": [
      {
        "id": "uuid",
        "order": 1,
        "type": "single",
        "content": "<p>Hook nào dùng để quản lý side effects?</p>",
        "options": [
          { "id": "uuid", "label": "A", "text": "useState", "isCorrect": false },
          { "id": "uuid", "label": "B", "text": "useEffect", "isCorrect": true },
          { "id": "uuid", "label": "C", "text": "useMemo", "isCorrect": false }
        ],
        "myAnswer": {
          "selectedOptionIds": ["uuid-optionB"],
          "essayText": null,
          "confidence": "high",
          "isCorrect": true,
          "answeredAt": "..."
        },
        "result": "correct"
      },
      {
        "id": "uuid",
        "order": 3,
        "type": "essay",
        "content": "<p>Giải thích dependency array trong useEffect</p>",
        "options": [],
        "myAnswer": {
          "selectedOptionIds": [],
          "essayText": "<p>Dependency array...</p>",
          "confidence": "medium",
          "isCorrect": null,
          "answeredAt": "..."
        },
        "result": "pending_review"
      }
    ]
  }
}
```
`performanceLevel`: `excellent` (≥70%), `good` (40-69%), `needs_improvement` (<40%).

---

## Module 14: File Upload (Presigned URL)

### POST `/api/v1/uploads/presign` `[AUTH]`

Lấy presigned URL để upload file trực tiếp lên MinIO/S3, tránh đi qua server.

**Request body:**
```json
{
  "files": [
    { "fileName": "slide-chuong3.pptx", "contentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "fileSizeBytes": 5242880 },
    { "fileName": "bai-tap.pdf", "contentType": "application/pdf", "fileSizeBytes": 204800 }
  ],
  "purpose": "post_attachment"
}
```
`purpose` có thể là: `post_attachment`, `classroom_document`, `avatar`.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "fileName": "slide-chuong3.pptx",
      "fileKey": "uploads/2026/04/uuid-slide-chuong3.pptx",
      "uploadUrl": "https://minio.../presigned-put-url?...",
      "expiresAt": "2026-04-25T18:10:00Z"
    }
  ]
}
```

Client dùng `uploadUrl` để PUT file trực tiếp. Sau khi upload xong, gọi endpoint tương ứng (post attachment, document) với `fileKey` để lưu reference.

---

## Module 15: WebSocket Events

> WebSocket endpoint: `ws://host/ws?ticket=<wsTicket>`  
> Protocol: JSON messages với `{ "type": "event_name", "payload": { ... } }`

### Server → Client Events

| Event | Khi nào | Payload |
|-------|---------|---------|
| `session_started` | GV bắt đầu buổi học | `{ sessionId, classroomName, teacherName }` |
| `session_ended` | GV kết thúc buổi học | `{ sessionId }` |
| `question_started` | GV phát câu hỏi | `{ questionId, type, content, options (nếu MCQ), endsAt }` |
| `question_ended` | Câu hỏi kết thúc | `{ questionId, stats: { correct, wrong, skipped, confidenceBreakdown } }` |
| `answer_aggregate` | Có HS vừa nộp | `{ questionId, answeredCount, totalCount }` — chỉ gửi đến GV |
| `breakout_started` | GV bật breakout | `{ breakoutSessionId, rooms: [{ id, name, task, studentIds }] }` |
| `breakout_ended` | GV tắt breakout | `{ breakoutSessionId }` |
| `broadcast_message` | GV broadcast | `{ content, sentAt }` |
| `teacher_joined_room` | GV vào phòng | `{ roomId, roomName }` — chỉ gửi đến HS trong phòng đó |
| `teacher_left_room` | GV rời phòng | `{ roomId }` |
| `focus_changed` | GV spotlight HS | `{ focusedStudentId: "uuid" \| null }` |
| `student_presence` | HS vào/rời | `{ studentId, action: "joined"\|"left" }` |
| `raise_hand_changed` | HS giơ/hạ tay | `{ studentId, raised: boolean }` |
| `chat_message` | Tin nhắn chat | `{ id, senderId, senderName, senderRole, avatarColor, content, breakoutRoomId, sentAt }` |
| `silent_alert` | HS không trả lời | `{ silentStudentIds: ["uuid"] }` — gửi đến GV sau 30s |

### Client → Server Events (gửi qua WebSocket)

| Event | Ai gửi | Payload |
|-------|--------|---------|
| `raise_hand` | Student | `{ raised: boolean }` |
| `chat_send` | Teacher/Student | `{ content, breakoutRoomId: null \| "uuid" }` |
| `focus_student` | Teacher | `{ studentId: "uuid" \| null }` |
| `webrtc_offer` | Cả hai | `{ targetId, sdp }` |
| `webrtc_answer` | Cả hai | `{ targetId, sdp }` |
| `webrtc_ice_candidate` | Cả hai | `{ targetId, candidate }` |
| `heartbeat` | Cả hai | `{}` — giữ connection alive mỗi 25s |

---

## Module 16: Admin

### GET `/api/v1/admin/stats` `[ADMIN]`

Thống kê hệ thống.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalTeachers": 12,
    "totalStudents": 138,
    "totalClassrooms": 35,
    "activeSessionsNow": 2,
    "totalSessions": 210
  }
}
```

---

### GET `/api/v1/admin/classrooms` `[ADMIN]`

Tất cả lớp học trong hệ thống.

**Query params:** `page`, `limit`, `search`, `teacherId`

**Response `200`:** Array classroom objects với teacher info + stats.

---

## Summary Table

| Module | Endpoints | Auth |
|--------|-----------|------|
| Auth | 4 | Public / AUTH |
| Users | 5 | AUTH / ADMIN |
| Classrooms | 8 | AUTH / TEACHER / OWNER |
| Posts | 5 | AUTH / OWNER |
| Post Attachments | 2 | AUTH |
| Schedules | 4 | AUTH / OWNER |
| Documents | 3 | AUTH / OWNER |
| Sessions | 7 | AUTH / OWNER / STUDENT |
| Questions | 5 | AUTH / OWNER |
| Student Answers | 2 | AUTH / STUDENT |
| Breakout Rooms | 6 | AUTH / OWNER |
| Chat | 1 | AUTH |
| Dashboard | 1 | AUTH (teacher only) |
| Student Review | 1 | STUDENT |
| File Upload | 1 | AUTH |
| WebSocket | ∞ events | AUTH (ticket) |
| Admin | 3 | ADMIN |
| **Total** | **~58 REST + WS** | |
