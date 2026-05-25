import { useEffect, useState } from 'react';
import {
  Avatar, Button, Card, Col, Collapse, Row, Statistic,
  Table, Tag, Typography, Tooltip, Tabs, Spin,
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
import dashboardService from '../../services/dashboard.service';
import sessionService from '../../services/session.service';
import type { DashboardResponse, StudentResult, QuestionSummary } from '../../types/api';

const { Title, Text } = Typography;

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
          width: 48, height: 48, borderRadius: 14, background: lightBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 22, color: accentColor,
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
  const { sessionId } = useParams<{ sessionId: string }>();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const fetchDashboard = () => {
      dashboardService.getTeacherDashboard(sessionId).then((res) => {
        if (cancelled) return;
        setDashboard(res.data!);
        setLoading(false);
      }).catch((err: unknown) => {
        if (cancelled) return;
        const code = (err as { response?: { data?: { error?: { code?: string } } } })
          ?.response?.data?.error?.code;
        if (code === 'SESSION_NOT_ENDED') {
          setTimeout(fetchDashboard, 1500);
        } else {
          setLoading(false);
        }
      });
    };

    fetchDashboard();

    // Get classroomId for "Buổi học mới" button
    sessionService.get(sessionId).then((res) => {
      if (!cancelled) setClassroomId(res.data!.classroomId);
    }).catch(() => null);

    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#64748b' }}>Đang tải kết quả buổi học...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        Không thể tải dữ liệu. Vui lòng thử lại.
      </div>
    );
  }

  // ── Computed stats ──────────────────────────────────────────────────

  const mcqQuestions = dashboard.questions.filter((q) => q.type !== 'essay');
  const totalCorrect = mcqQuestions.reduce((acc, q) => acc + q.correctCount, 0);
  const totalAnsweredMcq = mcqQuestions.reduce((acc, q) => acc + q.answeredCount, 0);
  const totalWrong = totalAnsweredMcq - totalCorrect;
  const totalSkipped = mcqQuestions.reduce((acc, q) => acc + q.skippedCount, 0);

  const avgResponseRate = Math.round(dashboard.overallStats.avgScorePercent);
  const nonParticipants = dashboard.totalStudents - dashboard.overallStats.participantCount;

  // Chart data: correct rate for MCQ, participation rate for essay
  const questionChartData = dashboard.questions.map((q) => {
    const isEssay = q.type === 'essay';
    return {
      name: `Câu ${q.questionOrder}`,
      rate: q.totalStudents > 0
        ? isEssay
          ? Math.round((q.answeredCount / q.totalStudents) * 100)
          : Math.round((q.correctCount / q.totalStudents) * 100)
        : 0,
      correct: q.correctCount,
      answered: q.answeredCount,
      total: q.totalStudents,
      type: q.type,
      isEssay,
    };
  });

  const pieData = [
    { name: 'Đúng', value: totalCorrect, color: '#10b981' },
    { name: 'Sai', value: totalWrong, color: '#f43f5e' },
    { name: 'Bỏ qua', value: totalSkipped, color: '#e2e8f0' },
  ];

  // Student table columns
  const studentColumns = [
    {
      title: 'Học sinh',
      key: 'student',
      fixed: 'left' as const,
      width: 180,
      render: (_: unknown, record: StudentResult) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={30} style={{ background: record.avatarColor ?? '#6366f1', flexShrink: 0, fontWeight: 600, fontSize: 12 }}>
            {record.name.charAt(0)}
          </Avatar>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{record.name}</Text>
        </div>
      ),
    },
    {
      title: 'Đã trả lời',
      dataIndex: 'answeredCount',
      key: 'answered',
      width: 110,
      align: 'center' as const,
      render: (v: number) => <Text style={{ fontSize: 13 }}>{v}/{dashboard.totalQuestions}</Text>,
    },
    {
      title: 'Đúng',
      dataIndex: 'correctCount',
      key: 'correct',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Text style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Bỏ qua',
      dataIndex: 'skippedCount',
      key: 'skipped',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Text style={{ fontSize: 13, color: '#94a3b8' }}>{v}</Text>,
    },
    {
      title: 'Điểm',
      dataIndex: 'scorePercent',
      key: 'score',
      width: 90,
      align: 'center' as const,
      render: (v: number) => (
        <Tag
          color={v >= 70 ? 'success' : v >= 40 ? 'warning' : 'error'}
          style={{ borderRadius: 20, padding: '1px 10px', fontWeight: 600 }}
        >
          {v}%
        </Tag>
      ),
    },
  ];

  // Question collapse items
  const questionCollapseItems = dashboard.questions.map((q: QuestionSummary, idx: number) => {
    const isEssay = q.type === 'essay';
    const rate = q.totalStudents > 0
      ? isEssay
        ? Math.round((q.answeredCount / q.totalStudents) * 100)
        : Math.round((q.correctCount / q.totalStudents) * 100)
      : 0;
    const rateColor = isEssay ? '#6366f1' : (rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#f43f5e');
    const optionChartData = (q.options ?? []).map((opt) => ({
      name: opt.label,
      count: opt.count,
      isCorrect: opt.correct,
      text: opt.text,
    }));

    return {
      key: q.id,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <Tag color="blue" style={{ flexShrink: 0, borderRadius: 6, fontWeight: 600 }}>C{idx + 1}</Tag>
          <Text style={{ flex: 1, fontSize: 13, color: '#374151' }} ellipsis>
            <span dangerouslySetInnerHTML={{ __html: q.content.replace(/<[^>]+>/g, '') }} />
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Tooltip title={isEssay ? `Tỉ lệ tham gia: ${rate}%` : `Tỉ lệ đúng: ${rate}%`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: rateColor }} />
                <Text style={{ fontSize: 12, color: rateColor, fontWeight: 600 }}>
                  {rate}%{isEssay && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>tham gia</span>}
                </Text>
              </div>
            </Tooltip>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{q.answeredCount}/{q.totalStudents} HS</Text>
          </div>
        </div>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{q.answeredCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Đã trả lời</Text>
            </div>
            {q.type !== 'essay' && (
              <>
                <div style={{ flex: 1, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>{q.correctCount}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Đúng</Text>
                </div>
                <div style={{ flex: 1, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>{q.answeredCount - q.correctCount}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Sai</Text>
                </div>
              </>
            )}
            <div style={{ flex: 1, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>{q.skippedCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Bỏ qua</Text>
            </div>
          </div>

          {optionChartData.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: '#374151' }}>
                Phân bố đáp án
              </Text>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={optionChartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
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
                    {optionChartData.map((opt, i) => (
                      <Cell key={i} fill={opt.isCorrect ? '#10b981' : '#fca5a5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ),
    };
  });

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
                {dashboard.sessionId}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
                {new Date(dashboard.startedAt).toLocaleDateString('vi-VN')}
                {' · '}
                {Math.floor(dashboard.durationSeconds / 60)} phút
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {classroomId && (
                <Button
                  onClick={() => navigate(`/session/teacher/${classroomId}`)}
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
              )}
              <Button
                type="primary"
                icon={<RiseOutlined />}
                onClick={() => navigate(`/review/${sessionId}`)}
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
            value={dashboard.totalQuestions}
            icon={<QuestionCircleOutlined />}
            accentColor="#6366f1"
            lightBg="#eef2ff"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Điểm TB"
            value={avgResponseRate}
            suffix="%"
            icon={<TeamOutlined />}
            accentColor="#10b981"
            lightBg="#f0fdf4"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Tham gia"
            value={dashboard.overallStats.participantCount}
            suffix={`/${dashboard.totalStudents}`}
            icon={<TrophyOutlined />}
            accentColor="#f59e0b"
            lightBg="#fffbeb"
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Không tương tác"
            value={nonParticipants}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Tỉ lệ đúng / tham gia theo câu hỏi</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>MCQ: tỉ lệ đúng · Tự luận: tỉ lệ tham gia</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={questionChartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <RechartTooltip
                  formatter={(value: unknown, _n: unknown, props: { payload?: { isEssay?: boolean } }) => [
                    `${String(value)}%`,
                    props.payload?.isEssay ? 'Tỉ lệ tham gia (tự luận)' : 'Tỉ lệ đúng',
                  ]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={
                        entry.isEssay ? '#6366f1'
                          : entry.rate >= 70 ? '#10b981'
                          : entry.rate >= 40 ? '#f59e0b'
                          : '#f43f5e'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Tốt (≥70%)', color: '#10b981' },
                { label: 'Khá (40–70%)', color: '#f59e0b' },
                { label: 'Yếu (<40%)', color: '#f43f5e' },
                { label: 'Tự luận', color: '#6366f1' },
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

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 4 }}>
              {[
                { label: 'Đúng', value: totalCorrect, color: '#10b981' },
                { label: 'Sai', value: totalWrong, color: '#f43f5e' },
                { label: 'Bỏ qua', value: totalSkipped, color: '#94a3b8' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <Statistic value={value} valueStyle={{ fontSize: 18, fontWeight: 700, color }} />
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
                  items={questionCollapseItems}
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
                  </div>
                  <Table
                    dataSource={dashboard.students}
                    columns={studentColumns}
                    rowKey="studentId"
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            <Text strong style={{ fontSize: 12, color: '#374151' }}>Tổng cộng</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="center">
                            <Tooltip title="Tổng câu đã trả lời">
                              <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                                {dashboard.students.reduce((acc, s) => acc + s.answeredCount, 0)}
                              </Text>
                            </Tooltip>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="center">
                            <Text style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.correctCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="center">
                            <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.skippedCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="center">
                            <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                              {dashboard.students.length > 0
                                ? Math.round(dashboard.students.reduce((acc, s) => acc + s.scorePercent, 0) / dashboard.students.length)
                                : 0}%
                            </Text>
                          </Table.Summary.Cell>
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
