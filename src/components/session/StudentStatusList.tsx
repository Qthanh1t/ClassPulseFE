import { Avatar, Badge, Tag, Typography, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { User, StudentAnswer } from '../../types';

const { Text } = Typography;

interface Props {
  students: User[];
  answers: StudentAnswer[];
  silentStudentIds: string[];
  raisedHandIds?: string[];
  currentQuestionId?: string;
}

export default function StudentStatusList({
  students,
  answers,
  silentStudentIds,
  raisedHandIds = [],
  currentQuestionId,
}: Props) {
  const hasTeacher = students.some((s) => s.role === 'teacher');
  const studentOnly = students.filter((s) => s.role !== 'teacher');

  const getStatus = (studentId: string) => {
    if (!currentQuestionId) return 'idle';
    const answer = answers.find((a) => a.studentId === studentId);
    if (!answer) return 'idle';
    if (answer.selectedOptions.length === 0 && !answer.essayText) return 'idle';
    return 'answered';
  };

  const answeredCount = studentOnly.filter((s) => getStatus(s.id) === 'answered').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 14 }}>{hasTeacher ? 'Thành viên' : 'Học sinh'}</Text>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {currentQuestionId
              ? `${answeredCount}/${studentOnly.length} đã trả lời`
              : `${students.length} thành viên`}
          </Text>
        </div>
        {raisedHandIds.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: '#fa8c16' }}>
              ✋ {raisedHandIds.length} đang giơ tay
            </Text>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {students.map((student) => {
          const isTeacher = student.role === 'teacher';
          const status = isTeacher ? 'idle' : getStatus(student.id);
          const isSilent = !isTeacher && silentStudentIds.includes(student.id);
          const hasRaisedHand = !isTeacher && raisedHandIds.includes(student.id);

          return (
            <div
              key={student.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 16px',
                background: hasRaisedHand
                  ? '#fff7e6'
                  : isSilent
                    ? '#fff2f0'
                    : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Avatar size={32} style={{ background: student.avatarColor, fontSize: 13 }}>
                  {student.name.charAt(0)}
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
                    background: '#52c41a',
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, display: 'block' }} ellipsis>
                  {student.name}
                </Text>
                {isTeacher && (
                  <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', marginTop: 1 }}>
                    GV
                  </Tag>
                )}
              </div>

              {!isTeacher && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasRaisedHand && (
                    <Tooltip title="Đang giơ tay">
                      <span style={{ fontSize: 14 }}>✋</span>
                    </Tooltip>
                  )}
                  {isSilent && !hasRaisedHand && (
                    <Tooltip title="Không tương tác">
                      <WarningOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />
                    </Tooltip>
                  )}
                  {currentQuestionId && (
                    <Badge
                      status={status === 'answered' ? 'success' : 'default'}
                      text={
                        <Text style={{ fontSize: 11, color: status === 'answered' ? '#52c41a' : '#bfbfbf' }}>
                          {status === 'answered' ? '✓' : '○'}
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
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {raisedHandIds.length > 0 && (
            <Text style={{ fontSize: 12, color: '#fa8c16' }}>
              ✋ {raisedHandIds.length} HS đang giơ tay
            </Text>
          )}
          {silentStudentIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
              <Text style={{ fontSize: 12, color: '#cf1322' }}>
                {silentStudentIds.length} HS không tương tác
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
