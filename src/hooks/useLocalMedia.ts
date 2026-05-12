import { useState, useRef, useCallback } from 'react';

export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const startMedia = useCallback(async (video = true, audio = true) => {
    setIsLoading(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720, frameRate: 30 } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsMicOn(audio);
      setIsCameraOn(video);
      return mediaStream;
    } catch (err) {
      const msg = mapMediaError(err);
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleMic = useCallback(() => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  }, []);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return {
    stream,
    streamRef,
    isMicOn,
    isCameraOn,
    isLoading,
    error,
    startMedia,
    toggleMic,
    toggleCamera,
    stopMedia,
  };
}

function mapMediaError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'Trình duyệt bị chặn quyền camera/mic. Vui lòng cấp quyền trong cài đặt.';
    if (err.name === 'NotFoundError') return 'Không tìm thấy camera hoặc microphone.';
    if (err.name === 'NotReadableError') return 'Camera/mic đang được dùng bởi ứng dụng khác.';
    if (err.name === 'OverconstrainedError') return 'Camera không hỗ trợ độ phân giải yêu cầu.';
  }
  return 'Không thể truy cập camera/mic. Vui lòng thử lại.';
}
