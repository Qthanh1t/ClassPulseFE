# ClassPulse — System Architecture

> **Xem thêm:** Tổng quan hệ thống → [01_System_Overview.md](01_System_Overview.md)

---

## 1. Monolith vs Microservices

### Quyết định: **Monolith** (Modular Monolith)

| Tiêu chí | Monolith | Microservices |
|---------|---------|--------------|
| **Team size** | 1-3 người (đồ án) | 5+ người/service |
| **Deployment complexity** | Thấp (1 artifact) | Cao (K8s, service mesh) |
| **Development speed** | Nhanh (no network call overhead) | Chậm (inter-service contracts) |
| **WebSocket với STOMP** | Dễ (1 broker in-process) | Khó (cần message broker giữa services) |
| **Data consistency** | Dễ (1 DB, local transactions) | Khó (distributed transactions, saga) |
| **Scale** | Scale cả app ngang (đủ cho < 1000 concurrent) | Scale từng service riêng |

**Kết luận:** Đồ án tốt nghiệp với team nhỏ → **Modular Monolith** là lựa chọn đúng đắn. Code được tổ chức theo feature module rõ ràng, dễ tách thành microservice sau này nếu cần mà không refactor lớn.

---

## 2. Tech Stack (Đã chọn)

| Layer | Technology | Version | Ghi chú |
|-------|-----------|---------|---------|
| **Runtime** | Java | 21 (LTS) | Virtual threads (Project Loom) |
| **Framework** | Spring Boot | 3.3.x | Spring Security 6, WebMVC |
| **WebSocket** | Spring WebSocket + STOMP | (bundled) | SockJS fallback |
| **ORM** | Spring Data JPA + Hibernate | 6.x | |
| **Migration** | Flyway | 10.x | Schema versioning |
| **Database** | PostgreSQL | 16 | Primary datastore |
| **Cache / Pub-Sub** | Redis | 7.x | Jedis client via Spring Data Redis |
| **Message Relay** | ActiveMQ / Redis Pub-Sub | — | STOMP broker relay |
| **File Storage** | MinIO | Latest | S3-compatible, self-hosted |
| **Build** | Gradle | 8.x (Kotlin DSL) | `build.gradle.kts` |
| **Container** | Docker + Docker Compose | — | Phát triển local + deploy |
| **API Docs** | Springdoc OpenAPI (Swagger) | 2.x | Auto-gen từ annotations |
| **Auth** | Spring Security + JWT (JJWT) | 6.x | Chi tiết → 05_Auth_Authorization.md |
| **WebRTC relay** | Coturn (TURN/STUN) | Latest | NAT traversal; deploy riêng, không qua Spring |
| **Testing** | JUnit 5 + Mockito + Testcontainers | — | |

---

## 3. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                     │
│                                                                        │
│   React Browser                                                        │
│   ├── REST (HTTP/HTTPS) ──────────────────────────────────────────┐   │
│   ├── WebSocket/STOMP ────────────────────────────────────────┐   │   │
│   └── WebRTC (P2P media, signaling qua WS) ───────────────┐   │   │   │
│                                                           │   │   │   │
└───────────────────────────────────────────────────────────┼───┼───┼───┘
                                                            │   │   │
                              ┌─────────────────────────────▼───▼───▼────┐
                              │          Nginx (Reverse Proxy)            │
                              │  - HTTPS termination                      │
                              │  - Static file serving (React build)      │
                              │  - WebSocket upgrade (/ws → Spring)       │
                              │  - Rate limiting                          │
                              └──────────────────────┬────────────────────┘
                                                     │
                              ┌──────────────────────▼────────────────────┐
                              │        Spring Boot Application             │
                              │  ┌─────────────────────────────────────┐  │
                              │  │  REST Controllers (HTTP)             │  │
                              │  │  WebSocket Controllers (STOMP)       │  │
                              │  └──────────────┬──────────────────────┘  │
                              │                 │                          │
                              │  ┌──────────────▼──────────────────────┐  │
                              │  │  Service Layer (Business Logic)      │  │
                              │  │  - SessionService                    │  │
                              │  │  - QuestionService                   │  │
                              │  │  - BroadcastService                  │  │
                              │  │  - QuestionTimerService              │  │
                              │  └──────┬───────────────┬──────────────┘  │
                              │         │               │                  │
                              │  ┌──────▼─────┐  ┌─────▼──────────────┐  │
                              │  │ Repository  │  │ Redis Client        │  │
                              │  │ (JPA/SQL)   │  │ (Presence, Timer,   │  │
                              │  └──────┬─────┘  │  Pub/Sub, Ticket)   │  │
                              │         │         └─────────────────────┘  │
                              └─────────┼─────────────────────────────────┘
                                        │
               ┌────────────────────────┼────────────────────────────┐
               │                        │                            │
    ┌──────────▼──────────┐  ┌──────────▼──────────┐  ┌────────────▼────┐
    │    PostgreSQL 16     │  │     Redis 7          │  │   MinIO          │
    │  - users            │  │  - ws_tickets        │  │  - post files    │
    │  - classrooms       │  │  - session presence  │  │  - documents     │
    │  - sessions         │  │  - raised hands      │  │  - avatars       │
    │  - questions        │  │  - active question   │  │                  │
    │  - answers          │  │  - STOMP broker relay│  │                  │
    │  - chat_messages    │  │  - refresh token cache│  │                  │
    └─────────────────────┘  └─────────────────────┘  └─────────────────┘

                              Coturn (TURN/STUN)
                              - WebRTC relay cho NAT traversal
                              - Deployed riêng, không qua Spring
```

---

## 4. Spring Boot Project Structure (Feature-First)

```
classpulse-backend/
├── src/
│   └── main/
│       ├── java/com/classpulse/
│       │   ├── ClasspulseApplication.java         # main class
│       │   │
│       │   ├── config/                            # Infrastructure config
│       │   │   ├── SecurityConfig.java
│       │   │   ├── WebSocketConfig.java
│       │   │   ├── RedisConfig.java
│       │   │   ├── MinioConfig.java
│       │   │   ├── CorsConfig.java
│       │   │   └── OpenApiConfig.java
│       │   │
│       │   ├── common/                            # Cross-cutting concerns
│       │   │   ├── exception/
│       │   │   │   ├── AppException.java          # base exception
│       │   │   │   ├── NotFoundException.java
│       │   │   │   ├── ConflictException.java
│       │   │   │   ├── ForbiddenException.java
│       │   │   │   └── GlobalExceptionHandler.java
│       │   │   ├── response/
│       │   │   │   ├── ApiResponse.java           # generic wrapper
│       │   │   │   └── PageResponse.java
│       │   │   ├── security/
│       │   │   │   ├── JwtTokenProvider.java
│       │   │   │   ├── JwtAuthFilter.java
│       │   │   │   ├── JwtHandshakeHandler.java
│       │   │   │   ├── JwtChannelInterceptor.java
│       │   │   │   ├── JwtAuthEntryPoint.java
│       │   │   │   └── UserPrincipal.java
│       │   │   ├── audit/
│       │   │   │   └── RequestLoggingFilter.java  # log request + response time
│       │   │   └── util/
│       │   │       ├── JoinCodeGenerator.java
│       │   │       └── SlugUtils.java
│       │   │
│       │   ├── auth/                              # Auth module
│       │   │   ├── AuthController.java
│       │   │   ├── AuthService.java
│       │   │   ├── RefreshTokenService.java
│       │   │   ├── WsTicketService.java
│       │   │   ├── RefreshTokenRepository.java
│       │   │   ├── entity/RefreshToken.java
│       │   │   └── dto/
│       │   │       ├── LoginRequest.java
│       │   │       ├── RegisterRequest.java
│       │   │       └── AuthResponse.java
│       │   │
│       │   ├── user/                              # User module
│       │   │   ├── UserController.java
│       │   │   ├── UserService.java
│       │   │   ├── UserRepository.java
│       │   │   ├── entity/User.java
│       │   │   ├── entity/Role.java (enum)
│       │   │   └── dto/
│       │   │       ├── UserDto.java
│       │   │       └── UpdateProfileRequest.java
│       │   │
│       │   ├── classroom/                         # Classroom module
│       │   │   ├── ClassroomController.java
│       │   │   ├── ClassroomService.java
│       │   │   ├── ClassroomRepository.java
│       │   │   ├── ClassroomMembershipRepository.java
│       │   │   ├── entity/
│       │   │   │   ├── Classroom.java
│       │   │   │   └── ClassroomMembership.java
│       │   │   ├── security/ClassroomSecurityBean.java
│       │   │   └── dto/
│       │   │       ├── ClassroomDto.java
│       │   │       ├── CreateClassroomRequest.java
│       │   │       └── JoinClassroomRequest.java
│       │   │
│       │   ├── post/                              # Post / Feed module
│       │   │   ├── PostController.java
│       │   │   ├── PostService.java
│       │   │   ├── PostRepository.java
│       │   │   ├── AttachmentRepository.java
│       │   │   ├── entity/
│       │   │   │   ├── Post.java
│       │   │   │   └── PostAttachment.java
│       │   │   └── dto/...
│       │   │
│       │   ├── schedule/                          # Schedule module
│       │   │   ├── ScheduleController.java
│       │   │   ├── ScheduleService.java
│       │   │   ├── ScheduleRepository.java
│       │   │   ├── entity/Schedule.java
│       │   │   └── dto/...
│       │   │
│       │   ├── document/                          # Document module
│       │   │   ├── DocumentController.java
│       │   │   ├── DocumentService.java
│       │   │   ├── DocumentRepository.java
│       │   │   ├── entity/ClassroomDocument.java
│       │   │   └── dto/...
│       │   │
│       │   ├── session/                           # Session module (core)
│       │   │   ├── SessionController.java
│       │   │   ├── SessionService.java
│       │   │   ├── SessionRepository.java
│       │   │   ├── SessionPresenceRepository.java
│       │   │   ├── SessionBroadcastService.java
│       │   │   ├── entity/
│       │   │   │   ├── Session.java
│       │   │   │   └── SessionPresence.java
│       │   │   ├── security/SessionSecurityBean.java
│       │   │   └── dto/...
│       │   │
│       │   ├── question/                          # Question module
│       │   │   ├── QuestionController.java
│       │   │   ├── QuestionService.java
│       │   │   ├── QuestionTimerService.java
│       │   │   ├── QuestionRepository.java
│       │   │   ├── QuestionOptionRepository.java
│       │   │   ├── StudentAnswerRepository.java
│       │   │   ├── SilentStudentDetector.java     # @Scheduled task
│       │   │   ├── entity/
│       │   │   │   ├── Question.java
│       │   │   │   ├── QuestionOption.java
│       │   │   │   └── StudentAnswer.java
│       │   │   └── dto/...
│       │   │
│       │   ├── breakout/                          # Breakout module
│       │   │   ├── BreakoutController.java
│       │   │   ├── BreakoutService.java
│       │   │   ├── BreakoutSessionRepository.java
│       │   │   ├── BreakoutRoomRepository.java
│       │   │   ├── BreakoutAssignmentRepository.java
│       │   │   ├── entity/
│       │   │   │   ├── BreakoutSession.java
│       │   │   │   ├── BreakoutRoom.java
│       │   │   │   └── BreakoutAssignment.java
│       │   │   └── dto/...
│       │   │
│       │   ├── chat/                              # Chat module
│       │   │   ├── ChatController.java            # REST: load history
│       │   │   ├── ChatWsController.java          # STOMP: receive new messages
│       │   │   ├── ChatService.java
│       │   │   ├── ChatRepository.java
│       │   │   ├── entity/ChatMessage.java
│       │   │   └── dto/...
│       │   │
│       │   ├── dashboard/                         # Analytics module
│       │   │   ├── DashboardController.java
│       │   │   ├── DashboardService.java
│       │   │   ├── StudentSummaryRepository.java
│       │   │   ├── SessionSummaryComputeJob.java  # chạy sau session end
│       │   │   ├── entity/SessionStudentSummary.java
│       │   │   └── dto/...
│       │   │
│       │   ├── upload/                            # File upload module
│       │   │   ├── UploadController.java
│       │   │   ├── UploadService.java             # presigned URL generation
│       │   │   └── dto/...
│       │   │
│       │   └── admin/                             # Admin module
│       │       ├── AdminController.java
│       │       └── AdminService.java
│       │
│       └── resources/
│           ├── application.yml
│           ├── application-dev.yml
│           ├── application-prod.yml
│           └── db/migration/                      # Flyway migrations
│               ├── V1__create_users.sql
│               ├── V2__create_classrooms.sql
│               ├── V3__create_sessions.sql
│               ├── V4__create_questions.sql
│               ├── V5__create_breakout.sql
│               ├── V6__create_chat.sql
│               └── V7__create_summaries.sql
│
├── src/test/java/com/classpulse/
│   ├── auth/AuthServiceTest.java
│   ├── classroom/ClassroomServiceTest.java
│   ├── question/QuestionServiceTest.java
│   └── integration/
│       ├── AuthIntegrationTest.java
│       └── SessionIntegrationTest.java
│
├── docker-compose.yml                             # dev environment
├── docker-compose.prod.yml
├── Dockerfile
├── build.gradle.kts
├── settings.gradle.kts
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
└── .env.example
```

---

## 5. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: classpulse
      POSTGRES_USER: classpulse
      POSTGRES_PASSWORD: classpulse_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console UI
    volumes:
      - minio_data:/data

  coturn:
    image: coturn/coturn
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 6. Application Configuration

```yaml
# application.yml
spring:
  application:
    name: classpulse-backend
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/classpulse}
    username: ${DB_USER:classpulse}
    password: ${DB_PASSWORD:classpulse_dev}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
  jpa:
    hibernate:
      ddl-auto: validate           # Flyway quản lý schema, JPA chỉ validate
    show-sql: false
    properties:
      hibernate:
        format_sql: true
  flyway:
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 100MB

server:
  port: ${PORT:8080}
  compression:
    enabled: true
    mime-types: application/json,text/plain

jwt:
  secret: ${JWT_SECRET}            # bắt buộc, fail fast nếu không có
  access-token-expiry: 900         # 15 phút (giây)
  refresh-token-expiry-days: 30

minio:
  endpoint: ${MINIO_ENDPOINT:http://localhost:9000}
  access-key: ${MINIO_ACCESS_KEY:minioadmin}
  secret-key: ${MINIO_SECRET_KEY:minioadmin}
  bucket: ${MINIO_BUCKET:classpulse}

logging:
  level:
    com.classpulse: DEBUG
    org.springframework.web: INFO
    org.hibernate.SQL: WARN

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: when-authorized
```

---

## 7. .env.example

```bash
# Database
DB_URL=jdbc:postgresql://localhost:5432/classpulse
DB_USER=classpulse
DB_PASSWORD=change_me_in_prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT — generate with: openssl rand -hex 64
JWT_SECRET=change_me_must_be_at_least_64_chars_for_hs512_algorithm_security

# MinIO / S3
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=classpulse

# App
PORT=8080
```
