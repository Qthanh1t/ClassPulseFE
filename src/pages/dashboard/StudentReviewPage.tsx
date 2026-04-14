import {
  Avatar, Button, Card, Col, Progress, Row, Statistic, Tag, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  ArrowLeftOutlined, TrophyOutlined,
} from '@ant-design/icons';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip as RechartTooltip,
  BarChart, Bar, XAxis, YAxis, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS } from '../../mock/students';
import type { Question, StudentAnswer } from '../../types';

const { Title, Text } = Typography;

const STUDENT = STUDENTS[0]; // demo as s1

function isAnswerCorrect(answer: StudentAnswer, question: Question): boolean {
  if (question.type === 'essay') return true;
  const correctIds = (question.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
  return (
    answer.selectedOptions.length === correctIds.length &&
    correctIds.every((id) => answer.selectedOptions.includes(id))
  );
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

const CONFIDENCE_HEX: Record<string, string> = {
  high: '#52c41a',
  medium: '#fa8c16',
  low: '#ff4d4f',
};

export default function StudentReviewPage() {
  const navigate = useNavigate();
  const session = LIVE_SESSION;

  const myAnswers = session.questions.map((q) => ({
    question: q,
    answer: q.answers.find((a) => a.studentId === STUDENT.id),
  }));

  const answered = myAnswers.filter(({ answer }) => answer && (answer.selectedOptions.length > 0 || (answer.essayText?.length ?? 0) > 0));
  const correct = answered.filter(({ question, answer }) => answer && isAnswerCorrect(answer, question));
  const wrong = answered.filter(({ question, answer }) => answer && !isAnswerCorrect(answer, question) && question.type !== 'essay');
  const skipped = myAnswers.filter(({ answer }) => !answer || (answer.selectedOptions.length === 0 && !(answer.essayText?.length)));
  const mcqQuestions = session.questions.filter((q) => q.type !== 'essay');
  const score = correct.filter(({ question }) => question.type !== 'essay').length;
  const scorePercent = mcqQuestions.length > 0 ? Math.round((score / mcqQuestions.length) * 100) : 0;

  // Chart data: per-question result with confidence
  const questionChartData = myAnswers.map(({ question: q, answer }, idx) => {
    const hasAnswer = answer && (answer.selectedOptions.length > 0 || (answer.essayText?.length ?? 0) > 0);
    const isCorrectResult = hasAnswer && answer ? isAnswerCorrect(answer, q) : false;
    const confLabel = answer?.confidence ? CONFIDENCE_LABEL[answer.confidence] : 'Không TL';
    return {
      name: `Câu ${idx + 1}`,
      status: !hasAnswer ? 0 : isCorrectResult ? 2 : 1,
      confidence: answer?.confidence ?? null,
      confLabel,
      isCorrect: isCorrectResult,
      hasAnswer,
    };
  });

  // Radar chart data: confidence vs accuracy per category
  const radarData = [
    {
      subject: 'Tự tin cao',
      answered: answered.filter(({ answer }) => answer?.confidence === 'high').length,
      correct: correct.filter(({ answer }) => answer?.confidence === 'high').length,
    },
    {
      subject: 'Tự tin TB',
      answered: answered.filter(({ answer }) => answer?.confidence === 'medium').length,
      correct: correct.filter(({ answer }) => answer?.confidence === 'medium').length,
    },
    {
      subject: 'Tự tin thấp',
      answered: answered.filter(({ answer }) => answer?.confidence === 'low').length,
      correct: correct.filter(({ answer }) => answer?.confidence === 'low').length,
    },
  ];

  return (
    <div className="p-6" style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Back button */}
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/classes')} style={{ marginBottom: 16 }}>
        Về trang chủ
      </Button>

      {/* Student header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Avatar size={48} style={{ background: STUDENT.avatarColor }}>
          {STUDENT.name.charAt(0)}
        </Avatar>
        <div>
          <Title level={4} style={{ margin: 0 }}>{STUDENT.name}</Title>
          <Text type="secondary">{session.classroomName} · {session.date}</Text>
        </div>
      </div>

      {/* Score summary */}
      <Card
        style={{
          borderRadius: 16,
          marginBottom: 24,
          background: scorePercent >= 70
            ? 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)'
            : scorePercent >= 40
              ? 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)'
              : 'linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%)',
          border: 'none',
        }}
      >
        <Row align="middle" gutter={16}>
          <Col>
            <Progress
              type="circle"
              percent={scorePercent}
              size={100}
              strokeColor={scorePercent >= 70 ? '#52c41a' : scorePercent >= 40 ? '#fa8c16' : '#ff4d4f'}
              format={() => (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{score}/{mcqQuestions.length}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>đúng</div>
                </div>
              )}
            />
          </Col>
          <Col flex={1}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <TrophyOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <Title level={4} style={{ margin: 0 }}>
                {scorePercent >= 70 ? 'Xuất sắc!' : scorePercent >= 40 ? 'Khá tốt!' : 'Cần cố gắng hơn'}
              </Title>
            </div>
            <Row gutter={16}>
              <Col>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>Đúng</Text>}
                  value={correct.length}
                  valueStyle={{ color: '#52c41a', fontSize: 20 }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>Sai</Text>}
                  value={wrong.length}
                  valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
                  prefix={<CloseCircleOutlined />}
                />
              </Col>
              <Col>
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>Bỏ qua</Text>}
                  value={skipped.length}
                  valueStyle={{ color: '#bfbfbf', fontSize: 20 }}
                  prefix={<MinusCircleOutlined />}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Bar chart: result per question */}
        <Col xs={24} md={14}>
          <Card style={{ borderRadius: 12 }} title="Kết quả theo câu hỏi">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={questionChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis hide />
                <RechartTooltip
                  formatter={(_value: unknown, _name: unknown, props: { payload?: { confLabel?: string; isCorrect?: boolean; hasAnswer?: boolean } }) => {
                    const p = props.payload;
                    if (!p?.hasAnswer) return ['Không trả lời', ''];
                    return [p.isCorrect ? 'Đúng' : 'Sai', `Tự tin: ${p.confLabel ?? '—'}`];
                  }}
                />
                <Bar dataKey="status" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {questionChartData.map((entry, index) => (
                    <Cell
                      key={`q-bar-${index}`}
                      fill={!entry.hasAnswer ? '#d9d9d9' : entry.isCorrect ? '#52c41a' : '#ff4d4f'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, justifyContent: 'center' }}>
              {[
                { label: 'Đúng', color: '#52c41a' },
                { label: 'Sai', color: '#ff4d4f' },
                { label: 'Bỏ qua', color: '#d9d9d9' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Radar chart: confidence calibration */}
        <Col xs={24} md={10}>
          <Card style={{ borderRadius: 12, height: '100%' }} title="Độ tự tin & độ chính xác">
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <Radar
                  name="Trả lời"
                  dataKey="answered"
                  stroke="#1677ff"
                  fill="#1677ff"
                  fillOpacity={0.2}
                />
                <Radar
                  name="Đúng"
                  dataKey="correct"
                  stroke="#52c41a"
                  fill="#52c41a"
                  fillOpacity={0.3}
                />
                <RechartTooltip />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Per-question review */}
      <Title level={5} style={{ marginBottom: 16 }}>Chi tiết từng câu hỏi</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {myAnswers.map(({ question: q, answer }, idx) => {
          const hasAnswer = answer && (answer.selectedOptions.length > 0 || (answer.essayText?.length ?? 0) > 0);
          const isCorrect = hasAnswer && answer ? isAnswerCorrect(answer, q) : false;

          let statusIcon = <MinusCircleOutlined style={{ color: '#bfbfbf', fontSize: 18 }} />;
          let statusColor = '#f5f5f5';
          let borderColor = '#d9d9d9';
          if (hasAnswer && isCorrect) {
            statusIcon = <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
            statusColor = '#f6ffed';
            borderColor = '#b7eb8f';
          } else if (hasAnswer && !isCorrect && q.type !== 'essay') {
            statusIcon = <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
            statusColor = '#fff2f0';
            borderColor = '#ffccc7';
          }

          return (
            <Card
              key={q.id}
              style={{ borderRadius: 12, background: statusColor, border: `1px solid ${borderColor}` }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 2 }}>{statusIcon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <Tag color="blue" style={{ fontSize: 12 }}>Câu {idx + 1}</Tag>
                    <Tag color="default" style={{ fontSize: 12 }}>
                      {q.type === 'single' ? 'Trắc nghiệm' : q.type === 'multiple' ? 'Nhiều đáp án' : 'Tự luận'}
                    </Tag>
                    {hasAnswer && answer?.confidence && (
                      <Tag
                        color={CONFIDENCE_COLOR[answer.confidence]}
                        style={{
                          fontSize: 12,
                          borderLeft: `3px solid ${CONFIDENCE_HEX[answer.confidence]}`,
                        }}
                      >
                        Tự tin: {CONFIDENCE_LABEL[answer.confidence]}
                      </Tag>
                    )}
                    {!hasAnswer && <Tag color="default">Không trả lời</Tag>}
                  </div>

                  <div
                    dangerouslySetInnerHTML={{ __html: q.content }}
                    style={{ fontSize: 14, marginBottom: 10, fontWeight: 500 }}
                  />

                  {/* MCQ options */}
                  {q.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {q.options.map((opt) => {
                        const wasSelected = answer?.selectedOptions.includes(opt.id) ?? false;
                        let bg = 'transparent';
                        let border = '1px solid #e8e8e8';
                        if (opt.isCorrect) { bg = '#f6ffed'; border = '1px solid #b7eb8f'; }
                        if (wasSelected && !opt.isCorrect) { bg = '#fff2f0'; border = '1px solid #ffccc7'; }

                        return (
                          <div
                            key={opt.id}
                            style={{
                              padding: '7px 12px',
                              borderRadius: 8,
                              background: bg,
                              border,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 13,
                            }}
                          >
                            <Tag
                              color={opt.isCorrect ? 'success' : wasSelected ? 'error' : 'default'}
                              style={{ minWidth: 24, textAlign: 'center' }}
                            >
                              {opt.label}
                            </Tag>
                            <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                            {opt.isCorrect && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />}
                            {wasSelected && !opt.isCorrect && <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 'auto' }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay */}
                  {q.type === 'essay' && answer?.essayText && (
                    <Card
                      size="small"
                      style={{ background: '#fafafa', borderRadius: 8 }}
                      styles={{ body: { padding: '8px 12px' } }}
                    >
                      <Text style={{ fontSize: 13, fontStyle: 'italic' }}>"{answer.essayText}"</Text>
                    </Card>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button type="primary" onClick={() => navigate('/classes')}>
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
