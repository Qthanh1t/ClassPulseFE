import { useEffect, useState } from 'react';
import {
  Avatar, Button, Card, Col, Collapse, Row, Statistic,
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
import dashboardService from '../../services/dashboard.service';
import sessionService from '../../services/session.service';
import type { DashboardResponse, StudentResult, QuestionSummary } from '../../types/api';
import PageContainer from '../../components/ui/PageContainer';
import PageSkeleton from '../../components/ui/PageSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { color, radius } from '../../theme/tokens';

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
        background: color.surface,
        borderRadius: radius.card,
        border: `1px solid ${color.border}`,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 46, height: 46, borderRadius: 13, background: lightBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 21, color: accentColor,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: color.textMuted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </div>
        <div className="sq-nums" style={{ fontSize: 23, fontWeight: 700, color: color.text, lineHeight: 1.15 }}>
          {value}{suffix && <span style={{ fontSize: 14, fontWeight: 500, color: color.textSecondary, marginLeft: 2 }}>{suffix}</span>}
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
  const [sessionName, setSessionName] = useState<string | null>(null);
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

    // Get classroomId for "Buổi học mới" button + tên lịch học cho tiêu đề
    sessionService.get(sessionId).then((res) => {
      if (cancelled) return;
      setClassroomId(res.data!.classroomId);
      setSessionName(res.data!.scheduleTitle ?? res.data!.classroomName);
    }).catch(() => null);

    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <PageContainer>
        <PageSkeleton variant="table" />
      </PageContainer>
    );
  }

  if (!dashboard) {
    return (
      <PageContainer>
        <EmptyState
          icon={<BarChartOutlined />}
          title="Không thể tải dữ liệu"
          description="Đã xảy ra lỗi khi tải kết quả buổi học. Vui lòng thử lại."
          action={<Button type="primary" onClick={() => navigate('/classes')}>Về danh sách lớp</Button>}
        />
      </PageContainer>
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
    { name: 'Đúng', value: totalCorrect, color: color.emerald },
    { name: 'Sai', value: totalWrong, color: color.rose },
    { name: 'Bỏ qua', value: totalSkipped, color: color.border },
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
          <Avatar size={30} src={record.avatarUrl ?? undefined} style={{ background: record.avatarColor ?? color.primary, flexShrink: 0, fontWeight: 600, fontSize: 12 }}>
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
      render: (v: number) => <Text style={{ fontSize: 13, color: color.emerald, fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Bỏ qua',
      dataIndex: 'skippedCount',
      key: 'skipped',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Text style={{ fontSize: 13, color: color.textMuted }}>{v}</Text>,
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
    const rateColor = isEssay ? color.primary : (rate >= 70 ? color.emerald : rate >= 40 ? color.amber : color.rose);
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
          <Text style={{ flex: 1, fontSize: 13, color: color.text }} ellipsis>
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
            <Text style={{ fontSize: 11, color: color.textMuted }}>{q.answeredCount}/{q.totalStudents} HS</Text>
          </div>
        </div>
      ),
      children: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: color.primaryLight, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div className="sq-nums" style={{ fontSize: 18, fontWeight: 700, color: color.primary }}>{q.answeredCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Đã trả lời</Text>
            </div>
            {q.type !== 'essay' && (
              <>
                <div style={{ flex: 1, background: color.emeraldLight, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 14px' }}>
                  <div className="sq-nums" style={{ fontSize: 18, fontWeight: 700, color: color.emerald }}>{q.correctCount}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Đúng</Text>
                </div>
                <div style={{ flex: 1, background: color.roseLight, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 14px' }}>
                  <div className="sq-nums" style={{ fontSize: 18, fontWeight: 700, color: color.rose }}>{q.answeredCount - q.correctCount}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Sai</Text>
                </div>
              </>
            )}
            <div style={{ flex: 1, background: color.surface2, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: color.textMuted }}>{q.skippedCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Bỏ qua</Text>
            </div>
          </div>

          {optionChartData.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: color.text }}>
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
                      <Cell key={i} fill={opt.isCorrect ? color.emerald : color.rose} />
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
    <PageContainer>
      {/* Header — flat dark ink panel with accent glow */}
      <div
        style={{
          background: '#1e1b3a',
          borderRadius: radius.page,
          padding: '24px 28px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="sq-noise" />
        <div style={{ position: 'absolute', right: -80, top: -100, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.35), transparent 70%)' }} />

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
                {sessionName ?? 'Buổi học'}
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
            accentColor={color.primary}
            lightBg={color.primaryLight}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Điểm TB"
            value={avgResponseRate}
            suffix="%"
            icon={<TeamOutlined />}
            accentColor={color.emerald}
            lightBg={color.emeraldLight}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Tham gia"
            value={dashboard.overallStats.participantCount}
            suffix={`/${dashboard.totalStudents}`}
            icon={<TrophyOutlined />}
            accentColor={color.amber}
            lightBg={color.amberLight}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="Không tương tác"
            value={nonParticipants}
            icon={<MinusCircleOutlined />}
            accentColor={color.rose}
            lightBg={color.roseLight}
          />
        </Col>
      </Row>

      {/* Charts row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Bar chart */}
        <Col xs={24} md={16}>
          <Card
            style={{ borderRadius: 16, border: `1px solid ${color.border}`, height: '100%' }}
            styles={{ body: { padding: '20px 20px 12px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: color.primaryLight, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChartOutlined style={{ color: color.primary, fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: color.text }}>Tỉ lệ đúng / tham gia theo câu hỏi</div>
                <div style={{ fontSize: 12, color: color.textMuted }}>MCQ: tỉ lệ đúng · Tự luận: tỉ lệ tham gia</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={questionChartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: color.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: color.textMuted }} axisLine={false} tickLine={false} />
                <RechartTooltip
                  formatter={(value: unknown, _n: unknown, props: { payload?: { isEssay?: boolean } }) => [
                    `${String(value)}%`,
                    props.payload?.isEssay ? 'Tỉ lệ tham gia (tự luận)' : 'Tỉ lệ đúng',
                  ]}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={
                        entry.isEssay ? color.primary
                          : entry.rate >= 70 ? color.emerald
                          : entry.rate >= 40 ? color.amber
                          : color.rose
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Tốt (≥70%)', color: color.emerald },
                { label: 'Khá (40-70%)', color: color.amber },
                { label: 'Yếu (<40%)', color: color.rose },
                { label: 'Tự luận', color: color.primary },
              ].map(({ label, color: c }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                  <Text style={{ fontSize: 11, color: color.textMuted }}>{label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Pie chart */}
        <Col xs={24} md={8}>
          <Card
            style={{ borderRadius: 16, border: `1px solid ${color.border}`, height: '100%' }}
            styles={{ body: { padding: '20px 20px 12px' } }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: color.text, marginBottom: 4 }}>Tổng quan kết quả</div>
            <div style={{ fontSize: 12, color: color.textMuted, marginBottom: 8 }}>Phân bố đúng / sai / bỏ qua</div>
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
                  formatter={(value) => <span style={{ fontSize: 12, color: color.textSecondary }}>{value}</span>}
                />
                <RechartTooltip
                  formatter={(value: unknown, name: unknown) => [String(value), String(name)]}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 4 }}>
              {[
                { label: 'Đúng', value: totalCorrect, color: color.emerald },
                { label: 'Sai', value: totalWrong, color: color.rose },
                { label: 'Bỏ qua', value: totalSkipped, color: color.textMuted },
              ].map(({ label, value, color: c }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <Statistic value={value} valueStyle={{ fontSize: 18, fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }} />
                  <div style={{ fontSize: 11, color: color.textMuted }}>{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Detail tabs */}
      <Card style={{ borderRadius: 16, border: `1px solid ${color.border}` }} styles={{ body: { padding: '0 20px 20px' } }}>
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
                  style={{ borderRadius: 12, border: `1px solid ${color.border}` }}
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
                    <Text style={{ fontSize: 12, color: color.textMuted, fontWeight: 500 }}>Kết quả:</Text>
                    {[
                      { icon: <CheckCircleOutlined style={{ color: color.emerald, fontSize: 13 }} />, label: 'Đúng' },
                      { icon: <CloseCircleOutlined style={{ color: color.rose, fontSize: 13 }} />, label: 'Sai' },
                      { icon: <MinusCircleOutlined style={{ color: color.borderStrong, fontSize: 13 }} />, label: 'Bỏ qua' },
                    ].map(({ icon, label }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {icon}
                        <Text style={{ fontSize: 12, color: color.textSecondary }}>{label}</Text>
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
                    style={{ borderRadius: 12, border: `1px solid ${color.border}`, overflow: 'hidden' }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            <Text strong style={{ fontSize: 12, color: color.text }}>Tổng cộng</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="center">
                            <Tooltip title="Tổng câu đã trả lời">
                              <Text style={{ fontSize: 12, color: color.primary, fontWeight: 600 }}>
                                {dashboard.students.reduce((acc, s) => acc + s.answeredCount, 0)}
                              </Text>
                            </Tooltip>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="center">
                            <Text style={{ fontSize: 12, color: color.emerald, fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.correctCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="center">
                            <Text style={{ fontSize: 12, color: color.textMuted, fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.skippedCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="center">
                            <Text style={{ fontSize: 12, color: color.primary, fontWeight: 600 }}>
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
    </PageContainer>
  );
}
