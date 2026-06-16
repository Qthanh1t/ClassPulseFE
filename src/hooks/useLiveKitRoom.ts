import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type LocalTrackPublication,
  type TrackPublication,
  type Participant,
} from 'livekit-client';
import { livekitService } from '../services/livekit.service';

const log = (...args: unknown[]) => console.log('[LiveKit]', ...args);

/**
 * Peer hiển thị trên UI. Giữ ĐÚNG shape mà VideoTile/session pages đang tiêu thụ
 * (`remoteStream`, `isCameraOff`) để thay `useWebRTC` mà gần như không sửa render.
 */
export interface LkPeer {
  identity: string;
  remoteStream: MediaStream | null;
  isCameraOff: boolean;
  isMuted: boolean;        // mic tắt
  isScreenShare: boolean;  // video đang là chia sẻ màn hình
  /** Luôn 'connected' khi entry tồn tại — tương thích badge LIVE cũ (peer.state === 'connected'). */
  state: 'connected';
  name?: string;
}

export type LkPeerMap = Map<string, LkPeer>;

/** Trạng thái track nội bộ cho mỗi remote participant — nguồn để dựng lại LkPeer. */
interface PeerInternal {
  participant: RemoteParticipant;
  cameraTrack: RemoteTrack | null;
  screenTrack: RemoteTrack | null;
  audioTrack: RemoteTrack | null;
  cameraMuted: boolean;
  micMuted: boolean;
}

/**
 * Adapter LiveKit SFU thay thế mesh `useWebRTC`. Toàn bộ vũ đạo SDP/ICE thủ công biến mất —
 * LiveKit lo signaling; ta chỉ map sự kiện room → `peers` map + quản lý local media.
 *
 * adaptiveStream + dynacast: tối ưu băng thông cho lớp đông (nền tảng để scale 30 HS).
 */
export function useLiveKitRoom() {
  const roomRef = useRef<Room | null>(null);
  const internalRef = useRef<Map<string, PeerInternal>>(new Map());
  const peersRef = useRef<LkPeerMap>(new Map());
  const [peers, setPeers] = useState<LkPeerMap>(new Map());

  const [connected, setConnected] = useState(false);
  const currentRoomNameRef = useRef<string | null>(null);

  // Local media — hook tự sở hữu (thay useLocalMedia ở luồng session)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const cameraOnRef = useRef(true);
  const micOnRef = useRef(true);

  const sync = useCallback(() => setPeers(new Map(peersRef.current)), []);

  // ── Dựng lại LkPeer từ track nội bộ ──────────────────────────────
  const rebuildPeer = useCallback((identity: string) => {
    const internal = internalRef.current.get(identity);
    if (!internal) {
      peersRef.current.delete(identity);
      sync();
      return;
    }
    const hasScreen = !!internal.screenTrack;
    const videoTrack = internal.screenTrack ?? internal.cameraTrack;
    const stream = new MediaStream();
    if (videoTrack?.mediaStreamTrack) stream.addTrack(videoTrack.mediaStreamTrack);
    if (internal.audioTrack?.mediaStreamTrack) stream.addTrack(internal.audioTrack.mediaStreamTrack);

    peersRef.current.set(identity, {
      identity,
      remoteStream: stream.getTracks().length ? stream : null,
      // Màn hình chia sẻ luôn hiện; camera tắt khi không có track hoặc đang mute
      isCameraOff: !hasScreen && (internal.cameraTrack === null || internal.cameraMuted),
      isMuted: internal.micMuted,
      isScreenShare: hasScreen,
      state: 'connected',
      name: internal.participant.name || undefined,
    });
    sync();
  }, [sync]);

  const ensureInternal = useCallback((participant: RemoteParticipant): PeerInternal => {
    let internal = internalRef.current.get(participant.identity);
    if (!internal) {
      internal = {
        participant,
        cameraTrack: null,
        screenTrack: null,
        audioTrack: null,
        cameraMuted: false,
        micMuted: false,
      };
      internalRef.current.set(participant.identity, internal);
    } else {
      internal.participant = participant;
    }
    return internal;
  }, []);

  // ── Local media helpers ───────────────────────────────────────────
  const refreshLocalCameraStream = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.videoTrack?.mediaStreamTrack;
    if (track) {
      const ms = new MediaStream();
      ms.addTrack(track);
      setLocalStream(ms);
    } else {
      setLocalStream(null);
    }
  }, []);

  const refreshLocalScreenStream = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const track = pub?.videoTrack?.mediaStreamTrack;
    if (track) {
      const ms = new MediaStream();
      ms.addTrack(track);
      setLocalScreenStream(ms);
      setIsScreenSharing(true);
    } else {
      setLocalScreenStream(null);
      setIsScreenSharing(false);
    }
  }, []);

  // ── Wire room events ──────────────────────────────────────────────
  const wireEvents = useCallback((room: Room) => {
    const onSubscribed = (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
      log(`TrackSubscribed ${track.kind}/${pub.source} from ${p.identity} | mst.readyState=${track.mediaStreamTrack.readyState} muted=${pub.isMuted}`);
      const internal = ensureInternal(p);
      if (pub.source === Track.Source.ScreenShare) internal.screenTrack = track;
      else if (track.kind === Track.Kind.Audio) { internal.audioTrack = track; internal.micMuted = pub.isMuted; }
      else { internal.cameraTrack = track; internal.cameraMuted = pub.isMuted; }
      rebuildPeer(p.identity);
    };
    const onUnsubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      const internal = internalRef.current.get(p.identity);
      if (!internal) return;
      if (internal.screenTrack === track) internal.screenTrack = null;
      else if (internal.cameraTrack === track) internal.cameraTrack = null;
      else if (internal.audioTrack === track) internal.audioTrack = null;
      rebuildPeer(p.identity);
    };
    const onMuteChange = (pub: TrackPublication, p: Participant, muted: boolean) => {
      if (p.isLocal) return;
      const internal = internalRef.current.get(p.identity);
      if (!internal) return;
      if (pub.source === Track.Source.Camera) internal.cameraMuted = muted;
      else if (pub.source === Track.Source.Microphone) internal.micMuted = muted;
      rebuildPeer(p.identity);
    };

    room
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.TrackMuted, (pub: TrackPublication, p: Participant) => onMuteChange(pub, p, true))
      .on(RoomEvent.TrackUnmuted, (pub: TrackPublication, p: Participant) => onMuteChange(pub, p, false))
      .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        log('ParticipantConnected:', p.identity);
        ensureInternal(p);
        rebuildPeer(p.identity);
      })
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        internalRef.current.delete(p.identity);
        peersRef.current.delete(p.identity);
        sync();
      })
      .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.Camera) refreshLocalCameraStream();
        else if (pub.source === Track.Source.ScreenShare) refreshLocalScreenStream();
      })
      .on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.Camera) refreshLocalCameraStream();
        else if (pub.source === Track.Source.ScreenShare) refreshLocalScreenStream();
      })
      .on(RoomEvent.Disconnected, (reason) => {
        log('Disconnected, reason:', reason);
        setConnected(false);
      })
      // ── Chẩn đoán media/ICE ──
      .on(RoomEvent.ConnectionStateChanged, (state) => log('ConnectionState →', state))
      .on(RoomEvent.SignalConnected, () => log('SignalConnected (signaling OK)'))
      .on(RoomEvent.MediaDevicesError, (e) => log('MediaDevicesError:', e));
  }, [ensureInternal, rebuildPeer, sync, refreshLocalCameraStream, refreshLocalScreenStream]);

  // ── Connect / switch room ─────────────────────────────────────────
  const connect = useCallback(async (sessionId: string, roomName: string) => {
    // Đóng room cũ (đổi phòng breakout) trước khi mở phòng mới
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    internalRef.current.clear();
    peersRef.current.clear();
    sync();

    const { token, url } = await livekitService.getToken(sessionId, roomName);
    // adaptiveStream/dynacast TẮT: chúng dựa vào track.attach() để biết track nào đang hiển thị.
    // Ta gán srcObject thủ công trong VideoTile (không attach) → bật adaptiveStream sẽ khiến
    // LiveKit tạm dừng track "không ai xem" → tile đen. Bật lại sau khi chuyển VideoTile sang track.attach().
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
    });
    wireEvents(room);
    roomRef.current = room;
    currentRoomNameRef.current = roomName;

    log('connecting to room', roomName);
    await room.connect(url, token);
    setConnected(true);

    // Publish local media theo trạng thái mong muốn — không có camera/mic vẫn vào phòng được
    try {
      await room.localParticipant.setMicrophoneEnabled(micOnRef.current);
      await room.localParticipant.setCameraEnabled(cameraOnRef.current);
    } catch (err) {
      log('publish local media failed (vẫn ở trong phòng, không có video/audio gửi đi):', err);
    }
    refreshLocalCameraStream();

    // Participant đã ở trong phòng trước khi ta vào: tạo entry + nạp track đã subscribe
    room.remoteParticipants.forEach((p) => {
      ensureInternal(p);
      p.trackPublications.forEach((pub) => {
        if (pub.isSubscribed && pub.track) {
          const internal = ensureInternal(p);
          if (pub.source === Track.Source.ScreenShare) internal.screenTrack = pub.track;
          else if (pub.kind === Track.Kind.Audio) { internal.audioTrack = pub.track; internal.micMuted = pub.isMuted; }
          else { internal.cameraTrack = pub.track; internal.cameraMuted = pub.isMuted; }
        }
      });
      rebuildPeer(p.identity);
    });
  }, [wireEvents, sync, ensureInternal, rebuildPeer, refreshLocalCameraStream]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    internalRef.current.clear();
    peersRef.current.clear();
    currentRoomNameRef.current = null;
    setConnected(false);
    setLocalStream(null);
    setLocalScreenStream(null);
    setIsScreenSharing(false);
    sync();
  }, [sync]);

  // ── Local controls ────────────────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    const next = !cameraOnRef.current;
    cameraOnRef.current = next;
    setIsCameraOn(next);
    if (room) {
      await room.localParticipant.setCameraEnabled(next);
      refreshLocalCameraStream();
    }
  }, [refreshLocalCameraStream]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    const next = !micOnRef.current;
    micOnRef.current = next;
    setIsMicOn(next);
    if (room) await room.localParticipant.setMicrophoneEnabled(next);
  }, []);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(true);
    refreshLocalScreenStream();
  }, [refreshLocalScreenStream]);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setScreenShareEnabled(false);
    refreshLocalScreenStream();
  }, [refreshLocalScreenStream]);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => { void roomRef.current?.disconnect(); };
  }, []);

  return {
    peers,
    connected,
    currentRoomName: currentRoomNameRef,
    connect,
    disconnect,
    // local media
    localStream,
    localScreenStream,
    isCameraOn,
    isMicOn,
    isScreenSharing,
    toggleCamera,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  };
}
