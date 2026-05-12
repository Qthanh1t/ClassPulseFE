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

export function useWebRTC(
  myUserId: string,
  wsRef: React.RefObject<SessionWsClient | null>,
  localStreamRef: React.RefObject<MediaStream | null>,
) {
  const pcsRef = useRef<PeerMap>(new Map());
  const [peers, setPeers] = useState<PeerMap>(new Map());

  const syncPeers = useCallback(() => {
    setPeers(new Map(pcsRef.current));
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing.pc;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local tracks if media is already running
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      const remoteStream = new MediaStream();

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track));
        const entry = pcsRef.current.get(peerId);
        if (entry) {
          entry.remoteStream = remoteStream;
          entry.isCameraOff = !event.track.enabled;
          syncPeers();
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        wsRef.current?.sendWebRtcIceCandidate(peerId, event.candidate);
      };

      pc.onconnectionstatechange = () => {
        const entry = pcsRef.current.get(peerId);
        if (!entry) return;
        entry.state = pc.connectionState as PeerState;
        syncPeers();

        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
        if (pc.connectionState === 'closed') {
          pcsRef.current.delete(peerId);
          syncPeers();
        }
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

  // Call a peer (we are the caller / offerer)
  const callPeer = useCallback(
    async (peerId: string) => {
      if (pcsRef.current.has(peerId) || peerId === myUserId) return;
      if (!wsRef.current) return;

      const pc = createPeerConnection(peerId);

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        wsRef.current.sendWebRtcOffer(peerId, pc.localDescription!.sdp);
      } catch (err) {
        console.error('[WebRTC] Failed to create offer for', peerId, err);
        pc.close();
        pcsRef.current.delete(peerId);
        syncPeers();
      }
    },
    [myUserId, wsRef, createPeerConnection, syncPeers],
  );

  // Handle incoming offer (we are the callee / answerer)
  const handleOffer = useCallback(
    async (fromId: string, sdp: string) => {
      if (fromId === myUserId) return;

      const pc = createPeerConnection(fromId);

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.sendWebRtcAnswer(fromId, pc.localDescription!.sdp);
      } catch (err) {
        console.error('[WebRTC] Failed to handle offer from', fromId, err);
      }
    },
    [myUserId, wsRef, createPeerConnection],
  );

  // Handle incoming answer
  const handleAnswer = useCallback(async (fromId: string, sdp: string) => {
    const entry = pcsRef.current.get(fromId);
    if (!entry) return;
    try {
      if (entry.pc.signalingState === 'have-local-offer') {
        await entry.pc.setRemoteDescription({ type: 'answer', sdp });
      }
    } catch (err) {
      console.error('[WebRTC] Failed to set answer from', fromId, err);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (fromId: string, candidate: RTCIceCandidateInit) => {
    const entry = pcsRef.current.get(fromId);
    if (!entry || entry.pc.connectionState === 'closed') return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore stale or invalid candidates
    }
  }, []);

  const closePeer = useCallback((peerId: string) => {
    const entry = pcsRef.current.get(peerId);
    if (!entry) return;
    entry.pc.close();
    pcsRef.current.delete(peerId);
    syncPeers();
  }, [syncPeers]);

  const closeAllPeers = useCallback(() => {
    pcsRef.current.forEach((entry) => entry.pc.close());
    pcsRef.current.clear();
    syncPeers();
  }, [syncPeers]);

  // After local media is obtained, add tracks to existing peer connections that missed it
  const attachLocalStream = useCallback((stream: MediaStream) => {
    pcsRef.current.forEach(({ pc }) => {
      const hasTracks = pc.getSenders().some((s) => s.track !== null);
      if (!hasTracks) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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
  };
}
