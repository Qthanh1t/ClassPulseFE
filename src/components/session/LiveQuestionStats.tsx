import { Progress, Tag, Typography, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { Question, StudentAnswer } from '../../types';
import { STUDENTS } from '../../mock/students';

const { Text } = Typography;

interface Props {
  question: Question;
}

function isAnswerCorrect(answer: StudentAnswer, question: Question): boolean {
  if (question.type === 'essay') return false;
  const correctIds = (question.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
  return (
    answer.selectedOptions.length === correctIds.length &&
    correctIds.every((id) => answer.selectedOptions.includes(id))
  );
}

export default function LiveQuestionStats({ question }: Props) {
  const totalStudents = STUDENTS.length;
  const answeredAnswers = question.answers.filter(
    (a) => a.selectedOptions.length > 0 || (a.essayText && a.essayText.length > 0),
  );
  const answeredCount = answeredAnswers.length;

  const correctCount = question.type !== 'essay'
    ? answeredAnswers.filter((a) => isAnswerCorrect(a, question)).length
    : 0;

  const highCount = answeredAnswers.filter((a) => a.confidence === 'high').length;
  const medCount = answeredAnswers.filter((a) => a.confidence === 'medium').length;
  const lowCount = answeredAnswers.filter((a) => a.confidence === 'low').length;

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Overall progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text strong style={{ fontSize: 13 }}>Tiến độ trả lời</Text>
          <Text style={{ fontSize: 13 }}>
            <span style={{ color: '#1677ff', fontWeight: 600 }}>{answeredCount}</span>
            <span style={{ color: '#8c8c8c' }}>/{totalStudents} học sinh</span>
          </Text>
        </div>
        <Progress
          percent={Math.round((answeredCount / totalStudents) * 100)}
          strokeColor="#1677ff"
          size="small"
        />
      </div>

      {/* Correct / Wrong (only for MCQ) */}
      {question.type !== 'essay' && answeredCount > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, lineHeight: 1 }}>{correctCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đúng ({answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%)
              </Text>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, lineHeight: 1 }}>{answeredCount - correctCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sai ({answeredCount > 0 ? Math.round(((answeredCount - correctCount) / answeredCount) * 100) : 0}%)
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* Per-option breakdown (MCQ) */}
      {question.type !== 'essay' && question.options && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Phân bố đáp án</Text>
          {question.options.map((opt) => {
            const count = question.answers.filter((a) => a.selectedOptions.includes(opt.id)).length;
            const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
            return (
              <div key={opt.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 13 }}>
                    <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ marginRight: 6 }}>
                      {opt.label}
                    </Tag>
                    {opt.text}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{count} ({pct}%)</Text>
                </div>
                <Progress
                  percent={pct}
                  size="small"
                  strokeColor={opt.isCorrect ? '#52c41a' : '#ff7875'}
                  showInfo={false}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Confidence breakdown */}
      {answeredCount > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Mức độ tự tin</Text>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Cao', count: highCount, color: '#52c41a', bg: '#f6ffed' },
              { label: 'TB', count: medCount, color: '#fa8c16', bg: '#fff7e6' },
              { label: 'Thấp', count: lowCount, color: '#ff4d4f', bg: '#fff2f0' },
            ].map(({ label, count, color, bg }) => (
              <Tooltip key={label} title={`${label}: ${count} học sinh`}>
                <div
                  style={{
                    flex: 1,
                    background: bg,
                    borderRadius: 8,
                    padding: '8px 4px',
                    textAlign: 'center',
                    border: `1px solid ${color}33`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, color }}>{count}</div>
                  <Text style={{ fontSize: 11, color }}>{label}</Text>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
