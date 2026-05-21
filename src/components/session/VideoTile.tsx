import { useRef, useEffect } from 'react';
import { Avatar, Badge } from 'antd';
import { AudioMutedOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  avatarColor?: string;
  isTeacher?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isLocal?: boolean;
  isFocused?: boolean;
  compact?: boolean;
  borderRadius?: number;
  // Optional slot for extra overlays (e.g. raise hand badge)
  children?: React.ReactNode;
}

export default function VideoTile({
  stream,
  name,
  avatarColor = '#6366f1',
  isTeacher,
  isMuted,
  isCameraOff,
  isLocal,
  isFocused,
  compact = false,
  borderRadius = 8,
  children,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
    // Explicitly call play() — autoPlay attribute alone is unreliable when srcObject changes
    if (stream) {
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const showVideo = !!stream && !isCameraOff;
  const safeName = name ?? '';
  const shortName = isLocal
    ? `${safeName.split(' ').pop()} (bạn)`
    : (safeName.split(' ').pop() ?? safeName);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: isFocused ? '#1e1b3a' : '#2d2d44',
        borderRadius,
        overflow: 'hidden',
        border: `2px solid ${isFocused ? '#6366f1' : 'transparent'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Video element — always mounted so srcObject persists */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isLocal ? 'scaleX(-1)' : 'none',
          display: showVideo ? 'block' : 'none',
        }}
      />

      {/* Avatar placeholder when camera is off or stream unavailable */}
      {!showVideo && (
        <Avatar
          size={compact ? 28 : 52}
          style={{
            background: avatarColor,
            fontSize: compact ? 12 : 20,
            zIndex: 1,
            boxShadow: isFocused ? '0 0 0 3px rgba(99,102,241,0.4)' : 'none',
          }}
        >
          {safeName.charAt(0).toUpperCase()}
        </Avatar>
      )}

      {/* Gradient name overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: compact ? '14px 6px 4px' : '20px 10px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 2,
        }}
      >
        <Text
          style={{ color: '#fff', fontSize: compact ? 10 : 12, flex: 1, lineHeight: 1.3 }}
          ellipsis
        >
          {shortName || '—'}
        </Text>
        {isTeacher && (
          <span
            style={{
              background: '#6366f1',
              color: '#fff',
              fontSize: compact ? 8 : 9,
              padding: compact ? '1px 3px' : '1px 5px',
              borderRadius: 3,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            GV
          </span>
        )}
        {isMuted && (
          <AudioMutedOutlined style={{ color: '#ff4d4f', fontSize: compact ? 10 : 12, flexShrink: 0 }} />
        )}
      </div>

      {/* LIVE badge for local stream */}
      {isLocal && (
        <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 2 }}>
          <Badge status="processing" />
        </div>
      )}

      {/* Extra content (raise hand, focus icon, etc.) */}
      {children}
    </div>
  );
}
