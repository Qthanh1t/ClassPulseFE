import { useState, useEffect, useCallback } from 'react';
import { Tabs, Avatar, Tag, Spin, Empty, Typography, Divider } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import LiveQuestionStats from './LiveQuestionStats';
import answerService from '../../services/answer.service';
import type { QuestionDto, QuestionStatsDto, PresenceDto, StudentAnswerDto } from '../../types/api';

const { Text } = Typography;

const CONFIDENCE_CONFIG = {
  high: { bg: '#e7f6ef', border: '#a7e3cd', color: '#0ea672', label: 'Tự tin cao' },
  medium: { bg: '#fbf0db', border: '#ecc15f', color: '#b87309', label: 'Trung bình' },
  low: { bg: '#fceaef', border: '#f1a8bd', color: '#be123c', label: 'Chưa chắc' },
};

function formatAt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface CardProps {
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  answer?: StudentAnswerDto;
  question: QuestionDto;
}

function StudentAnswerCard({ name, avatarColor, avatarUrl, answer, question }: CardProps) {
  const optMap = new Map((question.options ?? []).map((o) => [o.id, o]));
  const answered = !!answer;
  const conf = answer?.confidence ? CONFIDENCE_CONFIG[answer.confidence] : null;

  let borderColor = '#e7e3dc';
  let bgColor = '#f3f1ec';
  if (answered) {
    if (answer.isCorrect === true) { borderColor = '#a7e3cd'; bgColor = '#e7f6ef'; }
    else if (answer.isCorrect === false) { borderColor = '#f6c6d4'; bgColor = '#fceaef'; }
    else { borderColor = '#c7d2fe'; bgColor = '#eceafd'; }
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        opacity: answered ? 1 : 0.6,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Avatar size={26} src={avatarUrl ?? undefined} style={{ background: avatarColor ?? '#4f46e5', fontSize: 11, flexShrink: 0 }}>
          {name.charAt(0).toUpperCase()}
        </Avatar>
        <Text strong style={{ fontSize: 13, flex: 1, minWidth: 80 }}>
          {name}
        </Text>

        {answered && conf && (
          <Tag
            style={{
              fontSize: 11, padding: '0 6px', borderRadius: 10, margin: 0,
              background: conf.bg, border: `1px solid ${conf.border}`, color: conf.color,
            }}
          >
            {conf.label}
          </Tag>
        )}

        {answered && answer.isCorrect === true && (
          <CheckCircleOutlined style={{ color: '#0ea672', fontSize: 15, flexShrink: 0 }} />
        )}
        {answered && answer.isCorrect === false && (
          <CloseCircleOutlined style={{ color: '#e23d6d', fontSize: 15, flexShrink: 0 }} />
        )}

        {!answered && (
          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>Chưa trả lời</Text>
        )}

        {answered && (
          <Text style={{ fontSize: 11, color: '#a8a29e', flexShrink: 0 }}>
            {formatAt(answer.answeredAt)}
          </Text>
        )}
      </div>

      {/* MCQ selected options */}
      {answered && (answer.selectedOptionIds?.length ?? 0) > 0 && question.type !== 'essay' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 34, marginTop: 7 }}>
          {answer.selectedOptionIds!.map((optId) => {
            const opt = optMap.get(optId);
            if (!opt) return null;
            return (
              <Tag key={optId} color={opt.isCorrect ? 'success' : 'error'} style={{ fontSize: 12, borderRadius: 6 }}>
                <strong>{opt.label}.</strong>&nbsp;{opt.text}
              </Tag>
            );
          })}
        </div>
      )}

      {/* Essay answer */}
      {answered && answer.essayText && (
        <div style={{ paddingLeft: 34, marginTop: 7 }}>
          <div
            style={{
              fontSize: 13, lineHeight: 1.6, color: '#1c1917',
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid #e7e3dc',
              borderRadius: 6,
              padding: '7px 10px',
              maxHeight: 220,
              overflowY: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: answer.essayText }}
          />
        </div>
      )}

      {/* Essay but empty answer text */}
      {answered && question.type === 'essay' && !answer.essayText && (
        <div style={{ paddingLeft: 34, marginTop: 5 }}>
          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Bỏ trống</Text>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────

interface Props {
  sessionId: string;
  question: QuestionDto;
  stats: QuestionStatsDto;
  presence: PresenceDto[];
}

export default function StudentAnswersPanel({ sessionId, question, stats, presence }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [answers, setAnswers] = useState<StudentAnswerDto[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset when question changes
  useEffect(() => {
    setAnswers([]);
    setActiveTab('overview');
  }, [question.id]);

  const fetchAnswers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await answerService.list(sessionId, question.id);
      setAnswers(res.data ?? []);
    } catch {
      // Ignore fetch errors — stale data is acceptable
    } finally {
      setLoading(false);
    }
  }, [sessionId, question.id]);

  // Auto-refresh detail tab whenever answered count changes
  useEffect(() => {
    if (activeTab === 'detail') void fetchAnswers();
  }, [activeTab, stats.answeredCount, fetchAnswers]);

  // Build lookup maps
  const answerMap = new Map(answers.map((a) => [a.student.id, a]));
  const presenceColorMap = new Map(presence.map((p) => [p.studentId, p.avatarColor]));
  const silentColorMap = new Map(stats.silentStudents.map((s) => [s.id, s.avatarColor]));
  const presenceUrlMap = new Map(presence.map((p) => [p.studentId, p.avatarUrl]));
  const silentUrlMap = new Map(stats.silentStudents.map((s) => [s.id, s.avatarUrl]));

  const getColor = (id: string) =>
    presenceColorMap.get(id) ?? silentColorMap.get(id) ?? '#4f46e5';
  const getUrl = (id: string) =>
    presenceUrlMap.get(id) ?? silentUrlMap.get(id) ?? undefined;

  // Merge all known students: presence + answers + silentStudents
  const studentMap = new Map<string, { id: string; name: string; avatarColor?: string; avatarUrl?: string }>();
  for (const p of presence) {
    studentMap.set(p.studentId, { id: p.studentId, name: p.name, avatarColor: p.avatarColor, avatarUrl: p.avatarUrl });
  }
  for (const a of answers) {
    if (!studentMap.has(a.student.id)) {
      studentMap.set(a.student.id, { id: a.student.id, name: a.student.name, avatarColor: getColor(a.student.id), avatarUrl: getUrl(a.student.id) });
    }
  }
  for (const s of stats.silentStudents) {
    if (!studentMap.has(s.id)) {
      studentMap.set(s.id, { id: s.id, name: s.name, avatarColor: s.avatarColor, avatarUrl: s.avatarUrl });
    }
  }

  const allStudents = [...studentMap.values()].sort((a, b) => {
    const aA = answerMap.has(a.id) ? 0 : 1;
    const bA = answerMap.has(b.id) ? 0 : 1;
    if (aA !== bA) return aA - bA;
    if (aA === 0) {
      return (
        new Date(answerMap.get(a.id)!.answeredAt).getTime() -
        new Date(answerMap.get(b.id)!.answeredAt).getTime()
      );
    }
    return a.name.localeCompare(b.name);
  });

  const answeredStudents = allStudents.filter((s) => answerMap.has(s.id));
  const unansweredStudents = allStudents.filter((s) => !answerMap.has(s.id));

  const detailLabel = (
    <span>
      Chi tiết học sinh
      {stats.answeredCount > 0 && (
        <span
          style={{
            marginLeft: 6, fontSize: 11,
            background: '#4f46e5', color: '#fff',
            borderRadius: 10, padding: '1px 6px',
            fontWeight: 600,
          }}
        >
          {stats.answeredCount}/{stats.totalStudents}
        </span>
      )}
    </span>
  );

  return (
    <Tabs
      size="small"
      activeKey={activeTab}
      onChange={(k) => setActiveTab(k as 'overview' | 'detail')}
      tabBarStyle={{ marginBottom: 8 }}
      items={[
        {
          key: 'overview',
          label: 'Tổng quan',
          children: <LiveQuestionStats stats={stats} questionType={question.type} />,
        },
        {
          key: 'detail',
          label: detailLabel,
          children: (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <Spin size="small" />
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>Đang tải...</Text>
                </div>
              ) : allStudents.length === 0 ? (
                <Empty description="Chưa có học sinh nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <>
                  {/* Summary + refresh */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <span style={{ color: '#0ea672', fontWeight: 600 }}>{answeredStudents.length}</span>
                      /{allStudents.length} học sinh đã trả lời
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: '#4f46e5', cursor: 'pointer' }}
                      onClick={() => void fetchAnswers()}
                    >
                      Làm mới
                    </Text>
                  </div>

                  {/* Answered */}
                  {answeredStudents.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 3, height: 13, borderRadius: 2, background: '#0ea672' }} />
                        <Text style={{ fontSize: 11, color: '#0ea672', fontWeight: 700, letterSpacing: 0.3 }}>
                          ĐÃ TRẢ LỜI ({answeredStudents.length})
                        </Text>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {answeredStudents.map((s) => (
                          <StudentAnswerCard
                            key={s.id}
                            name={s.name}
                            avatarColor={s.avatarColor}
                            avatarUrl={s.avatarUrl}
                            answer={answerMap.get(s.id)}
                            question={question}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unanswered */}
                  {unansweredStudents.length > 0 && (
                    <div>
                      {answeredStudents.length > 0 && <Divider style={{ margin: '8px 0' }} />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 3, height: 13, borderRadius: 2, background: '#d8d3c9' }} />
                        <Text style={{ fontSize: 11, color: '#a8a29e', fontWeight: 700, letterSpacing: 0.3 }}>
                          CHƯA TRẢ LỜI ({unansweredStudents.length})
                        </Text>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {unansweredStudents.map((s) => (
                          <StudentAnswerCard
                            key={s.id}
                            name={s.name}
                            avatarColor={s.avatarColor}
                            avatarUrl={s.avatarUrl}
                            answer={undefined}
                            question={question}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
