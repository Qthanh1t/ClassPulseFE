import { useEffect, useState } from 'react';
import {
  Avatar, Button, Card, Col, Collapse, Row, Skeleton, Statistic,
  Table, Tag, Typography, Tooltip, Tabs,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  TrophyOutlined, ArrowLeftOutlined, TeamOutlined, QuestionCircleOutlined,
  BarChartOutlined, TableOutlined,
} from '@ant-design/icons';
import {
  Tooltip as RechartTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import dashboardService from '../../services/dashboard.service';
import sessionService from '../../services/session.service';
import answerService from '../../services/answer.service';
import type {
  DashboardResponse, StudentResult, QuestionSummary, StudentAnswerDto, OptionResult,
} from '../../types/api';
import PageContainer from '../../components/ui/PageContainer';
import PageSkeleton from '../../components/ui/PageSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { color, radius } from '../../theme/tokens';

const { Title, Text } = Typography;

type AnswersByQuestion = Map<string, StudentAnswerDto[]>;

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '');

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

const confidenceMeta: Record<string, { label: string; color: string }> = {
  high: { label: 'Tự tin cao', color: 'success' },
  medium: { label: 'Tự tin vừa', color: 'warning' },
  low: { label: 'Chưa chắc chắn', color: 'error' },
};

/** Chip nhỏ hiển thị 1 đáp án học sinh đã chọn — emerald nếu là đáp án đúng, rose nếu sai. */
function OptionChip({ option }: { option: OptionResult }) {
  return (
    <Tooltip title={option.text}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 22, height: 20, padding: '0 6px', borderRadius: 6,
          fontSize: 11, fontWeight: 700, cursor: 'default',
          background: option.correct ? color.emeraldLight : color.roseLight,
          color: option.correct ? color.emerald : color.rose,
          border: `1px solid ${option.correct ? '#a7e3cd' : '#f6c6d4'}`,
        }}
      >
        {option.label}
      </span>
    </Tooltip>
  );
}

/** Danh sách câu trả lời của từng học sinh cho 1 câu hỏi (MCQ: đáp án chọn; tự luận: bài viết). */
function QuestionAnswers({ question, answers, studentMeta }: {
  question: QuestionSummary;
  answers: StudentAnswerDto[];
  studentMeta: Map<string, { avatarColor?: string; avatarUrl?: string }>;
}) {
  const isEssay = question.type === 'essay';
  const sorted = answers
    .filter((a) => (isEssay ? !!a.essayText?.trim() : a.selectedOptionIds.length > 0))
    .sort((a, b) => a.student.name.localeCompare(b.student.name, 'vi'));

  if (sorted.length === 0) {
    return <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Chưa có học sinh nào trả lời câu hỏi này.</Text>;
  }

  if (isEssay) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((a) => {
          const meta = studentMeta.get(a.student.id);
          const conf = a.confidence ? confidenceMeta[a.confidence] : null;
          return (
            <div
              key={a.id}
              style={{ border: `1px solid ${color.border}`, borderRadius: 10, background: color.surface, overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', background: color.surface2, borderBottom: `1px solid ${color.border}`,
                }}
              >
                <Avatar size={24} src={meta?.avatarUrl ?? undefined} style={{ background: meta?.avatarColor ?? color.primary, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                  {a.student.name.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 13, fontWeight: 600, flex: 1 }} ellipsis>{a.student.name}</Text>
                {conf && (
                  <Tag color={conf.color} style={{ borderRadius: 20, fontSize: 11, marginInlineEnd: 0 }}>{conf.label}</Tag>
                )}
                <Text style={{ fontSize: 11, color: color.textMuted, flexShrink: 0 }}>
                  {new Date(a.answeredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </div>
              <div
                className="sq-rich"
                dangerouslySetInnerHTML={{ __html: a.essayText! }}
                style={{ padding: '10px 12px', fontSize: 13.5, color: color.text, lineHeight: 1.6 }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  const optionById = new Map((question.options ?? []).map((o) => [o.id, o]));

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {sorted.map((a, i) => {
        const meta = studentMeta.get(a.student.id);
        const conf = a.confidence ? confidenceMeta[a.confidence] : null;
        const selected = a.selectedOptionIds
          .map((id) => optionById.get(id))
          .filter((o): o is OptionResult => !!o)
          .sort((x, y) => x.label.localeCompare(y.label));
        return (
          <div
            key={a.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
              borderTop: i > 0 ? `1px solid ${color.border}` : 'none',
              background: i % 2 === 1 ? color.surface2 : color.surface,
            }}
          >
            <Avatar size={22} src={meta?.avatarUrl ?? undefined} style={{ background: meta?.avatarColor ?? color.primary, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
              {a.student.name.charAt(0)}
            </Avatar>
            <Text style={{ fontSize: 12.5, fontWeight: 500, width: 150, flexShrink: 0 }} ellipsis>{a.student.name}</Text>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {selected.map((o) => <OptionChip key={o.id} option={o} />)}
            </div>
            {a.isCorrect
              ? <CheckCircleOutlined style={{ color: color.emerald, fontSize: 14, flexShrink: 0 }} />
              : <CloseCircleOutlined style={{ color: color.rose, fontSize: 14, flexShrink: 0 }} />}
            {conf && (
              <Tag color={conf.color} style={{ borderRadius: 20, fontSize: 10.5, marginInlineEnd: 0, lineHeight: '16px', flexShrink: 0 }}>{conf.label}</Tag>
            )}
            <Text className="sq-nums" style={{ fontSize: 11, color: color.textMuted, flexShrink: 0, width: 38, textAlign: 'right' }}>
              {new Date(a.answeredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

/** Chi tiết câu trả lời của 1 học sinh qua tất cả câu hỏi — render trong expanded row của bảng. */
function StudentAnswerDetail({ studentId, questions, answersByQuestion, failed }: {
  studentId: string;
  questions: QuestionSummary[];
  answersByQuestion: AnswersByQuestion | null;
  failed: boolean;
}) {
  if (failed) {
    return <Text type="secondary" style={{ fontSize: 12 }}>Không thể tải câu trả lời của học sinh.</Text>;
  }
  if (answersByQuestion === null) {
    return <Skeleton active title={false} paragraph={{ rows: 3 }} style={{ margin: '4px 0' }} />;
  }
  if (questions.length === 0) {
    return <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Buổi học chưa có câu hỏi nào.</Text>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0' }}>
      {questions.map((q) => {
        const isEssay = q.type === 'essay';
        const answer = answersByQuestion.get(q.id)?.find((a) => a.student.id === studentId);
        const optionById = new Map((q.options ?? []).map((o) => [o.id, o]));
        const selected = (answer?.selectedOptionIds ?? [])
          .map((id) => optionById.get(id))
          .filter((o): o is OptionResult => !!o)
          .sort((x, y) => x.label.localeCompare(y.label));
        const conf = answer?.confidence ? confidenceMeta[answer.confidence] : null;

        const resultTag = !answer
          ? <Tag style={{ borderRadius: 20, fontSize: 11, marginInlineEnd: 0, color: color.textMuted }}>Bỏ qua</Tag>
          : isEssay
            ? <Tag style={{ borderRadius: 20, fontSize: 11, marginInlineEnd: 0, background: color.primaryLight, color: color.primary, border: 'none' }}>Đã trả lời</Tag>
            : answer.isCorrect
              ? <Tag color="success" icon={<CheckCircleOutlined />} style={{ borderRadius: 20, fontSize: 11, marginInlineEnd: 0 }}>Đúng</Tag>
              : <Tag color="error" icon={<CloseCircleOutlined />} style={{ borderRadius: 20, fontSize: 11, marginInlineEnd: 0 }}>Sai</Tag>;

        return (
          <div
            key={q.id}
            style={{ border: `1px solid ${color.border}`, borderRadius: 10, background: color.surface, padding: '9px 12px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="blue" style={{ flexShrink: 0, borderRadius: 6, fontWeight: 600, marginInlineEnd: 0 }}>Câu {q.questionOrder}</Tag>
              <Text style={{ flex: 1, fontSize: 12.5, color: color.textSecondary }} ellipsis>
                <span dangerouslySetInnerHTML={{ __html: stripHtml(q.content) }} />
              </Text>
              {conf && (
                <Tag color={conf.color} style={{ borderRadius: 20, fontSize: 10.5, marginInlineEnd: 0, flexShrink: 0 }}>{conf.label}</Tag>
              )}
              <div style={{ flexShrink: 0 }}>{resultTag}</div>
            </div>
            {answer && !isEssay && selected.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <Text style={{ fontSize: 11.5, color: color.textMuted }}>Đã chọn:</Text>
                {selected.map((o) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: 360 }}>
                    <OptionChip option={o} />
                    <Text style={{ fontSize: 12, color: color.textSecondary }} ellipsis>{o.text}</Text>
                  </div>
                ))}
              </div>
            )}
            {answer && isEssay && answer.essayText && (
              <div
                className="sq-rich"
                dangerouslySetInnerHTML={{ __html: answer.essayText }}
                style={{
                  marginTop: 8, padding: '8px 10px', fontSize: 13, color: color.text, lineHeight: 1.6,
                  background: color.surface2, borderRadius: 8, border: `1px solid ${color.border}`,
                }}
              />
            )}
          </div>
        );
      })}
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
  const [allAnswers, setAllAnswers] = useState<AnswersByQuestion | null>(null);
  const [answersFailed, setAnswersFailed] = useState(false);

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

  // Tải toàn bộ câu trả lời của mọi câu hỏi (teacher được xem qua answerService.list)
  // — dùng cho mục "Câu trả lời của học sinh" trong panel câu hỏi + expanded row bảng học sinh
  useEffect(() => {
    if (!sessionId || !dashboard) return;

    let cancelled = false;
    Promise.all(
      dashboard.questions.map((q) =>
        answerService.list(sessionId, q.id).then((res) => [q.id, res.data ?? []] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setAllAnswers(new Map(entries));
    }).catch(() => {
      if (!cancelled) setAnswersFailed(true);
    });

    return () => { cancelled = true; };
  }, [sessionId, dashboard]);

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

  // Avatar info for answer headers (StudentAnswerDto only carries id + name)
  const studentMeta = new Map(
    dashboard.students.map((s) => [s.studentId, { avatarColor: s.avatarColor, avatarUrl: s.avatarUrl }]),
  );

  // Question collapse items
  const questionCollapseItems = dashboard.questions.map((q: QuestionSummary, idx: number) => {
    const isEssay = q.type === 'essay';
    const rate = q.totalStudents > 0
      ? isEssay
        ? Math.round((q.answeredCount / q.totalStudents) * 100)
        : Math.round((q.correctCount / q.totalStudents) * 100)
      : 0;
    const rateColor = isEssay ? color.primary : (rate >= 70 ? color.emerald : rate >= 40 ? color.amber : color.rose);
    const maxOptionCount = Math.max(1, ...(q.options ?? []).map((o) => o.count));

    return {
      key: q.id,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <Tag color="blue" style={{ flexShrink: 0, borderRadius: 6, fontWeight: 600 }}>C{idx + 1}</Tag>
          <Text style={{ flex: 1, fontSize: 13, color: color.text }} ellipsis>
            <span dangerouslySetInnerHTML={{ __html: stripHtml(q.content) }} />
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
          {/* Full rich-text question content (header is truncated plain text) */}
          <div
            className="sq-rich"
            dangerouslySetInnerHTML={{ __html: q.content }}
            style={{
              fontSize: 14, fontWeight: 500, color: color.text, lineHeight: 1.6,
              marginBottom: 12, padding: '10px 12px',
              background: color.surface2, borderRadius: 8, border: `1px solid ${color.border}`,
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1, background: color.primaryLight, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div className="sq-nums" style={{ fontSize: 18, fontWeight: 700, color: color.primary }}>{q.answeredCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Đã trả lời</Text>
            </div>
            {!isEssay && (
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
              <div className="sq-nums" style={{ fontSize: 18, fontWeight: 700, color: color.textMuted }}>{q.skippedCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Bỏ qua</Text>
            </div>
          </div>

          {/* Phân bố đáp án — hàng ngang có thanh tỉ lệ, đáp án đúng tô emerald */}
          {!isEssay && (q.options ?? []).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: color.text }}>
                Phân bố đáp án
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(q.options ?? []).map((opt) => {
                  const pct = q.answeredCount > 0 ? Math.round((opt.count / q.answeredCount) * 100) : 0;
                  return (
                    <div
                      key={opt.id}
                      style={{
                        position: 'relative', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        border: `1px solid ${opt.correct ? '#a7e3cd' : color.border}`,
                        background: color.surface,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute', inset: 0,
                          width: `${maxOptionCount > 0 ? (opt.count / maxOptionCount) * 100 : 0}%`,
                          background: opt.correct ? color.emeraldLight : color.surface2,
                          transition: 'width .3s ease',
                        }}
                      />
                      <Tag
                        style={{
                          position: 'relative', minWidth: 24, textAlign: 'center', margin: 0,
                          fontSize: 11, fontWeight: 700, borderRadius: 6, flexShrink: 0,
                          background: opt.correct ? color.emerald : color.surface,
                          color: opt.correct ? '#fff' : color.textSecondary,
                          borderColor: opt.correct ? color.emerald : color.borderStrong,
                        }}
                      >
                        {opt.label}
                      </Tag>
                      <Text style={{ position: 'relative', flex: 1, fontSize: 13, color: color.text }} ellipsis>{opt.text}</Text>
                      {opt.correct && <CheckCircleOutlined style={{ position: 'relative', color: color.emerald, fontSize: 14, flexShrink: 0 }} />}
                      <Text className="sq-nums" style={{ position: 'relative', fontSize: 12, fontWeight: 600, color: color.textSecondary, flexShrink: 0 }}>
                        {opt.count} HS · {pct}%
                      </Text>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Câu trả lời cụ thể của từng học sinh */}
          <div>
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8, color: color.text }}>
              Câu trả lời của học sinh
            </Text>
            {answersFailed ? (
              <Text type="secondary" style={{ fontSize: 12 }}>Không thể tải câu trả lời của học sinh.</Text>
            ) : allAnswers === null ? (
              <Skeleton active title={false} paragraph={{ rows: 3 }} style={{ marginTop: 4 }} />
            ) : (
              <QuestionAnswers question={q} answers={allAnswers.get(q.id) ?? []} studentMeta={studentMeta} />
            )}
          </div>
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
        {/* Kết quả theo câu hỏi — thanh ngang xếp chồng đúng/sai/bỏ qua */}
        <Col xs={24} md={16}>
          <Card
            style={{ borderRadius: 16, border: `1px solid ${color.border}`, height: '100%' }}
            styles={{ body: { padding: '20px 20px 14px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, background: color.primaryLight, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChartOutlined style={{ color: color.primary, fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: color.text }}>Kết quả theo câu hỏi</div>
                <div style={{ fontSize: 12, color: color.textMuted }}>Tỉ lệ đúng / sai / bỏ qua từng câu · tự luận tính theo tham gia</div>
              </div>
            </div>

            {dashboard.questions.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Buổi học chưa có câu hỏi nào.</Text>
            ) : (
              <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 268, overflowY: 'auto' }}>
                {dashboard.questions.map((q) => {
                  const isEssay = q.type === 'essay';
                  const wrong = q.answeredCount - q.correctCount;
                  const rate = q.totalStudents > 0
                    ? isEssay
                      ? Math.round((q.answeredCount / q.totalStudents) * 100)
                      : Math.round((q.correctCount / q.totalStudents) * 100)
                    : 0;
                  const rateColor = isEssay ? color.primary : (rate >= 70 ? color.emerald : rate >= 40 ? color.amber : color.rose);
                  const segments = isEssay
                    ? [
                        { label: 'Tham gia', value: q.answeredCount, fill: color.primary },
                        { label: 'Bỏ qua', value: q.skippedCount, fill: color.border },
                      ]
                    : [
                        { label: 'Đúng', value: q.correctCount, fill: color.emerald },
                        { label: 'Sai', value: wrong, fill: color.rose },
                        { label: 'Bỏ qua', value: q.skippedCount, fill: color.border },
                      ];
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Text className="sq-nums" style={{ width: 50, flexShrink: 0, fontSize: 12, fontWeight: 600, color: color.textSecondary }}>
                        Câu {q.questionOrder}
                      </Text>
                      <div style={{ flex: 1, display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: color.surface2 }}>
                        {segments.filter((s) => s.value > 0).map((s) => (
                          <Tooltip key={s.label} title={`${s.label}: ${s.value} HS`}>
                            <div
                              style={{
                                width: `${q.totalStudents > 0 ? (s.value / q.totalStudents) * 100 : 0}%`,
                                background: s.fill,
                              }}
                            />
                          </Tooltip>
                        ))}
                      </div>
                      <Text className="sq-nums" style={{ width: 72, textAlign: 'right', flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: rateColor }}>
                        {rate}%{isEssay && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>TG</span>}
                      </Text>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Đúng', color: color.emerald },
                { label: 'Sai', color: color.rose },
                { label: 'Bỏ qua', color: color.border },
                { label: 'Tự luận: tham gia', color: color.primary },
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
                  <Text style={{ fontSize: 12, color: color.textMuted, display: 'block', marginBottom: 12 }}>
                    Bấm vào từng hàng để xem chi tiết câu trả lời của học sinh.
                  </Text>
                  <Table
                    dataSource={dashboard.students}
                    columns={studentColumns}
                    rowKey="studentId"
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    style={{ borderRadius: 12, border: `1px solid ${color.border}`, overflow: 'hidden' }}
                    expandable={{
                      expandRowByClick: true,
                      expandedRowRender: (record: StudentResult) => (
                        <StudentAnswerDetail
                          studentId={record.studentId}
                          questions={dashboard.questions}
                          answersByQuestion={allAnswers}
                          failed={answersFailed}
                        />
                      ),
                    }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={2}>
                            <Text strong style={{ fontSize: 12, color: color.text }}>Tổng cộng</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="center">
                            <Tooltip title="Tổng câu đã trả lời">
                              <Text style={{ fontSize: 12, color: color.primary, fontWeight: 600 }}>
                                {dashboard.students.reduce((acc, s) => acc + s.answeredCount, 0)}
                              </Text>
                            </Tooltip>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} align="center">
                            <Text style={{ fontSize: 12, color: color.emerald, fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.correctCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={4} align="center">
                            <Text style={{ fontSize: 12, color: color.textMuted, fontWeight: 600 }}>
                              {dashboard.students.reduce((acc, s) => acc + s.skippedCount, 0)}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} align="center">
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
