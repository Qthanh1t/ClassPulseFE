import { useEffect, useState } from 'react';
import {
  Avatar, Button, Card, Col, Progress, Row, Tag, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  ArrowLeftOutlined, TrophyOutlined, RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip as RechartTooltip,
  BarChart, Bar, XAxis, YAxis, Cell,
} from 'recharts';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import dashboardService from '../../services/dashboard.service';
import sessionService from '../../services/session.service';
import type { ReviewResponse, QuestionReview } from '../../types/api';
import PageContainer from '../../components/ui/PageContainer';
import PageSkeleton from '../../components/ui/PageSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { color } from '../../theme/tokens';

const { Title, Text } = Typography;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Cao', medium: 'Trung bình', low: 'Thấp',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: color.emerald, medium: color.amber, low: color.rose,
};

const CONFIDENCE_TAG: Record<string, 'success' | 'warning' | 'error'> = {
  high: 'success', medium: 'warning', low: 'error',
};

function isCorrectReview(q: QuestionReview): boolean {
  return q.result === 'correct' || q.result === 'pending_review';
}

function hasAnsweredReview(q: QuestionReview): boolean {
  return q.result !== 'skipped';
}

export default function StudentReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [classroomName, setClassroomName] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      try {
        const [reviewRes, sessionRes] = await Promise.all([
          dashboardService.getStudentReview(sessionId),
          sessionService.get(sessionId),
        ]);
        if (reviewRes.data) setReview(reviewRes.data);
        if (sessionRes.data) setClassroomName(sessionRes.data.classroomName);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  if (loading) {
    return (
      <PageContainer maxWidth={800}>
        <PageSkeleton variant="detail" />
      </PageContainer>
    );
  }

  if (!review) {
    return (
      <PageContainer maxWidth={800}>
        <EmptyState
          icon={<TrophyOutlined />}
          title="Không tìm thấy kết quả"
          description="Không tìm thấy kết quả buổi học này. Buổi học có thể chưa kết thúc."
          action={<Button type="primary" onClick={() => navigate('/classes')}>Về trang chủ</Button>}
        />
      </PageContainer>
    );
  }

  const { correctCount, skippedCount, scorePercent, questions } = review;
  // Essay questions have result='pending_review' (no correct/wrong) — exclude from wrong count
  const wrongCount = questions.filter((q) => q.result === 'wrong').length;

  const isExcellent = scorePercent >= 70;
  const isGood = scorePercent >= 40 && scorePercent < 70;

  const scoreMeta = isExcellent
    ? { label: 'Xuất sắc', sublabel: 'Kết quả rất tốt, tiếp tục phát huy nhé.', accent: color.emerald, icon: <TrophyOutlined style={{ fontSize: 20, color: color.emerald }} /> }
    : isGood
    ? { label: 'Khá tốt', sublabel: 'Nỗ lực thêm một chút để đạt kết quả tốt hơn.', accent: color.amber, icon: <RiseOutlined style={{ fontSize: 20, color: color.amber }} /> }
    : { label: 'Cần cố gắng hơn', sublabel: 'Đừng nản lòng, ôn tập và thử lại nhé.', accent: color.rose, icon: <FallOutlined style={{ fontSize: 20, color: color.rose }} /> };

  const strokeColor = isExcellent ? color.emerald : isGood ? color.amber : color.rose;

  const mcqQuestions = questions.filter((q) => q.type !== 'essay');
  const mcqTotal = mcqQuestions.length;

  // Bar chart data — essay questions shown as indigo (submitted, not graded)
  const questionChartData = questions.map((q, idx) => ({
    name: `C${idx + 1}`,
    value: 1,
    result: q.result === 'correct' ? 'Đúng' : q.result === 'wrong' ? 'Sai' : q.result === 'pending_review' ? 'Đã nộp' : 'Bỏ qua',
    isCorrect: q.result === 'correct',
    isEssay: q.type === 'essay',
    hasAnswer: hasAnsweredReview(q),
    confLabel: q.confidence ? CONFIDENCE_LABEL[q.confidence] : 'Không TL',
  }));

  // Radar chart data — "correct" counts MCQ correct only, not essay submissions
  const radarData = ['high', 'medium', 'low'].map((level) => ({
    subject: level === 'high' ? 'Tự tin cao' : level === 'medium' ? 'Tự tin TB' : 'Tự tin thấp',
    answered: questions.filter((q) => q.confidence === level && hasAnsweredReview(q)).length,
    correct: questions.filter((q) => q.confidence === level && q.type !== 'essay' && q.result === 'correct').length,
  }));

  const sessionDate = new Date(review.startedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <PageContainer maxWidth={800}>
      {/* Back */}
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classes')} style={{ marginBottom: 20, borderRadius: 8, borderColor: color.border, color: color.textSecondary }}>
        Về trang chủ
      </Button>

      {/* Student info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Avatar size={52} style={{ background: me?.avatarColor ?? color.primary, fontWeight: 700, fontSize: 20 }}>
          {(me?.name ?? '?').charAt(0)}
        </Avatar>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: color.text }}>
            {me?.name ?? 'Học sinh'}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {classroomName && `${classroomName} · `}{sessionDate}
          </Text>
        </div>
      </div>

      {/* Score hero */}
      <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${color.border}`, padding: '28px 28px', marginBottom: 20, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: scoreMeta.accent }} />
        <Row align="middle" gutter={24}>
          <Col>
            <Progress
              type="circle"
              percent={scorePercent}
              size={110}
              strokeWidth={8}
              strokeColor={strokeColor}
              trailColor={color.surface2}
              format={() => (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: color.text, lineHeight: 1.1 }}>{correctCount}</div>
                  <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.3 }}>/{mcqTotal}</div>
                </div>
              )}
            />
          </Col>
          <Col flex={1}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {scoreMeta.icon}
              <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.text }}>
                {scoreMeta.label}
              </Title>
            </div>
            <Text style={{ fontSize: 13, color: color.textSecondary, display: 'block', marginBottom: 16 }}>
              {scoreMeta.sublabel}
            </Text>
            <Row gutter={12}>
              {[
                { label: 'Đúng', value: correctCount, color: color.emerald, bg: color.emeraldLight, icon: <CheckCircleOutlined /> },
                { label: 'Sai', value: wrongCount, color: color.rose, bg: color.roseLight, icon: <CloseCircleOutlined /> },
                { label: 'Bỏ qua', value: skippedCount, color: color.textMuted, bg: color.surface2, icon: <MinusCircleOutlined /> },
              ].map(({ label, value, color: c, bg, icon }) => (
                <Col key={label}>
                  <div style={{ background: bg, borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 70 }}>
                    <div style={{ fontSize: 18, color: c, marginBottom: 2 }}>{icon}</div>
                    <div className="sq-nums" style={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: color.textMuted, marginTop: 2 }}>{label}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </div>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={14}>
          <Card style={{ borderRadius: 16, border: `1px solid ${color.border}` }} styles={{ body: { padding: '18px 18px 10px' } }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.text, marginBottom: 2 }}>Kết quả theo câu hỏi</div>
            <div style={{ fontSize: 12, color: color.textMuted, marginBottom: 10 }}>Màu sắc thể hiện đúng / sai / bỏ qua</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={questionChartData} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: color.textMuted }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 1]} />
                <RechartTooltip
                  formatter={(_value: unknown, _name: unknown, props: { payload?: { result?: string; confLabel?: string } }) => {
                    const p = props.payload;
                    return [p?.result ?? '-', `Tự tin: ${p?.confLabel ?? '-'}`];
                  }}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={36}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`q-bar-${index}`}
                      fill={
                        !entry.hasAnswer ? color.border
                          : entry.isEssay ? color.primary
                          : entry.isCorrect ? color.emerald
                          : color.rose
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[{ label: 'Đúng', color: color.emerald }, { label: 'Sai', color: color.rose }, { label: 'Bỏ qua', color: color.border }, { label: 'Đã nộp (TL)', color: color.primary }].map(({ label, color: c }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                  <Text style={{ fontSize: 11, color: color.textMuted }}>{label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card style={{ borderRadius: 16, border: `1px solid ${color.border}`, height: '100%' }} styles={{ body: { padding: '18px 18px 10px' } }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.text, marginBottom: 2 }}>Tự tin & Chính xác</div>
            <div style={{ fontSize: 12, color: color.textMuted, marginBottom: 4 }}>Xanh = trả lời · Cam = đúng</div>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
                <PolarGrid stroke={color.border} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: color.textMuted }} />
                <Radar name="Trả lời" dataKey="answered" stroke={color.primary} fill={color.primary} fillOpacity={0.15} strokeWidth={1.5} />
                <Radar name="Đúng" dataKey="correct" stroke={color.emerald} fill={color.emerald} fillOpacity={0.25} strokeWidth={1.5} />
                <RechartTooltip contentStyle={{ borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Per-question review */}
      <Title level={5} style={{ fontSize: 16, fontWeight: 700, color: color.text, marginBottom: 14 }}>
        Chi tiết từng câu hỏi
      </Title>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {questions.map((q, idx) => {
          const answered = hasAnsweredReview(q);
          const correct = isCorrectReview(q);

          let statusIcon: React.ReactNode = <MinusCircleOutlined style={{ color: color.borderStrong, fontSize: 18 }} />;
          let borderAccent: string = color.border;
          let headerBg: string = color.surface2;

          if (answered && correct) {
            statusIcon = <CheckCircleOutlined style={{ color: color.emerald, fontSize: 18 }} />;
            borderAccent = color.emerald;
            headerBg = color.emeraldLight;
          } else if (answered && !correct && q.type !== 'essay') {
            statusIcon = <CloseCircleOutlined style={{ color: color.rose, fontSize: 18 }} />;
            borderAccent = color.rose;
            headerBg = color.roseLight;
          }

          return (
            <div key={q.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${color.border}`, overflow: 'hidden' }}>
              {/* Question header */}
              <div style={{ background: headerBg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${color.border}`, borderLeft: `3px solid ${borderAccent}` }}>
                {statusIcon}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  <Tag color="blue" style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0, fontWeight: 600 }}>
                    Câu {idx + 1}
                  </Tag>
                  <Tag color="default" style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0 }}>
                    {q.type === 'single' ? 'Trắc nghiệm' : q.type === 'multiple' ? 'Nhiều đáp án' : 'Tự luận'}
                  </Tag>
                  {answered && q.confidence && (
                    <Tag color={CONFIDENCE_TAG[q.confidence]} style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0 }}>
                      Tự tin: {CONFIDENCE_LABEL[q.confidence]}
                    </Tag>
                  )}
                  {!answered && (
                    <Tag color="default" style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0, color: color.textMuted }}>
                      Không trả lời
                    </Tag>
                  )}
                </div>
                {answered && q.confidence && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CONFIDENCE_COLOR[q.confidence], flexShrink: 0 }} />
                )}
              </div>

              {/* Question body */}
              <div style={{ padding: '14px 18px' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: q.content }}
                  style={{ fontSize: 14, marginBottom: 12, fontWeight: 500, color: color.text, lineHeight: 1.6 }}
                />

                {/* MCQ options */}
                {q.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {q.options.map((opt) => {
                      let bg: string = color.surface2;
                      let border = `1px solid ${color.border}`;
                      let textColor: string = color.text;

                      if (opt.correct) { bg = color.emeraldLight; border = `1.5px solid ${color.emerald}`; textColor = '#065f46'; }
                      if (opt.selectedByMe && !opt.correct) { bg = color.roseLight; border = `1.5px solid ${color.rose}`; textColor = '#9f1239'; }

                      return (
                        <div key={opt.id} style={{ padding: '8px 12px', borderRadius: 10, background: bg, border, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Tag color={opt.correct ? 'success' : opt.selectedByMe ? 'error' : 'default'} style={{ minWidth: 26, textAlign: 'center', borderRadius: 6, fontWeight: 700, margin: 0, fontSize: 12 }}>
                            {opt.label}
                          </Tag>
                          <Text style={{ fontSize: 13, color: textColor, flex: 1 }}>{opt.text}</Text>
                          {opt.correct && <CheckCircleOutlined style={{ color: color.emerald, fontSize: 14, flexShrink: 0 }} />}
                          {opt.selectedByMe && !opt.correct && <CloseCircleOutlined style={{ color: color.rose, fontSize: 14, flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Essay */}
                {q.type === 'essay' && q.myEssayText && (
                  <div style={{ background: color.surface2, borderRadius: 10, padding: '10px 14px', border: `1px solid ${color.border}` }}>
                    <Text style={{ fontSize: 13, fontStyle: 'italic', color: color.text }}>"{q.myEssayText}"</Text>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Button onClick={() => navigate('/classes')} style={{ borderRadius: 10, height: 40, paddingInline: 24, borderColor: color.border, color: color.textSecondary }}>
          Về trang chủ
        </Button>
        <Button
          type="primary"
          onClick={() => navigate('/classes')}
          className="sq-press"
          style={{ borderRadius: 10, height: 40, paddingInline: 24, fontWeight: 600 }}
        >
          Tiếp tục học
        </Button>
      </div>
    </PageContainer>
  );
}
