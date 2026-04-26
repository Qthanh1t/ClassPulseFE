# ClassPulse — Authentication & Authorization

> **Stack:** Spring Boot 3.x + Spring Security 6 + JWT (JJWT library)  
> **Xem thêm:** API endpoints → [03_API_Design.md](03_API_Design.md) | WS Ticket usage → [04_Realtime_Architecture.md](04_Realtime_Architecture.md)

---

## 1. Auth Mechanism — JWT + Refresh Token

### Lý do chọn JWT (stateless access token)
- **Stateless:** API servers không cần share session state — phù hợp với scale horizontal
- **Self-contained:** Claims (userId, role) embedded trong token — không cần DB lookup mỗi request
- **Standard:** Tương thích với Spring Security seamlessly

### Token Strategy

| Token | Lưu ở đâu | TTL | Mục đích |
|-------|-----------|-----|---------|
| **Access Token** | Memory (React state) | 15 phút | Authenticate mỗi API request |
| **Refresh Token** | httpOnly cookie | 30 ngày | Lấy access token mới khi hết hạn |
| **WS Ticket** | Redis (one-time) | 60 giây | Authenticate WebSocket handshake |

> **Tại sao KHÔNG dùng localStorage cho access token?**  
> localStorage dễ bị XSS attack đọc. Memory (React state) an toàn hơn — mất khi tab đóng, nhưng refresh token trong httpOnly cookie sẽ tự cấp lại.

---

## 2. JWT Claims Structure

```json
{
  "sub": "uuid-userId",
  "role": "teacher",
  "name": "Nguyễn Thị Lan",
  "iat": 1745560800,
  "exp": 1745561700,
  "jti": "unique-token-id"
}
```

- Chỉ giữ thông tin cần thiết — **không** embed email, avatarColor, hay classroomIds
- `jti` (JWT ID) để blacklist token nếu cần (optional cho đồ án)

---

## 3. Token Flow

### 3.1 Login Flow

```
POST /api/v1/auth/login
         ↓
Server verify email + password (bcrypt)
         ↓
Generate access_token (15min) + refresh_token (30d)
         ↓
Store refresh_token hash vào DB (bảng refresh_tokens)
         ↓
Response: { accessToken } + Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict
```

### 3.2 API Request Flow

```
Client → Authorization: Bearer {accessToken} → API endpoint
                                                     ↓
                                          JwtAuthFilter.doFilter()
                                                     ↓
                                          Validate signature + expiry
                                                     ↓
                                          Extract userId, role từ claims
                                                     ↓
                                          Set SecurityContextHolder
                                                     ↓
                                          Handler method chạy
```

### 3.3 Token Refresh Flow (transparent — tự động ở client)

```
Client nhận 401 từ API call
         ↓
POST /api/v1/auth/refresh (cookie refresh_token tự gửi kèm)
         ↓
Server: tìm refresh_token hash trong DB + check not revoked + not expired
         ↓
Generate access_token mới
         ↓
Response: { accessToken }
         ↓
Client retry original request với token mới
```

---

## 4. Spring Security Configuration

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())           // stateless API — CSRF không cần
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers(POST, "/api/v1/auth/login").permitAll()
                .requestMatchers(POST, "/api/v1/auth/register").permitAll()
                .requestMatchers(POST, "/api/v1/auth/refresh").permitAll()
                // WebSocket endpoint (auth via ticket, không cần JWT header)
                .requestMatchers("/ws/**").permitAll()
                // Health check
                .requestMatchers("/actuator/health", "/actuator/ready").permitAll()
                // Everything else requires auth
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new JwtAuthEntryPoint())   // 401 JSON response
                .accessDeniedHandler(new JwtAccessDeniedHandler())   // 403 JSON response
            )
            .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173", "https://classpulse.app"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-ID"));
        config.setAllowCredentials(true);  // cần cho cookie refresh token
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

### JWT Auth Filter

```java
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractBearerToken(request);

        if (token != null) {
            try {
                Claims claims = tokenProvider.validateAndParseClaims(token);
                String userId = claims.getSubject();

                UserDetails userDetails = userDetailsService.loadUserById(UUID.fromString(userId));
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);

            } catch (JwtException e) {
                // Token invalid/expired — để SecurityContext trống, Spring trả 401
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

---

## 5. Role-Based Access Control (RBAC)

### Role Hierarchy

```
ADMIN
  └── (có thể làm mọi thứ của TEACHER và STUDENT)
TEACHER
  └── Quản lý lớp, tạo session, câu hỏi, breakout
STUDENT
  └── Tham gia lớp, trả lời câu hỏi, xem review
```

### Spring Authorities

```java
public enum Role {
    STUDENT, TEACHER, ADMIN;

    public String toAuthority() {
        return "ROLE_" + this.name();  // Spring convention: ROLE_TEACHER
    }
}
```

### Annotation-based Authorization (Method Security)

```java
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class MethodSecurityConfig { }
```

```java
// Controller examples
@RestController
@RequestMapping("/api/v1/classrooms")
public class ClassroomController {

    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse<ClassroomDto>> create(...) { ... }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('TEACHER') and @classroomSecurity.isOwner(#id, authentication)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) { ... }

    @PostMapping("/join")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<?>> join(...) { ... }

    @GetMapping("/{id}")
    @PreAuthorize("@classroomSecurity.isMember(#id, authentication)")
    public ResponseEntity<ApiResponse<ClassroomDto>> get(@PathVariable UUID id) { ... }
}
```

### Custom Security Bean (ownership check)

```java
@Component("classroomSecurity")
@RequiredArgsConstructor
public class ClassroomSecurityBean {

    private final ClassroomRepository classroomRepository;

    public boolean isOwner(UUID classroomId, Authentication auth) {
        UserPrincipal user = (UserPrincipal) auth.getPrincipal();
        return classroomRepository.existsByIdAndTeacherId(classroomId, user.getId());
    }

    public boolean isMember(UUID classroomId, Authentication auth) {
        UserPrincipal user = (UserPrincipal) auth.getPrincipal();
        if (user.getRole() == Role.TEACHER) return isOwner(classroomId, auth);
        return classroomRepository.existsMembership(classroomId, user.getId());
    }
}
```

---

## 6. Permission Matrix

| Endpoint Pattern | PUBLIC | STUDENT | TEACHER | ADMIN |
|-----------------|--------|---------|---------|-------|
| POST /auth/login, /register, /refresh | ✅ | ✅ | ✅ | ✅ |
| GET /users/me | ❌ | ✅ | ✅ | ✅ |
| GET /classrooms | ❌ | ✅ (own) | ✅ (own) | ✅ (all) |
| POST /classrooms | ❌ | ❌ | ✅ | ✅ |
| PUT/DELETE /classrooms/:id | ❌ | ❌ | ✅ (owner) | ✅ |
| POST /classrooms/join | ❌ | ✅ | ❌ | ❌ |
| GET /classrooms/:id/posts | ❌ | ✅ (member) | ✅ (owner) | ✅ |
| POST /classrooms/:id/posts | ❌ | ✅ (member) | ✅ (owner) | ✅ |
| POST /sessions | ❌ | ❌ | ✅ (owner) | ✅ |
| POST /sessions/:id/join | ❌ | ✅ (member) | ❌ | ❌ |
| POST /sessions/:id/questions | ❌ | ❌ | ✅ (owner) | ✅ |
| POST /questions/:id/answers | ❌ | ✅ | ❌ | ❌ |
| GET /sessions/:id/dashboard | ❌ | ❌ | ✅ (owner) | ✅ |
| GET /sessions/:id/review | ❌ | ✅ (member) | ❌ | ✅ |
| GET /admin/* | ❌ | ❌ | ❌ | ✅ |

---

## 7. WS Ticket Generation (Auth bridge cho WebSocket)

```java
@Service
@RequiredArgsConstructor
public class WsTicketService {

    private static final Duration TICKET_TTL = Duration.ofSeconds(60);
    private final StringRedisTemplate redisTemplate;

    public String generateTicket(UUID userId) {
        String ticket = UUID.randomUUID().toString().replace("-", "");
        redisTemplate.opsForValue().set(
            "ws_ticket:" + ticket,
            userId.toString(),
            TICKET_TTL
        );
        return ticket;
    }

    public Optional<UUID> consumeTicket(String ticket) {
        // getAndDelete: atomic — tránh race condition nếu dùng 2 lần
        String userId = redisTemplate.opsForValue().getAndDelete("ws_ticket:" + ticket);
        return Optional.ofNullable(userId).map(UUID::fromString);
    }
}
```

Ticket được trả về trong response của `POST /sessions` và `POST /sessions/:id/join`.

---

## 8. Refresh Token Implementation

### Service

```java
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final Duration REFRESH_TTL = Duration.ofDays(30);
    private final RefreshTokenRepository tokenRepo;
    private final PasswordEncoder encoder;

    public String createRefreshToken(UUID userId) {
        String rawToken = UUID.randomUUID().toString();
        String tokenHash = encoder.encode(rawToken);   // store hash, not raw value

        tokenRepo.save(RefreshToken.builder()
            .userId(userId)
            .tokenHash(tokenHash)
            .expiresAt(Instant.now().plus(REFRESH_TTL))
            .revoked(false)
            .build());

        return rawToken;  // gửi rawToken đến client qua httpOnly cookie
    }

    public UUID validateAndConsume(String rawToken) {
        // Tìm các token chưa revoke của user và match hash
        RefreshToken token = tokenRepo.findValidToken(rawToken)
            .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (token.isExpired()) {
            throw new UnauthorizedException("Refresh token expired");
        }

        // Rotate: revoke token cũ, trả về userId để tạo token mới
        token.setRevoked(true);
        tokenRepo.save(token);
        return token.getUserId();
    }

    public void revokeAllForUser(UUID userId) {
        tokenRepo.revokeAllByUserId(userId);  // dùng khi logout hoặc đổi mật khẩu
    }
}
```

### Cookie Config trong Response

```java
private ResponseCookie buildRefreshCookie(String token) {
    return ResponseCookie.from("refresh_token", token)
        .httpOnly(true)
        .secure(true)                  // chỉ gửi qua HTTPS
        .sameSite("Strict")
        .path("/api/v1/auth")          // chỉ gửi đến /auth endpoints, không rò rỉ
        .maxAge(Duration.ofDays(30))
        .build();
}
```

---

## 9. Password Security

```java
// Registration
String hashedPassword = passwordEncoder.encode(rawPassword);  // BCrypt rounds=12

// Verify login
boolean valid = passwordEncoder.matches(rawPassword, storedHash);  // constant-time compare

// Password reset (future)
// → tạo một-lần token gửi qua email, hết hạn 1 giờ, xóa sau khi dùng
```

---

## 10. 401 / 403 JSON Response (không để Spring trả HTML mặc định)

```java
@Component
public class JwtAuthEntryPoint implements AuthenticationEntryPoint {
    @Override
    public void commence(HttpServletRequest req, HttpServletResponse res,
                         AuthenticationException ex) throws IOException {
        res.setContentType("application/json");
        res.setStatus(401);
        res.getWriter().write("""
            {"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}
        """);
    }
}

@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {
    @Override
    public void handle(HttpServletRequest req, HttpServletResponse res,
                       AccessDeniedException ex) throws IOException {
        res.setContentType("application/json");
        res.setStatus(403);
        res.getWriter().write("""
            {"success":false,"error":{"code":"FORBIDDEN","message":"Insufficient permissions"}}
        """);
    }
}
```
