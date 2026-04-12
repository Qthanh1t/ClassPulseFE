import {
  Avatar, Button, Card, Col, Progress, Row, Statistic, Tag, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
  ArrowLeftOutlined, TrophyOutlined,
} from '@ant-design/icons';
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

  return (
    <div className="p-6" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/classes')}
        style={{ marginBottom: 16 }}
      >
        Về trang chủ
      </Button>

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
            <div style={{ position: 'relative', display: 'inline-block' }}>
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
            </div>
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
              style={{
                borderRadius: 12,
                background: statusColor,
                border: `1px solid ${borderColor}`,
              }}
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
                      <Tag color={CONFIDENCE_COLOR[answer.confidence]} style={{ fontSize: 12 }}>
                        Tự tin: {CONFIDENCE_LABEL[answer.confidence]}
                      </Tag>
                    )}
                    {!hasAnswer && <Tag color="default">Không trả lời</Tag>}
                  </div>

                  <div
                    dangerouslySetInnerHTML={{ __html: q.content }}
                    style={{ fontSize: 14, marginBottom: 10, fontWeight: 500 }}
                  />

                  {/* MCQ: show options with correct/wrong highlight */}
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
                            <Tag color={opt.isCorrect ? 'success' : wasSelected ? 'error' : 'default'} style={{ minWidth: 24, textAlign: 'center' }}>
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

                  {/* Essay: show student's text */}
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
