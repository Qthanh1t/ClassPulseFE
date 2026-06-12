import { useRef, useEffect } from 'react';
import { Avatar } from 'antd';
import { AudioMutedOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  isTeacher?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isLocal?: boolean;
  isFocused?: boolean;
  isSelf?: boolean;
  compact?: boolean;
  borderRadius?: number;
  children?: React.ReactNode;
}

export default function VideoTile({
  stream,
  name,
  avatarColor = '#4f46e5',
  avatarUrl,
  isTeacher,
  isMuted,
  isCameraOff,
  isLocal,
  isFocused,
  isSelf,
  compact = false,
  borderRadius = 8,
  children,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
    if (stream) videoRef.current.play().catch(() => {});
  }, [stream]);

  const showVideo = !!stream && !isCameraOff;
  const safeName = name ?? '';
  const shortName = isLocal
    ? `${safeName.split(' ').pop()} (bạn)`
    : (safeName.split(' ').pop() ?? safeName);

  const avatarSize = compact ? 28 : 52;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: isFocused
          ? 'linear-gradient(145deg, #1a1535, #2a1b6e)'
          : 'linear-gradient(145deg, #1b1b36, #242445)',
        borderRadius,
        overflow: 'hidden',
        border: isFocused
          ? '2px solid rgba(79,70,229,0.65)'
          : isSelf
            ? '2px solid rgba(16,185,129,0.55)'
            : '1.5px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isFocused
          ? '0 0 0 4px rgba(79,70,229,0.15), 0 8px 32px rgba(0,0,0,0.5)'
          : isSelf
            ? '0 0 0 3px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.4)'
            : '0 2px 12px rgba(0,0,0,0.35)',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
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

      {/* Avatar fallback when camera is off or no stream */}
      {!showVideo && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: compact ? 3 : 7,
          zIndex: 1,
        }}>
          <Avatar
            size={avatarSize}
            src={avatarUrl ?? undefined}
            style={{
              background: `linear-gradient(135deg, ${avatarColor}dd, ${avatarColor}88)`,
              fontSize: compact ? 12 : 20,
              fontWeight: 700,
              border: `2px solid ${avatarColor}44`,
              boxShadow: `0 4px 18px ${avatarColor}35`,
            }}
          >
            {safeName.charAt(0).toUpperCase() || '?'}
          </Avatar>
          {!compact && isCameraOff && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'rgba(255,255,255,0.35)',
              fontSize: 10,
              letterSpacing: '0.04em',
            }}>
              <VideoCameraOutlined style={{ fontSize: 10 }} />
              Camera tắt
            </div>
          )}
        </div>
      )}

      {/* Bottom gradient + name overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)',
          padding: compact ? '18px 5px 4px' : '26px 10px 7px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 2,
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: compact ? 9 : 12,
            flex: 1,
            lineHeight: 1.2,
            fontWeight: 500,
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          }}
          ellipsis
        >
          {shortName || '?'}
        </Text>

        {isTeacher && !compact && (
          <span style={{
            background: 'var(--sq-primary)',
            color: '#fff',
            fontSize: 8,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            GV
          </span>
        )}
        {isTeacher && compact && (
          <span style={{
            width: 5, height: 5,
            background: 'var(--sq-primary)',
            borderRadius: '50%',
            flexShrink: 0,
            boxShadow: '0 0 5px rgba(79,70,229,0.8)',
          }} />
        )}
        {isMuted && (
          <AudioMutedOutlined style={{
            color: 'var(--sq-rose)',
            fontSize: compact ? 9 : 11,
            flexShrink: 0,
          }} />
        )}
      </div>

      {/* Extra content slot (raise hand badge, focus icon, LIVE badge, etc.) */}
      {children}
    </div>
  );
}
