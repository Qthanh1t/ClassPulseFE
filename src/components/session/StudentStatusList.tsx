import { Avatar, Badge, Typography, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { User, StudentAnswer } from '../../types';

const { Text } = Typography;

interface Props {
  students: User[];
  answers: StudentAnswer[];
  silentStudentIds: string[];
  currentQuestionId?: string;
}

export default function StudentStatusList({ students, answers, silentStudentIds, currentQuestionId }: Props) {
  const getStatus = (studentId: string) => {
    if (!currentQuestionId) return 'idle';
    const answer = answers.find((a) => a.studentId === studentId);
    if (!answer) return 'idle';
    if (answer.selectedOptions.length === 0 && !answer.essayText) return 'idle';
    return 'answered';
  };

  const answeredCount = students.filter((s) => getStatus(s.id) === 'answered').length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 14 }}>Học sinh</Text>
        {currentQuestionId && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {answeredCount}/{students.length} đã trả lời
            </Text>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {students.map((student) => {
          const status = getStatus(student.id);
          const isSilent = silentStudentIds.includes(student.id);

          return (
            <div
              key={student.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                background: isSilent ? '#fff7e6' : 'transparent',
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
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isSilent && (
                  <Tooltip title="Không tương tác">
                    <WarningOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
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
            </div>
          );
        })}
      </div>

      {silentStudentIds.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: '#fff7e6',
            borderTop: '1px solid #ffd591',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <WarningOutlined style={{ color: '#fa8c16' }} />
          <Text style={{ fontSize: 12, color: '#d46b08' }}>
            {silentStudentIds.length} HS không tương tác
          </Text>
        </div>
      )}
    </div>
  );
}
