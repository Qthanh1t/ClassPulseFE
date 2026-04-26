# ClassPulse — Best Practices

> **Xem thêm:** Folder structure → [06_System_Architecture.md](06_System_Architecture.md) | Index → [00_Index.md](00_Index.md)

---

## 1. Naming Conventions (Java / Spring Boot)

### Packages
```
com.classpulse.<module>.<layer>

✅ com.classpulse.classroom.ClassroomService
✅ com.classpulse.question.entity.Question
✅ com.classpulse.common.exception.NotFoundException
❌ com.classpulse.services.ClassroomService       (layer-first — không dùng)
```

### Classes & Interfaces

| Type | Convention | Example |
|------|-----------|---------|
| Entity | `PascalCase` noun | `Classroom`, `StudentAnswer` |
| Repository | `<Entity>Repository` | `ClassroomRepository` |
| Service | `<Feature>Service` | `ClassroomService`, `QuestionTimerService` |
| Controller | `<Feature>Controller` | `ClassroomController` |
| DTO Request | `<Action><Feature>Request` | `CreateClassroomRequest`, `SubmitAnswerRequest` |
| DTO Response | `<Feature>Dto` hoặc `<Feature>Response` | `ClassroomDto`, `DashboardResponse` |
| Exception | `<Reason>Exception` | `NotFoundException`, `ConflictException` |
| Enum | `PascalCase` | `Role`, `QuestionType`, `ConfidenceLevel` |
| Enum value | `UPPER_SNAKE_CASE` | `QUESTION_RUNNING`, `CONF_HIGH` |
| Config bean | `<Tech>Config` | `RedisConfig`, `SecurityConfig` |

### Methods & Variables
```java
// ✅ Động từ + danh từ, camelCase
ClassroomDto getClassroomById(UUID id)
List<ClassroomDto> listByTeacher(UUID teacherId)
void startQuestion(UUID questionId)
boolean isClassroomMember(UUID classroomId, UUID userId)

// ❌ Không rõ ràng
ClassroomDto get(UUID id)
void start(UUID id)
boolean check(UUID a, UUID b)
```

### Database (PostgreSQL)
```sql
-- Tables: snake_case, plural
users, classrooms, classroom_memberships, session_presences

-- Columns: snake_case
teacher_id, created_at, is_active, file_size_bytes

-- Indexes: idx_<table>_<columns>
idx_users_email, idx_sessions_classroom

-- Constraints: fk_<child>_<parent>, uk_<table>_<columns>
fk_classrooms_teacher, uk_users_email
```

### REST Endpoints
```
-- Resources: noun, plural, kebab-case
/api/v1/classrooms
/api/v1/classrooms/{id}/members
/api/v1/sessions/{id}/questions
/api/v1/join-code/regenerate  (compound noun)

-- Actions (nếu không map được vào CRUD): POST + verb noun
POST /api/v1/sessions/{id}/end
POST /api/v1/sessions/{id}/join
POST /api/v1/breakouts/{id}/broadcast
```

---

## 2. Error Handling

### Exception Hierarchy

```java
// common/exception/AppException.java
public abstract class AppException extends RuntimeException {
    private final String errorCode;
    private final int httpStatus;

    protected AppException(String message, String errorCode, int httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }
    // getters...
}

// Concrete exceptions
public class NotFoundException extends AppException {
    public NotFoundException(String resource, Object id) {
        super(resource + " not found: " + id, "NOT_FOUND", 404);
    }
}
public class ConflictException extends AppException {
    public ConflictException(String message) {
        super(message, "CONFLICT", 409);
    }
}
public class ForbiddenException extends AppException {
    public ForbiddenException() {
        super("Insufficient permissions", "FORBIDDEN", 403);
    }
}
public class UnauthorizedException extends AppException {
    public UnauthorizedException(String message) {
        super(message, "UNAUTHORIZED", 401);
    }
}
public class BusinessException extends AppException {
    public BusinessException(String message) {
        super(message, "BUSINESS_RULE_VIOLATION", 422);
    }
}
```

### Global Exception Handler

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex,
                                                                 HttpServletRequest request) {
        log.warn("AppException: code={}, message={}, path={}",
                 ex.getErrorCode(), ex.getMessage(), request.getRequestURI());
        return ResponseEntity
            .status(ex.getHttpStatus())
            .body(ApiResponse.error(ex.getErrorCode(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> new FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();
        return ResponseEntity
            .status(422)
            .body(ApiResponse.validationError(fieldErrors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex,
                                                               HttpServletRequest request) {
        // Log đầy đủ stack trace cho lỗi không mong đợi
        log.error("Unexpected error at {}: {}", request.getRequestURI(), ex.getMessage(), ex);
        return ResponseEntity
            .status(500)
            .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
```

### Standard Response Wrapper

```java
// common/response/ApiResponse.java
@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private final boolean success;
    private final T data;
    private final PageMeta meta;
    private final ErrorDetail error;

    private ApiResponse(boolean success, T data, PageMeta meta, ErrorDetail error) {
        this.success = success;
        this.data = data;
        this.meta = meta;
        this.error = error;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    public static <T> ApiResponse<T> successPage(T data, long total, int page, int limit) {
        return new ApiResponse<>(true, data, new PageMeta(total, page, limit), null);
    }

    public static ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(false, null, null, new ErrorDetail(code, message, null));
    }

    public static ApiResponse<Void> validationError(List<FieldError> errors) {
        return new ApiResponse<>(false, null, null,
            new ErrorDetail("VALIDATION_ERROR", "Validation failed", errors));
    }

    public record PageMeta(long total, int page, int limit) {}
    public record ErrorDetail(String code, String message, List<FieldError> details) {}
    public record FieldError(String field, String message) {}
}
```

### Service Layer — Không bao giờ trả về null

```java
// ✅ Throw exception, không trả null
public ClassroomDto getById(UUID id) {
    return classroomRepository.findById(id)
        .map(classroomMapper::toDto)
        .orElseThrow(() -> new NotFoundException("Classroom", id));
}

// ✅ Optional khi "không có" là hợp lệ (e.g. active question)
public Optional<QuestionDto> findActiveQuestion(UUID sessionId) {
    return questionRepository.findRunningBySession(sessionId)
        .map(questionMapper::toDto);
}

// ❌ Không làm vậy
public ClassroomDto getById(UUID id) {
    Classroom c = classroomRepository.findById(id).orElse(null);
    if (c == null) return null;  // caller phải check null — dễ NullPointerException
    ...
}
```

---

## 3. API Versioning

### Chiến lược: **URL Versioning** (`/api/v1/...`)

**Lý do chọn URL versioning:**
- Rõ ràng nhất — developer thấy ngay version đang dùng trong URL
- Dễ test bằng curl/browser không cần custom header
- Tương thích tốt với Spring Router, Swagger, và load balancer routing

```java
// Controller annotation
@RestController
@RequestMapping("/api/v1/classrooms")
public class ClassroomController { ... }
```

### Khi nào cần tạo v2?
- Thay đổi breaking response format (xóa field, đổi type)
- Thay đổi behavior của endpoint hiện có

### Quy tắc backward compatibility:
```
✅ Thêm field mới vào response: không cần version mới (additive)
✅ Thêm optional field vào request: không cần version mới
❌ Xóa field khỏi response: cần v2
❌ Đổi kiểu dữ liệu field: cần v2
❌ Đổi behavior của endpoint: cần v2
```

---

## 4. Logging Strategy (MDC + Structured)

### Request Logging Filter

```java
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        long startTime = System.currentTimeMillis();

        // MDC: tự động thêm vào mọi log trong request này
        MDC.put("requestId", requestId);
        MDC.put("method", request.getMethod());
        MDC.put("path", request.getRequestURI());

        // Thêm requestId vào response header để debug
        response.setHeader("X-Request-ID", requestId);

        try {
            chain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            log.info("HTTP {} {} → {} ({}ms)",
                request.getMethod(), request.getRequestURI(),
                response.getStatus(), duration);
            MDC.clear();
        }
    }
}
```

### Service Logging Convention

```java
@Service
@Slf4j
@RequiredArgsConstructor
public class QuestionService {

    public QuestionDto startQuestion(UUID questionId, UUID requesterId) {
        log.info("Starting question questionId={} by teacher={}", questionId, requesterId);

        Question question = questionRepository.findById(questionId)
            .orElseThrow(() -> new NotFoundException("Question", questionId));

        if (question.getStatus() != QuestionStatus.DRAFT) {
            throw new ConflictException("Question is already " + question.getStatus());
        }

        // ... business logic ...

        log.info("Question started questionId={} endsAt={}", questionId, question.getEndsAt());
        return questionMapper.toDto(question);
    }
}
```

### Log Levels Guideline

| Level | Khi nào dùng |
|-------|-------------|
| `ERROR` | Exception không mong đợi, DB connection fail, external service timeout |
| `WARN` | Business rule violation bắt được, retry xảy ra, token không hợp lệ |
| `INFO` | CRUD operations quan trọng (session start/end, question start/end), auth events |
| `DEBUG` | Chi tiết request/response (dev only), SQL query (chỉ khi debug) |

---

## 5. Input Validation

### Jakarta Bean Validation trên DTOs

```java
// dto/CreateClassroomRequest.java
@Getter
public class CreateClassroomRequest {

    @NotBlank(message = "Classroom name is required")
    @Size(max = 200, message = "Name must not exceed 200 characters")
    private String name;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    @Pattern(regexp = "^(Frontend|Database|Architecture|Other)$",
             message = "Invalid subject")
    private String subject;
}

// dto/SubmitAnswerRequest.java
@Getter
public class SubmitAnswerRequest {

    private List<@NotNull UUID> selectedOptionIds;

    @Size(max = 10000, message = "Essay too long")
    private String essayText;

    @Pattern(regexp = "^(low|medium|high)$", message = "Invalid confidence level")
    private String confidence;
}
```

### Controller — trigger validation

```java
@PostMapping
public ResponseEntity<ApiResponse<ClassroomDto>> create(
        @RequestBody @Valid CreateClassroomRequest request,  // @Valid kích hoạt validation
        @AuthenticationPrincipal UserPrincipal currentUser) {
    ClassroomDto result = classroomService.create(request, currentUser.getId());
    return ResponseEntity.status(201).body(ApiResponse.success(result));
}
```

---

## 6. Pagination Convention

```java
// Controller
@GetMapping
public ResponseEntity<ApiResponse<List<ClassroomDto>>> list(
        @RequestParam(defaultValue = "1") @Min(1) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
        @AuthenticationPrincipal UserPrincipal currentUser) {

    Pageable pageable = PageRequest.of(page - 1, limit,   // Spring page index = 0-based
                                       Sort.by("createdAt").descending());
    Page<ClassroomDto> result = classroomService.listForUser(currentUser.getId(), pageable);

    return ResponseEntity.ok(ApiResponse.successPage(
        result.getContent(),
        result.getTotalElements(),
        page,
        limit
    ));
}
```

---

## 7. Entity Design Conventions (JPA)

```java
// Dùng @MappedSuperclass cho common fields
@MappedSuperclass
@Getter
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private Instant updatedAt;
}

// Entity example
@Entity
@Table(name = "classrooms")
@Getter
@Setter
@NoArgsConstructor
public class Classroom extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String subject;

    @Column(unique = true, nullable = false, length = 12)
    private String joinCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(nullable = false)
    private boolean isArchived = false;

    // Không để @OneToMany với CascadeType.ALL trực tiếp — tránh N+1
    // Load posts/schedules qua repository khi cần
}
```

---

## 8. Transaction Boundaries

```java
// ✅ Transaction tại Service layer
@Service
public class BreakoutService {

    @Transactional        // transaction bao quanh toàn bộ method
    public BreakoutSessionDto startBreakout(UUID sessionId, CreateBreakoutRequest request) {
        // 1. Create BreakoutSession
        BreakoutSession breakoutSession = new BreakoutSession();
        breakoutSession.setSession(sessionRepository.getReferenceById(sessionId));
        breakoutSessionRepository.save(breakoutSession);

        // 2. Create Rooms + Assignments (tất cả trong 1 transaction)
        for (CreateBreakoutRequest.RoomDto roomDto : request.getRooms()) {
            BreakoutRoom room = new BreakoutRoom();
            room.setBreakoutSession(breakoutSession);
            room.setName(roomDto.getName());
            room.setTask(roomDto.getTask());
            breakoutRoomRepository.save(room);

            for (UUID studentId : roomDto.getStudentIds()) {
                BreakoutAssignment assignment = new BreakoutAssignment(room.getId(), studentId);
                breakoutAssignmentRepository.save(assignment);
            }
        }

        // 3. Broadcast event (chỉ sau khi transaction commit)
        return breakoutSessionMapper.toDto(breakoutSession);
    }
}

// ✅ Broadcast SAU transaction (trong Controller, sau khi service return)
@PostMapping("/{sessionId}/breakouts")
@PreAuthorize("@sessionSecurity.isOwner(#sessionId, authentication)")
public ResponseEntity<ApiResponse<BreakoutSessionDto>> startBreakout(...) {
    BreakoutSessionDto result = breakoutService.startBreakout(sessionId, request);
    broadcastService.broadcastBreakoutStarted(sessionId, result);  // sau transaction
    return ResponseEntity.status(201).body(ApiResponse.success(result));
}
```

---

## 9. Security Hardening Checklist

```
✅ CORS: whitelist explicit origins, credentials=true
✅ Security headers via Spring Security defaults (X-Frame-Options, X-XSS-Protection, etc.)
✅ Rate limiting: dùng bucket4j hoặc Nginx rate limit trước proxy
✅ Input validation: @Valid trên tất cả @RequestBody
✅ SQL injection: không dùng native query với string concat, dùng @Query parameters
✅ File upload: validate content-type, file extension, scan filename (path traversal)
✅ Secrets trong env vars, không trong code hay config files
✅ Refresh token stored as hash (bcrypt), không raw value
✅ httpOnly + Secure + SameSite cookie cho refresh token
✅ WS ticket: one-time use, 60s TTL
✅ MinIO bucket: private (không public), presigned URL hết hạn trong 5 phút

❌ Không log passwords, tokens, PII
❌ Không trả stack trace ra client
❌ Không dùng 'admin'/'password' trong bất kỳ default config nào
```

---

## 10. Summary — Key Architecture Decisions

| Decision | Choice | Reason |
|---------|--------|--------|
| **Architecture** | Modular Monolith | Team nhỏ, đồ án, WS dễ quản lý |
| **Package structure** | Feature-first | Dễ tìm code liên quan, dễ tách module sau |
| **Auth** | JWT (stateless) + httpOnly refresh cookie | Secure, không cần session store |
| **Realtime** | Spring STOMP + Redis relay | Tích hợp tốt với Spring Security |
| **WebRTC** | Mesh P2P + Coturn | Đủ cho ≤ 30 người, không cần SFU |
| **Timer** | Server-side ScheduledExecutorService | Authoritative — không tin client clock |
| **DB** | PostgreSQL + Flyway | Relational, migrations versioned |
| **Cache** | Redis | Presence, tickets, pub/sub |
| **Files** | MinIO + Presigned URL | Bypass server, giảm bandwidth |
| **Error format** | `{ success, data, error }` wrapper | Consistent cho mọi response |
| **Versioning** | URL path (`/api/v1/`) | Rõ ràng, dễ debug |
| **Logging** | MDC + requestId mỗi request | Trace log across service calls |
