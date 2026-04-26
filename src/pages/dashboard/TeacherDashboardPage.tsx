import {
  Avatar, Button, Card, Col, Collapse, Progress, Row, Statistic,
  Table, Tag, Typography, Tooltip, Tabs,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  TrophyOutlined, ArrowLeftOutlined, TeamOutlined, QuestionCircleOutlined,
  BarChartOutlined, TableOutlined, RiseOutlined,
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
  correct: <CheckCircleOutlined style={{ color: '#10b981' }} />,
  wrong: <CloseCircleOutlined style={{ color: '#f43f5e' }} />,
  skipped: <MinusCircleOutlined style={{ color: '#cbd5e1' }} />,
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  lightBg: string;
  suffix?: string;
}

function StatCard({ title, value, icon, accentColor, lightBg, suffix }: StatCardProps) {
  return (
    <div
      className="sq-stat-card"
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: lightBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 22,
          color: accentColor,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
          {value}{suffix && <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', marginLeft: 2 }}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

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

  // Pie chart
  const totalCorrect = mcqQuestions.reduce((acc, q) =>
    acc + q.answers.filter((a) => isAnswerCorrect(a, q)).length, 0);
  const totalWrong = mcqQuestions.reduce((acc, q) =>
    acc + q.answers.filter((a) => {
      const hasAnswer = a.selectedOptions.length > 0;
      return hasAnswer && !isAnswerCorrect(a, q);
    }).length, 0);
  const totalSkipped = mcqPossible - totalCorrect - totalWrong;

  const pieData = [
    { name: 'Đúng', value: totalCorrect, color: '#10b981' },
    { name: 'Sai', value: totalWrong, color: '#f43f5e' },
    { name: 'Bỏ qua', value: totalSkipped, color: '#e2e8f0' },
  ];

  const CONF_CONFIG = {
    high:   { label: 'Cao',  color: '#10b981', bg: '#f0fdf4' },
    medium: { label: 'TB',   color: '#f59e0b', bg: '#fffbeb' },
    low:    { label: 'Thấp', color: '#f43f5e', bg: '#fff1f2' },
  } as const;

  // Student table
  const columns = [
    {
      title: 'Học sinh',
      key: 'student',
      fixed: 'left' as const,
      width: 170,
      render: (_: unknown, record: { id: string; name: string; avatarColor?: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={30} style={{ background: record.avatarColor, flexShrink: 0, fontWeight: 600, fontSize: 12 }}>
            {record.name.charAt(0)}
          </Avatar>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{record.name}</Text>
        </div>
      ),
    },
    ...session.questions.map((q, idx) => ({
      title: (
        <Tooltip title={<span dangerouslySetInnerHTML={{ __html: q.content }} />}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Câu {idx + 1}</span>
        </Tooltip>
      ),
      key: q.id,
      width: 88,
      align: 'center' as const,
      render: (_: unknown, record: { id: string }) => {
        const res = getStudentResult(record.id, q);
        const answer = q.answers.find((a) => a.studentId === record.id);
        const conf = answer?.confidence ?? null;
        const confCfg = conf ? CONF_CONFIG[conf] : null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 0' }}>
            {RESULT_ICON[res]}
            {confCfg ? (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: confCfg.color,
                background: confCfg.bg,
                borderRadius: 4,
                padding: '1px 6px',
                lineHeight: 1.5,
              }}>
                {confCfg.label}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#cbd5e1' }}>—</span>
            )}
          </div>
        );
      },
    })),
    {
      title: 'Điểm',
      key: 'score',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: { id: string }) => {
        const correct = mcqQuestions.filter((q) => getStudentResult(record.id, q) === 'correct').length;
        const pct = mcqQuestions.length > 0 ? correct / mcqQuestions.length : 0;
        return (
          <Tag
            color={pct >= 0.7 ? 'success' : pct >= 0.4 ? 'warning' : 'error'}
            style={{ borderRadius: 20, padding: '1px 10px', fontWeight: 600 }}
          >
            {correct}/{mcqQuestions.length}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: 20,
          padding: '24px 28px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

        <div style={{ position: 'relative' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/classes')}
            style={{ marginBottom: 12, color: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
          />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                Kết quả buổi học
              </div>
              <Title level={3} style={{ color: '#fff', margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
                {session.classroomName}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {session.date} · {session.teacherName}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => navigate(`/session/teacher/${session.classroomId}`)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                Buổi học mới
              </Button>
              <Button
                type="primary"
                icon={<RiseOutlined />}
                onClick={() => navigate(`/review/${session.id}`)}
                style={{
                  background: '#6366f1',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Góc học sinh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard
            title="Câu hỏi"
            value={session.questions.length}
            icon={<QuestionCircleOutlined />}
            accentColor="#6366f1"
            lightBg="#eef2ff"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Tỉ lệ trả lời"
            value={avgResponseRate}
            suffix="%"
            icon={<TeamOutlined />}
            accentColor="#10b981"
            lightBg="#f0fdf4"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Tỉ lệ đúng TB"
            value={avgCorrectRate}
            suffix="%"
            icon={<TrophyOutlined />}
            accentColor="#f59e0b"
            lightBg="#fffbeb"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Không tương tác"
            value={session.silentStudentIds.length}
            icon={<MinusCircleOutlined />}
            accentColor="#f43f5e"
            lightBg="#fff1f2"
          />
        </Col>
      </Row>

      {/* Charts row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Bar chart */}
        <Col xs={24} md={16}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}
            styles={{ body: { padding: '20px 20px 12px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: '#eef2ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChartOutlined style={{ color: '#6366f1', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Tỉ lệ đúng theo câu hỏi</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Phân tích kết quả từng câu hỏi</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={questionChartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RechartTooltip
                  formatter={(value: unknown) => [`${String(value)}%`, 'Tỉ lệ đúng']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.rate >= 70 ? '#10b981' : entry.rate >= 40 ? '#f59e0b' : '#f43f5e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
              {[
                { label: 'Tốt (≥70%)', color: '#10b981' },
                { label: 'Khá (40–70%)', color: '#f59e0b' },
                { label: 'Yếu (<40%)', color: '#f43f5e' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Pie chart */}
        <Col xs={24} md={8}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}
            styles={{ body: { padding: '20px 20px 12px' } }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Tổng quan kết quả</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Phân bố đúng / sai / bỏ qua</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`pie-${index}`} fill={pieData[index].color} />
                  ))}
                </Pie>
                <Legend
                  iconSize={8}
                  iconType="circle"
                  formatter={(value) => <span style={{ fontSize: 12, color: '#64748b' }}>{value}</span>}
                />
                <RechartTooltip
                  formatter={(value: unknown, name: unknown) => [String(value), String(name)]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Quick stats below pie */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 4 }}>
              {[
                { label: 'Đúng', value: totalCorrect, color: '#10b981' },
                { label: 'Sai', value: totalWrong, color: '#f43f5e' },
                { label: 'Bỏ qua', value: totalSkipped, color: '#94a3b8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <Statistic
                    value={value}
                    valueStyle={{ fontSize: 18, fontWeight: 700, color }}
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Detail tabs */}
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '0 20px 20px' } }}>
        <Tabs
          defaultActiveKey="questions"
          items={[
            {
              key: 'questions',
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QuestionCircleOutlined />
                  <span>Chi tiết từng câu hỏi</span>
                </div>
              ),
              children: (
                <Collapse
                  size="small"
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                  items={session.questions.map((q, idx) => {
                    const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText?.length ?? 0) > 0);
                    const correct = q.type !== 'essay' ? answered.filter((a) => isAnswerCorrect(a, q)).length : answered.length;
                    const rate = answered.length > 0 ? Math.round((correct / STUDENTS.length) * 100) : 0;
                    const highConf = answered.filter((a) => a.confidence === 'high').length;
                    const medConf = answered.filter((a) => a.confidence === 'medium').length;
                    const lowConf = answered.filter((a) => a.confidence === 'low').length;
                    const rateColor = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#f43f5e';

                    return {
                      key: q.id,
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                          <Tag color="blue" style={{ flexShrink: 0, borderRadius: 6, fontWeight: 600 }}>C{idx + 1}</Tag>
                          <Text style={{ flex: 1, fontSize: 13, color: '#374151' }} ellipsis>
                            <span dangerouslySetInnerHTML={{ __html: q.content.replace(/<[^>]+>/g, '') }} />
                          </Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: rateColor }} />
                              <Text style={{ fontSize: 12, color: rateColor, fontWeight: 600 }}>{rate}%</Text>
                            </div>
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{answered.length}/{STUDENTS.length} HS</Text>
                          </div>
                        </div>
                      ),
                      children: (
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '4px 0' }}>
                          {q.options && (
                            <div style={{ flex: 2, minWidth: 240 }}>
                              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10, color: '#374151' }}>
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
                                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <RechartTooltip
                                    formatter={(value: unknown, _name: unknown, props: { payload?: { text?: string } }) => [
                                      `${String(value)} học sinh`,
                                      props.payload?.text ?? '',
                                    ]}
                                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                  />
                                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {q.options.map((opt, i) => (
                                      <Cell key={i} fill={opt.isCorrect ? '#10b981' : '#fca5a5'} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 180 }}>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10, color: '#374151' }}>
                              Mức độ tự tin
                            </Text>
                            {[
                              { label: 'Cao', count: highConf, color: '#10b981', bg: '#f0fdf4' },
                              { label: 'Trung bình', count: medConf, color: '#f59e0b', bg: '#fffbeb' },
                              { label: 'Thấp', count: lowConf, color: '#f43f5e', bg: '#fff1f2' },
                            ].map(({ label, count, color, bg }) => (
                              <div key={label} style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                                    </div>
                                    <Text style={{ fontSize: 13, color: '#374151' }}>{label}</Text>
                                  </div>
                                  <Text style={{ fontSize: 13, fontWeight: 600, color }}>{count}</Text>
                                </div>
                                <Progress
                                  percent={answered.length > 0 ? Math.round((count / answered.length) * 100) : 0}
                                  size="small"
                                  strokeColor={color}
                                  trailColor="#f1f5f9"
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TableOutlined />
                  <span>Kết quả học sinh</span>
                </div>
              ),
              children: (
                <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Kết quả:</Text>
                  {[
                    { icon: <CheckCircleOutlined style={{ color: '#10b981', fontSize: 13 }} />, label: 'Đúng' },
                    { icon: <CloseCircleOutlined style={{ color: '#f43f5e', fontSize: 13 }} />, label: 'Sai' },
                    { icon: <MinusCircleOutlined style={{ color: '#cbd5e1', fontSize: 13 }} />, label: 'Bỏ qua' },
                  ].map(({ icon, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {icon}
                      <Text style={{ fontSize: 12, color: '#64748b' }}>{label}</Text>
                    </div>
                  ))}
                  <div style={{ width: 1, height: 14, background: '#e2e8f0', margin: '0 4px' }} />
                  <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Tự tin:</Text>
                  {[
                    { label: 'Cao', color: '#10b981', bg: '#f0fdf4' },
                    { label: 'TB', color: '#f59e0b', bg: '#fffbeb' },
                    { label: 'Thấp', color: '#f43f5e', bg: '#fff1f2' },
                  ].map(({ label, color, bg }) => (
                    <span key={label} style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color,
                      background: bg,
                      borderRadius: 4,
                      padding: '1px 7px',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
                <Table
                  dataSource={STUDENTS}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}>
                          <Text strong style={{ fontSize: 12, color: '#374151' }}>Tỉ lệ đúng</Text>
                        </Table.Summary.Cell>
                        {session.questions.map((q, idx) => {
                          const answered = q.answers.filter((a) => a.selectedOptions.length > 0 || (a.essayText?.length ?? 0) > 0);
                          const correct = q.type !== 'essay' ? answered.filter((a) => isAnswerCorrect(a, q)).length : answered.length;
                          const pct = Math.round((correct / STUDENTS.length) * 100);
                          const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
                          return (
                            <Table.Summary.Cell key={q.id} index={idx + 1} align="center">
                              <Text style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}%</Text>
                            </Table.Summary.Cell>
                          );
                        })}
                        <Table.Summary.Cell index={session.questions.length + 1} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
