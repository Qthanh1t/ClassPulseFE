import {
  Avatar, Button, Card, Col, Collapse, Progress, Row, Statistic,
  Table, Tag, Typography, Tooltip, Tabs,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  TrophyOutlined, ArrowLeftOutlined, TeamOutlined, QuestionCircleOutlined,
  BarChartOutlined, TableOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
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
  if (question.type === 'essay') return 'correct';
  return isAnswerCorrect(a, question) ? 'correct' : 'wrong';
}

const RESULT_ICON = {
  correct: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  wrong: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  skipped: <MinusCircleOutlined style={{ color: '#bfbfbf' }} />,
};

const PIE_COLORS = ['#52c41a', '#ff4d4f', '#bfbfbf'];

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

  // Chart data: per-question correct rate
  const questionChartData = session.questions.map((q, idx) => {
    const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText?.length ?? 0) > 0);
    const correct = q.type !== 'essay' ? answered.filter((a) => isAnswerCorrect(a, q)).length : answered.length;
    const rate = Math.round((correct / STUDENTS.length) * 100);
    return {
      name: `Câu ${idx + 1}`,
      rate,
      correct,
      total: STUDENTS.length,
      type: q.type,
    };
  });

  // Pie chart: overall correct/wrong/skipped
  const totalCorrect = mcqQuestions.reduce((acc, q) =>
    acc + q.answers.filter((a) => isAnswerCorrect(a, q)).length, 0);
  const totalWrong = mcqQuestions.reduce((acc, q) =>
    acc + q.answers.filter((a) => {
      const hasAnswer = a.selectedOptions.length > 0;
      return hasAnswer && !isAnswerCorrect(a, q);
    }).length, 0);
  const totalSkipped = mcqPossible - totalCorrect - totalWrong;

  const pieData = [
    { name: 'Đúng', value: totalCorrect, color: '#52c41a' },
    { name: 'Sai', value: totalWrong, color: '#ff4d4f' },
    { name: 'Bỏ qua', value: totalSkipped, color: '#bfbfbf' },
  ];

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

      {/* Charts section */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Bar chart: per-question correct rate */}
        <Col xs={24} md={16}>
          <Card
            style={{ borderRadius: 12 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartOutlined style={{ color: '#1677ff' }} />
                <span>Tỉ lệ đúng theo từng câu hỏi</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={questionChartData} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <RechartTooltip
                  formatter={(value: unknown) => [`${String(value)}%`, 'Tỉ lệ đúng']}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.rate >= 70 ? '#52c41a' : entry.rate >= 40 ? '#fa8c16' : '#ff4d4f'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, justifyContent: 'center' }}>
              {[
                { label: '≥ 70%', color: '#52c41a' },
                { label: '40–70%', color: '#fa8c16' },
                { label: '< 40%', color: '#ff4d4f' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Pie chart: overall correct/wrong/skipped */}
        <Col xs={24} md={8}>
          <Card
            style={{ borderRadius: 12, height: '100%' }}
            title="Tổng quan kết quả"
          >
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={(props: { name?: string; percent?: number }) => `${props.name ?? ''} ${Math.round((props.percent ?? 0) * 100)}%`}
                  labelLine={false}
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`pie-${index}`} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Legend iconSize={10} iconType="circle" />
                <RechartTooltip formatter={(value: unknown, name: unknown) => [String(value), String(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Per-question detail + Student table — tabbed */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs
          defaultActiveKey="questions"
          items={[
            {
              key: 'questions',
              label: (
                <span>
                  <QuestionCircleOutlined style={{ marginRight: 6 }} />
                  Chi tiết từng câu hỏi
                </span>
              ),
              children: (
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
                            <Progress
                              percent={rate}
                              size="small"
                              style={{ width: 80 }}
                              strokeColor={rate >= 70 ? '#52c41a' : rate >= 40 ? '#fa8c16' : '#ff4d4f'}
                            />
                            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                              {answered.length}/{STUDENTS.length} HS
                            </Text>
                          </div>
                        </div>
                      ),
                      children: (
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                          {/* Option distribution bar chart */}
                          {q.options && (
                            <div style={{ flex: 2, minWidth: 240 }}>
                              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                                Phân bố đáp án
                              </Text>
                              <ResponsiveContainer width="100%" height={120}>
                                <BarChart
                                  data={q.options.map((opt) => ({
                                    name: opt.label,
                                    count: q.answers.filter((a) => a.selectedOptions.includes(opt.id)).length,
                                    isCorrect: opt.isCorrect,
                                    text: opt.text,
                                  }))}
                                  margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                                >
                                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                  <RechartTooltip
                                    formatter={(value: unknown, _name: unknown, props: { payload?: { text?: string } }) => [
                                      `${String(value)} học sinh`,
                                      props.payload?.text ?? '',
                                    ]}
                                  />
                                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                                    {q.options.map((opt, i) => (
                                      <Cell key={i} fill={opt.isCorrect ? '#52c41a' : '#ff7875'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Confidence breakdown */}
                          <div style={{ flex: 1, minWidth: 160 }}>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                              Mức độ tự tin
                            </Text>
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
                                <Progress
                                  percent={answered.length > 0 ? Math.round((count / answered.length) * 100) : 0}
                                  size="small"
                                  strokeColor={color}
                                  showInfo={false}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              ),
            },
            {
              key: 'students',
              label: (
                <span>
                  <TableOutlined style={{ marginRight: 6 }} />
                  Kết quả học sinh
                </span>
              ),
              children: (
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
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
