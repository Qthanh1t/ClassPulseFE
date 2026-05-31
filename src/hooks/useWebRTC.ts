import { useRef, useState, useCallback } from 'react';
import { RTC_CONFIG } from '../config/webrtc';
import type { SessionWsClient } from '../lib/websocket';

export type PeerState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface PeerEntry {
  peerId: string;
  pc: RTCPeerConnection;
  state: PeerState;
  remoteStream: MediaStream | null;
  isCameraOff: boolean;
}

export type PeerMap = Map<string, PeerEntry>;

const log = (...args: unknown[]) => console.log('[RTC]', ...args);

export function useWebRTC(
  myUserId: string,
  wsRef: React.RefObject<SessionWsClient | null>,
  localStreamRef: React.RefObject<MediaStream | null>,
) {
  const pcsRef = useRef<PeerMap>(new Map());
  const [peers, setPeers] = useState<PeerMap>(new Map());
  const iceBuf = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const syncPeers = useCallback(() => {
    setPeers(new Map(pcsRef.current));
  }, []);

  const drainIceBuf = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const buf = iceBuf.current.get(peerId);
    if (!buf?.length) return;
    log(`draining ${buf.length} buffered ICE candidates for`, peerId);
    iceBuf.current.set(peerId, []);
    for (const c of buf) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(peerId);
      if (
        existing &&
        existing.pc.connectionState !== 'closed' &&
        existing.pc.connectionState !== 'failed'
      ) {
        return existing.pc;
      }
      if (existing) {
        log(`closing stale PC (${existing.pc.connectionState}) for`, peerId);
        existing.pc.close();
        pcsRef.current.delete(peerId);
        iceBuf.current.delete(peerId);
      }

      log(`creating new PeerConnection for`, peerId, '| localTracks:', localStreamRef.current?.getTracks().length ?? 0);
      const pc = new RTCPeerConnection(RTC_CONFIG);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
          log(`  added local ${track.kind} track to PC for`, peerId);
        });
      }

      const remoteStream = new MediaStream();

      pc.ontrack = (event) => {
        log(`ontrack from ${peerId}: kind=${event.track.kind} enabled=${event.track.enabled}`);
        // Use event.track directly — avoids duplicate-add when ontrack fires per-track
        // but event.streams[0].getTracks() returns all tracks in the stream each time.
        if (!remoteStream.getTracks().includes(event.track)) {
          remoteStream.addTrack(event.track);
        }
        const entry = pcsRef.current.get(peerId);
        if (!entry) return;
        entry.remoteStream = remoteStream;
        if (event.track.kind === 'video') {
          entry.isCameraOff = event.track.muted;
          // replaceTrack(null) on sender fires mute/unmute on receiver — use this
          // as a reliable WebRTC-native fallback for camera-off detection.
          event.track.onmute = () => {
            const e = pcsRef.current.get(peerId);
            if (!e) return;
            e.isCameraOff = true;
            syncPeers();
          };
          event.track.onunmute = () => {
            const e = pcsRef.current.get(peerId);
            if (!e) return;
            e.isCameraOff = false;
            syncPeers();
          };
        }
        syncPeers();
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          log(`ICE gathering done for`, peerId);
          return;
        }
        log(`sending ICE candidate to`, peerId, '|', event.candidate.type, event.candidate.address);
        wsRef.current?.sendWebRtcIceCandidate(peerId, event.candidate);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        log(`connection state → ${state} for`, peerId);
        const entry = pcsRef.current.get(peerId);
        if (!entry) return;
        entry.state = state as PeerState;
        syncPeers();

        if (state === 'failed') {
          log(`restarting ICE for`, peerId);
          pc.restartIce();
        }
        if (state === 'closed') {
          pcsRef.current.delete(peerId);
          iceBuf.current.delete(peerId);
          syncPeers();
        }
      };

      pc.onicegatheringstatechange = () => {
        log(`ICE gathering state → ${pc.iceGatheringState} for`, peerId);
      };

      pc.oniceconnectionstatechange = () => {
        log(`ICE connection state → ${pc.iceConnectionState} for`, peerId);
      };

      pcsRef.current.set(peerId, {
        peerId,
        pc,
        state: 'new',
        remoteStream: null,
        isCameraOff: false,
      });

      return pc;
    },
    [wsRef, localStreamRef, syncPeers],
  );

  const callPeer = useCallback(
    async (peerId: string) => {
      if (peerId === myUserId) return;
      if (!wsRef.current) { log('callPeer skipped — wsRef not set'); return; }

      const existing = pcsRef.current.get(peerId);
      if (
        existing &&
        existing.pc.connectionState !== 'closed' &&
        existing.pc.connectionState !== 'failed'
      ) {
        log(`callPeer(${peerId}) skipped — already have usable PC (${existing.pc.connectionState})`);
        return;
      }

      log(`callPeer → creating offer for`, peerId);
      const pc = createPeerConnection(peerId);

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        log(`offer created & sent to`, peerId, '| sdp length:', offer.sdp?.length);
        wsRef.current.sendWebRtcOffer(peerId, pc.localDescription!.sdp);
      } catch (err) {
        console.error('[RTC] Failed to create offer for', peerId, err);
        pc.close();
        pcsRef.current.delete(peerId);
        syncPeers();
      }
    },
    [myUserId, wsRef, createPeerConnection, syncPeers],
  );

  const handleOffer = useCallback(
    async (fromId: string, sdp: string) => {
      log(`handleOffer from`, fromId, '| myUserId:', myUserId, '| sdp length:', sdp?.length);
      if (!fromId) { console.warn('[RTC] handleOffer: fromId is missing — backend must include fromId in payload'); return; }
      if (fromId === myUserId) return;

      const tryAnswer = async (pc: RTCPeerConnection) => {
        if (pc.signalingState === 'have-local-offer') {
          log(`  glare detected — rolling back local offer for`, fromId);
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription({ type: 'offer', sdp });
        await drainIceBuf(fromId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        log(`answer created & sent to`, fromId, '| sdp length:', answer.sdp?.length);
        wsRef.current?.sendWebRtcAnswer(fromId, pc.localDescription!.sdp);
      };

      let pc = createPeerConnection(fromId);
      log(`  PC signalingState for offer:`, pc.signalingState);
      try {
        await tryAnswer(pc);
      } catch (err) {
        console.error('[RTC] handleOffer failed for', fromId, '(signalingState:', pc.signalingState, ') —', err, '— retrying with fresh PC');
        // Close stale PC and retry on a clean one (handles rollback failures on cold start)
        try {
          pc.close();
          pcsRef.current.delete(fromId);
          iceBuf.current.delete(fromId);
          syncPeers();
          pc = createPeerConnection(fromId);
          await tryAnswer(pc);
        } catch (err2) {
          console.error('[RTC] handleOffer recovery also failed for', fromId, err2);
        }
      }
    },
    [myUserId, wsRef, createPeerConnection, drainIceBuf, pcsRef, iceBuf, syncPeers],
  );

  const handleAnswer = useCallback(async (fromId: string, sdp: string) => {
    log(`handleAnswer from`, fromId, '| sdp length:', sdp?.length);
    if (!fromId) { console.warn('[RTC] handleAnswer: fromId is missing'); return; }
    const entry = pcsRef.current.get(fromId);
    if (!entry) { log('handleAnswer: no PC found for', fromId); return; }
    log(`  PC signalingState for answer:`, entry.pc.signalingState);
    try {
      if (entry.pc.signalingState === 'have-local-offer') {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp });
        await drainIceBuf(fromId, entry.pc);
        log(`answer set successfully for`, fromId);
      } else {
        log(`handleAnswer skipped — signalingState is ${entry.pc.signalingState}`);
      }
    } catch (err) {
      console.error('[RTC] Failed to set answer from', fromId, err);
    }
  }, [drainIceBuf]);

  const handleIceCandidate = useCallback(async (fromId: string, candidate: RTCIceCandidateInit) => {
    if (!fromId) { console.warn('[RTC] handleIceCandidate: fromId is missing'); return; }
    const entry = pcsRef.current.get(fromId);
    if (!entry || entry.pc.connectionState === 'closed') return;

    if (!entry.pc.remoteDescription) {
      log(`buffering ICE candidate from ${fromId} (no remote description yet)`);
      const buf = iceBuf.current.get(fromId) ?? [];
      buf.push(candidate);
      iceBuf.current.set(fromId, buf);
      return;
    }

    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // stale or invalid candidate
    }
  }, []);

  const closePeer = useCallback((peerId: string) => {
    const entry = pcsRef.current.get(peerId);
    if (!entry) return;
    log(`closing peer`, peerId);
    entry.pc.close();
    pcsRef.current.delete(peerId);
    iceBuf.current.delete(peerId);
    syncPeers();
  }, [syncPeers]);

  const closeAllPeers = useCallback(() => {
    log(`closing all ${pcsRef.current.size} peers`);
    pcsRef.current.forEach((entry) => entry.pc.close());
    pcsRef.current.clear();
    iceBuf.current.clear();
    syncPeers();
  }, [syncPeers]);

  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
    log(`replaceVideoTrack across ${pcsRef.current.size} PCs`);
    const tasks: Promise<void>[] = [];
    pcsRef.current.forEach(({ pc, peerId }) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        log(`  replacing video sender for`, peerId);
        tasks.push(sender.replaceTrack(newTrack));
      }
    });
    await Promise.all(tasks);
  }, []);

  const updatePeerCameraState = useCallback((peerId: string, isCameraOff: boolean) => {
    const entry = pcsRef.current.get(peerId);
    if (!entry) return;
    entry.isCameraOff = isCameraOff;
    syncPeers();
  }, [syncPeers]);

  const attachLocalStream = useCallback((stream: MediaStream) => {
    log(`attachLocalStream: adding tracks to ${pcsRef.current.size} existing PCs`);
    pcsRef.current.forEach(({ pc, peerId }) => {
      const hasTracks = pc.getSenders().some((s) => s.track !== null);
      if (!hasTracks) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          log(`  added ${track.kind} track to PC for`, peerId);
        });
      }
    });
  }, []);

  return {
    peers,
    pcsRef,
    callPeer,
    closePeer,
    closeAllPeers,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    attachLocalStream,
    replaceVideoTrack,
    updatePeerCameraState,
  };
}
