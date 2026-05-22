# ClassPulse — TODO & Remaining Work

> Cập nhật lần cuối: 2026-05-23  
> Phạm vi: sau khi hoàn thành tích hợp WebRTC (Sprint 4 + WebRTC extra feature)

---

## 1. Đã sửa / đã xác nhận

| # | Vấn đề | Trạng thái |
|---|--------|------------|
| F0 | WS reconnect kích hoạt `startMedia` lần 2 → stream cũ leak, camera LED không tắt | ✅ Fixed (FE) |
| B1 | WS event `camera_state_changed` chưa có backend | ✅ Done — `CameraStateWsController` + `CameraStateRequest` đã thêm vào backend |
| B2 | Không chắc backend có emit `teacher_joined_room` / `teacher_left_room` không | ✅ Confirmed — `BreakoutController.joinRoom/leaveRoom` đã broadcast đúng |
| — | `session_ended` broadcast chưa được gọi dù có comment TODO | ✅ Fixed — `SessionController.end()` giờ broadcast `session_ended {sessionId, endedAt}` |

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
  const videoSenders = [...pcsRef.current.values()]
    .map(e => e.pc.getSenders().find(s => s.track?.kind === 'video'))
    .filter(Boolean);
  for (const sender of videoSenders) {
    await sender.replaceTrack(screenStream.getVideoTracks()[0]);
  }
  screenStream.getVideoTracks()[0].onended = stopScreenShare;
};
```

**Lưu ý:** `replaceTrack` không cần renegotiation (cùng codec). Khi dừng share, replace lại bằng camera track.

---

### F2 · Camera state sync tới remote peers

**Mức độ:** Trung bình  
**Backend:** ✅ Đã có — `POST /app/session/{id}/camera-state`, broadcast `camera_state_changed`  
**Mô tả:** Khi user bấm tắt camera (`toggleCamera`), track bị disabled locally nhưng remote peers vẫn nhận black frames và `isCameraOff` trong `PeerEntry` của họ không được cập nhật → VideoTile hiển thị video đen thay vì avatar.

**Bước 1 — Gửi WS khi toggle camera** (`TeacherSessionPage.tsx` / `StudentSessionPage.tsx`):
```typescript
const handleToggleCamera = () => {
  localMedia.toggleCamera();
  // gửi state mới — isCameraOff = true khi vừa tắt
  stompClientRef.current?.publish({
    destination: `/app/session/${sessionId}/camera-state`,
    body: JSON.stringify({ isCameraOff: localMedia.isCameraOn }), // isCameraOn còn chưa flip
  });
};
```

**Bước 2 — Thêm `updatePeerCameraState` vào `useWebRTC`** (`src/hooks/useWebRTC.ts`):
```typescript
const updatePeerCameraState = useCallback((peerId: string, isCameraOff: boolean) => {
  const entry = pcsRef.current.get(peerId);
  if (!entry) return;
  entry.isCameraOff = isCameraOff;
  syncPeers();
}, [syncPeers]);
```

**Bước 3 — Handle event** (trong `handleEvent` của cả hai session page):
```typescript
case 'camera_state_changed': {
  const { fromId, isCameraOff } = event.payload as { fromId: string; isCameraOff: boolean };
  rtc.updatePeerCameraState(fromId, isCameraOff);
  break;
}
```

**Lưu ý:** `event.payload.fromId` là UUID string. STOMP body gửi đúng format `{ "isCameraOff": true }`.

---

### F3 · `teacher_joined_room` / `teacher_left_room` chưa được handle

**Mức độ:** Thấp  
**Backend:** ✅ Đã emit — broadcast tới `/topic/session/{id}/room/{roomId}`  
**Payload nhận được:**
```typescript
// teacher_joined_room
{ roomId: string; roomName: string }

// teacher_left_room
{ roomId: string }
```

**Cần làm — thêm case trong `handleEvent` của `StudentSessionPage`:**
```typescript
case 'teacher_joined_room': {
  const { roomName } = event.payload as { roomId: string; roomName: string };
  // Hiển thị toast/banner "Giáo viên đã vào phòng"
  showNotification(`Giáo viên đã vào ${roomName}`);
  // Tùy chọn: nếu WebRTC connection với teacher bị mất → gọi lại
  // rtc.callPeer(teacherIdRef.current);
  break;
}
case 'teacher_left_room': {
  // Không cần làm gì thêm — WebRTC connection tự close khi teacher rời
  break;
}
```

---

### F4 · `session_ended` — redirect học sinh ra khỏi lớp

**Mức độ:** Cao (bug UX đã fix phía backend, cần wire FE)  
**Backend:** ✅ Đã fix — `SessionController.end()` broadcast `session_ended { sessionId, endedAt }`  
**Mô tả:** Học sinh vẫn ở màn hình session dù teacher đã kết thúc vì chưa handle event này.

**Cần làm — thêm case trong `handleEvent` của `StudentSessionPage`:**
```typescript
case 'session_ended': {
  // Dọn dẹp WebRTC + media trước khi navigate
  rtc.cleanup();
  localMedia.stopAll();
  navigate(`/classrooms/${classroomId}`, {
    state: { message: 'Buổi học đã kết thúc' },
  });
  break;
}
```

**Lưu ý:** `TeacherSessionPage` không cần handle — GV là người gọi end, đã navigate trước đó.

---

### F5 · `isFocused={isSelf}` trong breakout grid (semantic)

**Mức độ:** Thấp (UX)  
**Mô tả:** Trong breakout room grid (`StudentSessionPage`), ô video của bản thân dùng `isFocused={isSelf}` — dùng prop "focus mode" (viền tím, nền đậm) để phân biệt self với peer. Đúng về mặt thị giác nhưng sai ngữ nghĩa so với "teacher spotlight".

**Cách sửa:** Thêm prop riêng `isSelf` vào `VideoTile` để styling self indicator.

---

## 3. Backend — Không còn việc cần làm

| Item | Trạng thái |
|------|------------|
| B1 `camera_state_changed` | ✅ Done |
| B2 `teacher_joined/left_room` | ✅ Confirmed emit |
| B3 Screen share signaling | ⏭️ Skip — FE detect qua `MediaStreamTrack.label` |

---

## 4. Tóm tắt theo ưu tiên

| Ưu tiên | Item | Phụ thuộc |
|---------|------|-----------|
| 🔴 Cao | **F4** · `session_ended` redirect HS | FE only — backend đã fix |
| 🔴 Trung bình | **F1** · Screen share | FE only |
| 🔴 Trung bình | **F2** · Camera state sync | FE only — backend đã có |
| 🟡 Thấp | **F3** · teacher_joined/left_room handler | FE only — backend đã emit |
| 🟢 Thấp | **F5** · isFocused semantic | FE only, cosmetic |

---

## 5. Không phải bug (by design)

- **Teacher không gọi student mới join:** Student mới join sẽ tự offer tới teacher + các peer → teacher/students answer qua `handleOffer`. Đúng theo WebRTC "newcomer offers" rule.
- **ICE candidate arrive trước remote description:** Caught silently. Acceptable cho demo — ICE candidates thực tế arrive sau roundtrip signaling.
- **Breakout reconnect glare:** Đã xử lý bằng polite peer pattern (lower UUID offers) với `setTimeout(500ms)`.
- **HS detect session bắt đầu:** Không có WS event `session_started` — HS poll REST `GET /classrooms/{id}/sessions` để detect active session. Thiết kế đúng vì HS chưa subscribe WS topic khi session chưa join.
