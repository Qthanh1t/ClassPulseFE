import { Avatar, Badge, Tag, Typography, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Participant {
  id: string;
  name: string;
  avatarColor?: string;
  isTeacher?: boolean;
  isOnline?: boolean;
}

interface Props {
  participants: Participant[];
  answeredIds?: string[];
  silentStudentIds?: string[];
  raisedHandIds?: string[];
  questionActive?: boolean;
}

export default function StudentStatusList({
  participants,
  answeredIds = [],
  silentStudentIds = [],
  raisedHandIds = [],
  questionActive = false,
}: Props) {
  const studentOnly = participants.filter((p) => !p.isTeacher);
  const onlineStudents = studentOnly.filter((p) => p.isOnline !== false);
  const answeredCount = onlineStudents.filter((p) => answeredIds.includes(p.id)).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e7e3dc' }}>
        <Text strong style={{ fontSize: 14 }}>Thành viên</Text>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {questionActive
              ? `${answeredCount}/${onlineStudents.length} đã trả lời`
              : `${onlineStudents.length}/${studentOnly.length} online`}
          </Text>
        </div>
        {raisedHandIds.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: '#e08c0b' }}>
              ✋ {raisedHandIds.length} đang giơ tay
            </Text>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {participants.map((p) => {
          const online = p.isOnline !== false;
          const isSilent = !p.isTeacher && silentStudentIds.includes(p.id);
          const hasRaisedHand = !p.isTeacher && raisedHandIds.includes(p.id);
          const answered = !p.isTeacher && answeredIds.includes(p.id);
          const displayName = p.name || 'Ẩn danh';
          const initial = (p.name || '?').charAt(0).toUpperCase();

          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 16px',
                background: hasRaisedHand ? '#fbf0db' : isSilent ? '#fceaef' : 'transparent',
                opacity: online ? 1 : 0.45,
                transition: 'background 0.2s, opacity 0.2s',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar size={32} style={{ background: p.avatarColor ?? '#4f46e5', fontSize: 13 }}>
                  {initial}
                </Avatar>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '2px solid #fff',
                    background: online ? '#0ea672' : '#a8a29e',
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, display: 'block' }} ellipsis>
                  {displayName}
                </Text>
                {p.isTeacher && (
                  <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', marginTop: 1 }}>
                    GV
                  </Tag>
                )}
                {!p.isTeacher && !online && (
                  <Text type="secondary" style={{ fontSize: 10 }}>Đã rời lớp</Text>
                )}
              </div>

              {!p.isTeacher && online && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasRaisedHand && (
                    <Tooltip title="Đang giơ tay">
                      <span style={{ fontSize: 14 }}>✋</span>
                    </Tooltip>
                  )}
                  {isSilent && !hasRaisedHand && (
                    <Tooltip title="Không tương tác">
                      <WarningOutlined style={{ color: '#e23d6d', fontSize: 13 }} />
                    </Tooltip>
                  )}
                  {questionActive && (
                    <Badge
                      status={answered ? 'success' : 'default'}
                      text={
                        <Text style={{ fontSize: 11, color: answered ? '#0ea672' : '#a8a29e' }}>
                          {answered ? '✓' : '○'}
                        </Text>
                      }
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(silentStudentIds.length > 0 || raisedHandIds.length > 0) && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #e7e3dc',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {raisedHandIds.length > 0 && (
            <Text style={{ fontSize: 12, color: '#e08c0b' }}>
              ✋ {raisedHandIds.length} HS đang giơ tay
            </Text>
          )}
          {silentStudentIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WarningOutlined style={{ color: '#e23d6d', fontSize: 12 }} />
              <Text style={{ fontSize: 12, color: '#be123c' }}>
                {silentStudentIds.length} HS không tương tác
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
