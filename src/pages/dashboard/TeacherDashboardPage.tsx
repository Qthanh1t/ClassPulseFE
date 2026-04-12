import {
  Avatar, Button, Card, Col, Collapse, Progress, Row, Statistic,
  Table, Tag, Typography, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  TrophyOutlined, ArrowLeftOutlined, TeamOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS } from '../../mock/students';
import type { Question, StudentAnswer } from '../../types';

const { Title, Text } = Typography;

function isAnswerCorrect(answer: StudentAnswer, question: Question): boolean {
  if (question.type === 'essay') return false;
  const correctIds = (question.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
  return (
    answer.selectedOptions.length === correctIds.length &&
    correctIds.every((id) => answer.selectedOptions.includes(id))
  );
}

function getStudentResult(studentId: string, question: Question): 'correct' | 'wrong' | 'skipped' {
  const a = question.answers.find((ans) => ans.studentId === studentId);
  if (!a || (a.selectedOptions.length === 0 && !a.essayText)) return 'skipped';
  if (question.type === 'essay') return 'correct'; // essays counted as answered
  return isAnswerCorrect(a, question) ? 'correct' : 'wrong';
}

const RESULT_ICON = {
  correct: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  wrong: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  skipped: <MinusCircleOutlined style={{ color: '#bfbfbf' }} />,
};

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  useParams<{ sessionId: string }>();
  const session = LIVE_SESSION;

  const mcqQuestions = session.questions.filter((q) => q.type !== 'essay');

  // Summary stats
  const totalAnswers = session.questions.reduce((acc, q) => {
    const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText && a.essayText.length > 0)).length;
    return acc + answered;
  }, 0);
  const totalPossible = session.questions.length * STUDENTS.length;
  const avgResponseRate = Math.round((totalAnswers / totalPossible) * 100);

  const correctAnswers = mcqQuestions.reduce((acc, q) => {
    return acc + q.answers.filter((a) => isAnswerCorrect(a, q)).length;
  }, 0);
  const mcqPossible = mcqQuestions.length * STUDENTS.length;
  const avgCorrectRate = mcqPossible > 0 ? Math.round((correctAnswers / mcqPossible) * 100) : 0;

  // Student result table columns
  const columns = [
    {
      title: 'Học sinh',
      key: 'student',
      fixed: 'left' as const,
      width: 160,
      render: (_: unknown, record: { id: string; name: string; avatarColor?: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={28} style={{ background: record.avatarColor, flexShrink: 0 }}>
            {record.name.charAt(0)}
          </Avatar>
          <Text style={{ fontSize: 13 }}>{record.name}</Text>
        </div>
      ),
    },
    ...session.questions.map((q, idx) => ({
      title: (
        <Tooltip title={<span dangerouslySetInnerHTML={{ __html: q.content }} />}>
          <span>Câu {idx + 1}</span>
        </Tooltip>
      ),
      key: q.id,
      width: 72,
      align: 'center' as const,
      render: (_: unknown, record: { id: string }) => {
        const res = getStudentResult(record.id, q);
        return RESULT_ICON[res];
      },
    })),
    {
      title: 'Điểm',
      key: 'score',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: { id: string }) => {
        const correct = mcqQuestions.filter((q) => getStudentResult(record.id, q) === 'correct').length;
        return (
          <Tag color={correct >= mcqQuestions.length * 0.7 ? 'success' : correct >= mcqQuestions.length * 0.4 ? 'warning' : 'error'}>
            {correct}/{mcqQuestions.length}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classes')} style={{ marginBottom: 8 }} />
          <Title level={4} style={{ margin: 0 }}>{session.classroomName}</Title>
          <Text type="secondary">Kết quả buổi học · {session.date} · {session.teacherName}</Text>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => navigate(`/session/teacher/${session.classroomId}`)}>
            Buổi học mới
          </Button>
          <Button onClick={() => navigate(`/review/${session.id}`)}>
            Xem góc học sinh
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: 'Câu hỏi', value: session.questions.length, icon: <QuestionCircleOutlined />, color: '#1677ff' },
          { title: 'Tỉ lệ trả lời', value: `${avgResponseRate}%`, icon: <TeamOutlined />, color: '#52c41a' },
          { title: 'Tỉ lệ đúng (TB)', value: `${avgCorrectRate}%`, icon: <TrophyOutlined />, color: '#fa8c16' },
          { title: 'HS không tương tác', value: session.silentStudentIds.length, icon: <MinusCircleOutlined />, color: '#ff4d4f' },
        ].map(({ title, value, icon, color }) => (
          <Col key={title} xs={12} sm={6}>
            <Card style={{ borderRadius: 10, borderTop: `3px solid ${color}` }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>}
                value={value}
                prefix={<span style={{ color }}>{icon}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Per-question breakdown */}
      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>Chi tiết từng câu hỏi</Title>
        <Collapse
          size="small"
          items={session.questions.map((q, idx) => {
            const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText?.length ?? 0) > 0);
            const correct = q.type !== 'essay' ? answered.filter((a) => isAnswerCorrect(a, q)).length : answered.length;
            const rate = answered.length > 0 ? Math.round((correct / STUDENTS.length) * 100) : 0;
            const highConf = answered.filter((a) => a.confidence === 'high').length;
            const medConf = answered.filter((a) => a.confidence === 'medium').length;
            const lowConf = answered.filter((a) => a.confidence === 'low').length;

            return {
              key: q.id,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <Tag color="blue" style={{ flexShrink: 0 }}>Câu {idx + 1}</Tag>
                  <Text style={{ flex: 1, fontSize: 13 }} ellipsis>
                    <span dangerouslySetInnerHTML={{ __html: q.content.replace(/<[^>]+>/g, '') }} />
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <Progress percent={rate} size="small" style={{ width: 80 }} strokeColor={rate >= 70 ? '#52c41a' : rate >= 40 ? '#fa8c16' : '#ff4d4f'} />
                    <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{answered.length}/{STUDENTS.length} HS</Text>
                  </div>
                </div>
              ),
              children: (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {/* Option distribution */}
                  {q.options && (
                    <div style={{ flex: 2, minWidth: 220 }}>
                      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Phân bố đáp án</Text>
                      {q.options.map((opt) => {
                        const cnt = q.answers.filter((a) => a.selectedOptions.includes(opt.id)).length;
                        const pct = STUDENTS.length > 0 ? Math.round((cnt / STUDENTS.length) * 100) : 0;
                        return (
                          <div key={opt.id} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <Text style={{ fontSize: 13 }}>
                                <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ marginRight: 6 }}>{opt.label}</Tag>
                                {opt.text}
                              </Text>
                              <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{cnt} ({pct}%)</Text>
                            </div>
                            <Progress percent={pct} size="small" strokeColor={opt.isCorrect ? '#52c41a' : '#ff7875'} showInfo={false} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Confidence */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Mức độ tự tin</Text>
                    {[
                      { label: 'Cao', count: highConf, color: '#52c41a' },
                      { label: 'Trung bình', count: medConf, color: '#fa8c16' },
                      { label: 'Thấp', count: lowConf, color: '#ff4d4f' },
                    ].map(({ label, count, color }) => (
                      <div key={label} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color }}>{label}</Text>
                          <Text style={{ fontSize: 13 }}>{count}</Text>
                        </div>
                        <Progress percent={answered.length > 0 ? Math.round((count / answered.length) * 100) : 0} size="small" strokeColor={color} showInfo={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ),
            };
          })}
        />
      </Card>

      {/* Student result table */}
      <Card style={{ borderRadius: 12 }}>
        <Title level={5} style={{ marginBottom: 16 }}>Kết quả học sinh</Title>
        <Table
          dataSource={STUDENTS}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong style={{ fontSize: 12 }}>Tỉ lệ đúng</Text>
                </Table.Summary.Cell>
                {session.questions.map((q, idx) => {
                  const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText?.length ?? 0) > 0);
                  const correct = q.type !== 'essay' ? answered.filter((a) => isAnswerCorrect(a, q)).length : answered.length;
                  const pct = Math.round((correct / STUDENTS.length) * 100);
                  return (
                    <Table.Summary.Cell key={q.id} index={idx + 1} align="center">
                      <Text style={{ fontSize: 12, color: pct >= 70 ? '#52c41a' : pct >= 40 ? '#fa8c16' : '#ff4d4f' }}>
                        {pct}%
                      </Text>
                    </Table.Summary.Cell>
                  );
                })}
                <Table.Summary.Cell index={session.questions.length + 1} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
}
