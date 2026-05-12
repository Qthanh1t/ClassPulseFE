# ClassPulse — TODO & Remaining Work

> Cập nhật lần cuối: 2026-05-12  
> Phạm vi: sau khi hoàn thành tích hợp WebRTC (Sprint 4 + WebRTC extra feature)

---

## 1. Frontend — Đã sửa trong session này

| # | Vấn đề | File | Trạng thái |
|---|--------|------|------------|
| F0 | WS reconnect kích hoạt `startMedia` lần 2 → stream cũ leak, camera LED không tắt | `TeacherSessionPage.tsx`, `StudentSessionPage.tsx` | ✅ Fixed |

---

## 2. Frontend — Còn cần làm

### F1 · Screen Share (chưa implement)

**Mức độ:** Trung bình  
**Mô tả:** Nút "Chia sẻ màn hình" hiện chỉ toggle state `screenShareOn` mà không gọi `getDisplayMedia`. Badge "Đang chia sẻ" hiển thị nhưng thực tế không có gì được share.

**Cần làm (FE only):**
```typescript
// src/hooks/useLocalMedia.ts — thêm startScreenShare / stopScreenShare
const startScreenShare = async () => {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const videoSender = pcsRef.current
    .values()
    .map(e => e.pc.getSenders().find(s => s.track?.kind === 'video'))
    .filter(Boolean);
  // replaceTrack trên tất cả RTCRtpSender đang gửi video track
  for (const sender of videoSenders) {
    await sender.replaceTrack(screenStream.getVideoTracks()[0]);
  }
  screenStream.getVideoTracks()[0].onended = stopScreenShare; // user clicks "Stop Sharing"
};
```

**Lưu ý:** `replaceTrack` không cần renegotiation (cùng codec). Khi dừng share, replace lại bằng camera track.

---

### F2 · Camera state không sync tới remote peers

**Mức độ:** Trung bình (phụ thuộc backend — xem B1)  
**Mô tả:** Khi user bấm tắt camera (`toggleCamera`), track bị disabled locally, nhưng remote peers vẫn nhận black frames và `isCameraOff` trong `PeerEntry` của họ không được cập nhật → VideoTile hiển thị video đen thay vì avatar.

**Cần làm (FE):** Xử lý WS event `camera_state_changed` từ backend.

```typescript
// src/hooks/useWebRTC.ts
const updatePeerCameraState = useCallback((peerId: string, isCameraOff: boolean) => {
  const entry = pcsRef.current.get(peerId);
  if (!entry) return;
  entry.isCameraOff = isCameraOff;
  syncPeers();
}, [syncPeers]);
```

```typescript
// TeacherSessionPage / StudentSessionPage — trong toggleCamera wrapper
const handleToggleCamera = () => {
  localMedia.toggleCamera();
  wsRef.current?.sendCameraState(!localMedia.isCameraOn); // gửi WS sau khi toggle
};
```

```typescript
// handleEvent — thêm case
case 'camera_state_changed': {
  const { fromId, isCameraOff } = event.payload as { fromId: string; isCameraOff: boolean };
  rtc.updatePeerCameraState(fromId, isCameraOff);
  break;
}
```

**Blocker:** Cần backend thêm event và destination (xem B1).

---

### F3 · `teacher_joined_room` / `teacher_left_room` chưa được handle

**Mức độ:** Thấp  
**Mô tả:** Hai event type này đã định nghĩa trong `WsEventType` (`src/lib/websocket.ts`) nhưng không có case trong `handleEvent` của `StudentSessionPage`. Nếu backend emit event này khi GV vào/rời breakout room, student page sẽ bỏ qua.

**Cần làm (FE):** Thêm xử lý trong `StudentSessionPage`:
```typescript
case 'teacher_joined_room': {
  // Hiển thị thông báo "Giáo viên đã vào phòng"
  // Tùy chọn: trigger rtc.callPeer(teacherIdRef.current) nếu kết nối bị mất
  break;
}
case 'teacher_left_room': {
  // Xóa peer connection với teacher nếu cần
  break;
}
```

---

### F4 · `isFocused={isSelf}` trong breakout grid (semantic)

**Mức độ:** Thấp (UX)  
**Mô tả:** Trong breakout room grid (`StudentSessionPage`), ô video của bản thân dùng `isFocused={isSelf}` — dùng prop "focus mode" (viền tím, nền đậm) để phân biệt self với peer. Đúng về mặt thị giác nhưng sai về ngữ nghĩa so với "teacher spotlight".

**Cách sửa nhẹ:** Thêm prop riêng `isSelf` vào `VideoTile` để styling self indicator.

---

## 3. Backend — Cần thêm / kiểm tra

### B1 · WS event `camera_state_changed` *(cần thêm)*

**Ưu tiên:** Trung bình  
**Mô tả:** Khi user toggle camera, FE cần broadcast trạng thái mới tới tất cả participant để họ show/hide avatar thay vì video đen.

**Cần implement:**

**Client → Server (destination):**
```
/app/session/{sessionId}/camera-state
Body: { "isCameraOff": true }
```

**Server → Client (broadcast):**
```json
{
  "type": "camera_state_changed",
  "payload": {
    "fromId": "uuid-of-sender",
    "isCameraOff": true
  }
}
```

**Publish tới:** `/topic/session/{sessionId}` (broadcast tới toàn session)  
Cần thêm STOMP `@MessageMapping` handler và publish event qua Redis hoặc trực tiếp.

---

### B2 · Kiểm tra `teacher_joined_room` / `teacher_left_room` có được emit không

**Ưu tiên:** Thấp  
**Mô tả:** FE đã khai báo 2 event type này trong `WsEventType` (theo tài liệu `04_Realtime_Architecture.md`), nhưng chưa rõ backend có emit không khi GV `POST /breakout/rooms/{roomId}/join` hay `leave`.

**Cần kiểm tra:**
- `BreakoutController.joinRoom` → có publish `teacher_joined_room` event ra `/topic/session/{id}/room/{roomId}` không?
- Nếu có: FE cần thêm handler (xem F3)
- Nếu không: bỏ event type khỏi `WsEventType` cho clean

---

### B3 · Screen share signaling (optional)

**Ưu tiên:** Thấp  
**Mô tả:** Nếu muốn student side hiển thị badge "GV đang chia sẻ màn hình" khi teacher thực sự dùng `getDisplayMedia`, cần 1 WS event để signal trạng thái.

**Phương án đơn giản:** Tái dùng `camera_state_changed` với field bổ sung `isScreenSharing: boolean` hoặc thêm event riêng `screen_share_changed`.

**Phương án không cần WS:** FE detect phía remote qua `MediaStreamTrack.label` — screen share track thường có label chứa "screen" hoặc "window". Không cần backend.

---

## 4. Tóm tắt theo ưu tiên

| Ưu tiên | Item | Phụ thuộc |
|---------|------|-----------|
| 🔴 Trung bình | F1 · Screen share | FE only |
| 🔴 Trung bình | F2 + B1 · Camera state sync | FE + Backend |
| 🟡 Thấp | F3 · teacher_joined/left_room | FE (sau khi xác nhận B2) |
| 🟡 Thấp | B2 · Kiểm tra backend emit | Backend verify |
| 🟢 Thấp | F4 · isFocused semantic | FE only, cosmetic |
| 🟢 Thấp | B3 · Screen share signaling | FE + Backend, optional |

---

## 5. Không phải bug (by design)

- **Teacher không gọi student mới join:** Student mới join sẽ tự offer tới teacher + các peer → teacher/students answer qua `handleOffer`. Đây là đúng theo WebRTC "newcomer offers" rule.
- **ICE candidate arrive trước remote description:** Caught silently. Acceptable cho demo — ICE candidates thực tế arrive sau roundtrip signaling.
- **Breakout reconnect glare:** Đã xử lý bằng polite peer pattern (lower UUID offers) với `setTimeout(500ms)`.
