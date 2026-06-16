# Kế hoạch migration WebRTC mesh → LiveKit SFU

> Mục tiêu: thay **media plane** từ full-mesh P2P (không scale quá ~6 người) sang **LiveKit SFU**
> để phòng chính chạy tốt lớp 30 HS. **Toàn bộ realtime nghiệp vụ (Q&A, chat, presence,
> raise hand, breakout state, dashboard) GIỮ NGUYÊN trên STOMP.**

## Nguyên tắc xuyên suốt

1. **LiveKit chỉ thay media**, không thay signaling nghiệp vụ. Các event STOMP
   (`student_presence`, `breakout_started`, `focus_changed`, `teacher_joined_room`, …)
   vẫn là nguồn sự thật về "ai ở phòng nào". LiveKit chỉ lo việc truyền/nhận video-audio.
2. **`participant.identity` = `userId`** → giữ nguyên mental model `peers.get(userId)`.
3. Làm trên **git branch riêng** (`feat/livekit`), KHÔNG dùng runtime flag để khỏi phải
   maintain 2 đường wiring trong session page. Branch cũ là fallback.
4. Adapter hook `useLiveKitRoom` **expose đúng shape** mà UI đang tiêu thụ
   (`Map<id, { remoteStream, isCameraOff, isMuted }>`) → `VideoTile` gần như không đổi.

## Cái sẽ bị XÓA (không phải viết lại)

- `src/hooks/useWebRTC.ts` (toàn bộ): `callPeer`/`handleOffer`/`handleAnswer`/
  `handleIceCandidate`/`closePeer`/`closeAllPeers`, glare rollback, ICE buffering, polite-peer.
- `src/config/webrtc.ts` ICE/TURN thủ công (LiveKit tự lo ICE; coturn có thể giữ cho LiveKit dùng).
- WS layer: 3 method `sendWebRtcOffer/Answer/IceCandidate` + 3 event type
  `webrtc_offer/answer/ice_candidate` + relay backend tương ứng.
- Trong 2 session page: mọi điều phối `callPeer/closePeer/handleOffer/...` (~40 call site)
  → thay bằng `room.connect(token)` + event-driven.

---

## Phase 0 — Hạ tầng LiveKit (de-risk trước) — ~0.5 ngày

**0.1** Thêm service LiveKit vào `docker-compose` (dev mode nhanh nhất):
```yaml
livekit:
  image: livekit/livekit-server:latest
  command: --dev --bind 0.0.0.0
  ports: ["7880:7880", "7881:7881", "7882:7882/udp"]
  # --dev tạo sẵn api key/secret: devkey / secret
```
Production sau này: file `livekit.yaml` với key/secret thật + `rtc.use_external_ip` / `node_ip`
(quan trọng khi test 2 thiết bị LAN — set IP máy host).

**0.2** Env mới:
- Frontend `.env`: `VITE_LIVEKIT_URL=ws://localhost:7880` (LAN: `ws://<host-ip>:7880`).
- Vite proxy: KHÔNG cần proxy LiveKit (kết nối trực tiếp tới :7880), nhưng có thể thêm để
  giữ same-origin nếu muốn. PoC dùng trực tiếp.
- Backend: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.

**0.3 Checkpoint:** `docker compose up livekit` chạy được, mở `http://localhost:7880` trả 200.

---

## Phase 1 — Backend token endpoint — ~0.5 ngày

LiveKit token = JWT ký bằng `API_SECRET`, claims gồm `video` grant. Hai cách:
- **Cách A (khuyên):** lib `io.livekit:livekit-server` (AccessToken builder).
- **Cách B:** tự gen JWT bằng jjwt (đã có sẵn trong dự án cho auth) với claims documented.

**1.1** Endpoint: `POST /sessions/{sessionId}/livekit-token`
- Body/param: `roomName` (mặc định `session-{sessionId}`; breakout: `session-{sessionId}-room-{breakoutRoomId}`).
- Xác thực: dùng JWT auth hiện có (Bearer), lấy `userId`, kiểm tra user thuộc session.
- Trả về:
```json
{ "token": "<jwt>", "url": "ws://...", "identity": "<userId>" }
```
- Grant: `identity = userId`, `name = userName`, `metadata = {avatarColor, role}`,
  `video = { roomJoin: true, room: <roomName>, canPublish: true, canSubscribe: true }`.

**1.2** (Tùy chọn, sau) Webhook LiveKit → backend để đồng bộ presence chuẩn xác. **PoC bỏ qua** —
presence vẫn dựa trên STOMP như hiện tại.

**1.3 Checkpoint:** gọi endpoint bằng curl/Postman, decode JWT thấy đúng grant.

---

## Phase 2 — Adapter hook `useLiveKitRoom` (frontend) — ~1 ngày

**2.1** `npm i livekit-client`

**2.2** Tạo `src/hooks/useLiveKitRoom.ts` — **giữ interface tương thích** để UI ít đổi:
```ts
interface LkPeer { identity: string; remoteStream: MediaStream | null;
                   isCameraOff: boolean; isMuted: boolean; name?: string; }
// trả về:
{
  peers: Map<string, LkPeer>,        // ⇄ thay rtc.peers
  connect: (roomName: string) => Promise<void>,  // lấy token rồi room.connect
  disconnect: () => Promise<void>,   // ⇄ thay closeAllPeers
  publishCamera: (enabled: boolean) => Promise<void>,
  publishMic: (enabled: boolean) => Promise<void>,
  startScreenShare / stopScreenShare,
  localScreenStream,                 // để hiện tile screen share
}
```
**Chi tiết map sự kiện LiveKit → peers map (mirror logic `ontrack`/`onmute` cũ):**
- `RoomEvent.TrackSubscribed (track, pub, participant)` → tạo/lấy `MediaStream` theo
  `participant.identity`, `stream.addTrack(track.mediaStreamTrack)`.
- `RoomEvent.TrackUnsubscribed` → remove track.
- `RoomEvent.TrackMuted/TrackUnmuted` (source=Camera) → set `isCameraOff` (thay `onmute/onunmute`).
- `RoomEvent.ParticipantConnected/Disconnected` → add/remove entry.
- `RoomEvent.ActiveSpeakersChanged` → (sau) dùng cho active-speaker UI.

**2.3** Bật tối ưu scale 30 người ngay trong `new Room(...)`:
```ts
new Room({ adaptiveStream: true, dynacast: true,
           videoCaptureDefaults: { resolution: VideoPresets.h720.resolution } })
```
- `adaptiveStream`: tự giảm/ngừng nhận video của tile không hiển thị → **chìa khóa cho 30 HS**.
- `dynacast`: server ngừng forward layer không ai xem.
- Đây là thứ mesh không bao giờ làm được.

**2.4** Local media: LiveKit tự quản lý local track. **Đánh giá** giữ hay bỏ `useLocalMedia`:
- Phương án gọn: dùng `room.localParticipant.setCameraEnabled / setMicrophoneEnabled /
  setScreenShareEnabled` thay cho `getUserMedia` thủ công. `useLocalMedia` có thể rút gọn
  hoặc bỏ. Quyết định khi code (xem rủi ro: màn hình chờ camera trước khi join).

**2.5 Checkpoint:** test 2 tab cùng `useLiveKitRoom` vào `session-X`, thấy video của nhau.

---

## Phase 3 — Migrate PHÒNG CHÍNH 2 session page — ~1.5 ngày

> Tạm **disable breakout** ở phase này để cô lập rủi ro; breakout làm ở Phase 4.

**3.1 `StudentSessionPage.tsx`:**
- Thay `const rtc = useWebRTC(...)` → `const rtc = useLiveKitRoom(...)`.
- Init flow: bỏ `callPeer(teacher)/callPeer(HS)` trong `onConnected`; chỉ cần
  `rtc.connect('session-{sessionId}')` sau khi join session. STOMP `onConnected` vẫn giữ
  cho presence/Q&A.
- Render: `rtc.peers.get(teacherId)?.remoteStream` → giữ nguyên (interface tương thích).
- Camera/mic toggle → `rtc.publishCamera/publishMic`.
- Screen share: **thay đổi hành vi** — LiveKit screen share là track riêng (không replace
  camera). Hiện tile screen share của GV bằng track source=ScreenShare. Cập nhật chỗ render
  tile GV để ưu tiên screen track nếu có.

**3.2 `TeacherSessionPage.tsx`:** tương tự — bỏ điều phối `callPeer` theo `student_presence`;
chỉ `connect` phòng chính. GV publish camera/mic/screen.

**3.3** WS layer: tạm để 3 method/event webrtc; xóa hẳn ở Phase 5 sau khi breakout xong.

**3.4 Checkpoint (quan trọng nhất):** 1 GV + 5–10 tab HS vào phòng chính. Kiểm:
video 2 chiều, camera on/off, mic mute, screen share, **reload giữa phiên** (LiveKit auto
reconnect — không còn vũ đạo closePeer thủ công). Thử **20–30 tab** để xác nhận scale.

---

## Phase 4 — Migrate Breakout + Focus/Spotlight — ~1.5 ngày

**4.1 Breakout = đổi LiveKit room.** Khi nhận STOMP `breakout_started`:
- HS: `rtc.disconnect()` phòng chính → `rtc.connect('session-{sid}-room-{breakoutRoomId}')`.
- GV joinRoom: `connect` tới room breakout đó; rời thì `connect` lại phòng chính.
- `breakout_ended`: tất cả `connect` lại `session-{sid}`.
- STOMP `subscribeRoom`/`teacher_joined_room`/`teacher_left_room` **giữ nguyên** để biết phải
  connect room LiveKit nào. Token breakout xin riêng (Phase 1 đã hỗ trợ `roomName`).
- **Lợi:** xóa toàn bộ logic "closePeer trước callPeer khi GV reload" — LiveKit room
  reconnect tự xử lý.

**4.2 Focus/Spotlight 1-1.** Trong phòng chính (cùng 1 LiveKit room), spotlight chỉ là
**đổi layout UI** (phóng to tile HS được focus). Không cần đổi media. Nếu muốn tiết kiệm
băng thông: dùng `publication.setSubscribed(false)` cho các track không hiển thị —
nhưng `adaptiveStream` đã lo phần lớn. Giữ đơn giản: chỉ đổi layout.

**4.3** Lọc tile HS offline trong breakout: vẫn lọc theo presence STOMP như cũ
(`myRoom.students.filter` theo online) — không đổi.

**4.4 Checkpoint:** chia breakout, GV vào/ra phòng nhóm, HS reload giữa breakout, kết thúc
breakout về phòng chính. Spotlight GV→HS.

---

## Phase 5 — Dọn dẹp + tài liệu — ~0.5 ngày

**5.1** Xóa `useWebRTC.ts`, `config/webrtc.ts` (nếu coturn không còn dùng), 3 method WS
`sendWebRtc*` + 3 event type + relay backend `/webrtc/offer|answer|ice-candidate`.
**5.2** Cập nhật `CLAUDE.md`: mục WebRTC → LiveKit; routing/services/env mới; bỏ phần
mô tả mesh signaling.
**5.3** Cập nhật `.env.example`, `docker-compose`, README chạy LiveKit.
**5.4** Cập nhật memory (`design`/`project`) nếu cần.

---

## Bảng file đụng tới

| File | Hành động |
|---|---|
| `docker-compose.yml` | + service livekit |
| Backend `SessionController` + LiveKit token service | + endpoint token |
| `.env` / `.env.example` | + `VITE_LIVEKIT_URL`, backend keys |
| `src/services/session.service.ts` (hoặc mới `livekit.service.ts`) | + `getLiveKitToken(sessionId, roomName)` |
| `src/hooks/useLiveKitRoom.ts` | **MỚI** (adapter) |
| `src/hooks/useWebRTC.ts` | **XÓA** (Phase 5) |
| `src/config/webrtc.ts` | **XÓA** (Phase 5) |
| `src/hooks/useLocalMedia.ts` | rút gọn/bỏ (đánh giá ở 2.4) |
| `src/lib/websocket.ts` | xóa 3 method + 3 event webrtc (Phase 5) |
| `src/pages/session/StudentSessionPage.tsx` | rewire media (Phase 3, 4) |
| `src/pages/session/TeacherSessionPage.tsx` | rewire media (Phase 3, 4) |
| `src/components/session/VideoTile.tsx` | gần như không đổi (nhận MediaStream) |
| `CLAUDE.md` | cập nhật (Phase 5) |

## Ước lượng & rủi ro

- **Tổng ~5 ngày làm việc** (thành thạo). Rủi ro lớn nhất KHÔNG ở code mà ở:
  (a) cấu hình LiveKit để reachable khi test đa thiết bị LAN (`node_ip`/external IP, cổng UDP),
  (b) re-test toàn bộ flow breakout/spotlight/screen-share.
- Screen share đổi ngữ nghĩa (track riêng thay vì replace) → cần sửa UI tile GV.
- Quyết định giữ/bỏ `useLocalMedia` ảnh hưởng màn "chờ camera" trước khi vào phòng.

## Thứ tự an toàn (tóm tắt)

Phase 0 (infra) → 1 (token) → 2 (adapter PoC 2 tab) → 3 (phòng chính, disable breakout, test 30 tab)
→ 4 (breakout + spotlight) → 5 (dọn dẹp + docs). Mỗi phase có checkpoint test trước khi sang phase sau.
