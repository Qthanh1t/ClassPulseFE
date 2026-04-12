import { useState } from 'react';
import {
  Avatar, Badge, Button, Card, Checkbox, Radio, Tag, Typography, Alert,
  Steps, Input as AntInput,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  ArrowLeftOutlined, SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS } from '../../mock/students';
import ConfidenceSelector from '../../components/session/ConfidenceSelector';
import type { ConfidenceLevel } from '../../types';

const { Text } = Typography;
const { TextArea } = AntInput;

const STUDENT = STUDENTS[0]; // demo as student s1

export default function StudentSessionPage() {
  const navigate = useNavigate();
  useParams<{ id: string }>();

  const session = LIVE_SESSION;
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [essayText, setEssayText] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);

  const question = session.questions[questionIdx];
  const myGroup = session.breakoutGroups?.find((g) => g.studentIds.includes(STUDENT.id));

  const handleSelectSingle = (optId: string) => {
    if (submitted) return;
    setSelectedOptions([optId]);
  };

  const handleSelectMultiple = (optId: string) => {
    if (submitted) return;
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  const handleSubmit = () => {
    if (selectedOptions.length === 0 && !essayText.trim()) return;
    setSubmitted(true);
  };

  const handleNext = () => {
    setQuestionIdx((prev) => Math.min(prev + 1, session.questions.length - 1));
    setSelectedOptions([]);
    setEssayText('');
    setConfidence(null);
    setSubmitted(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f0f2f5',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={28} style={{ background: STUDENT.avatarColor }}>
            {STUDENT.name.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 14 }}>{STUDENT.name}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Badge status="processing" />
              <Text type="secondary" style={{ fontSize: 12 }}>{session.classroomName}</Text>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {myGroup && (
            <Button
              size="small"
              icon={<TeamOutlined />}
              type={showBreakout ? 'primary' : 'default'}
              onClick={() => setShowBreakout(!showBreakout)}
            >
              {myGroup.name}
            </Button>
          )}
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/review/${session.id}`)}
          >
            Xem kết quả
          </Button>
        </div>
      </div>

      {/* Breakout panel */}
      {showBreakout && myGroup && (
        <Alert
          type="info"
          style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #91caff' }}
          message={
            <div>
              <Text strong>{myGroup.name} — Nhiệm vụ: </Text>
              <Text>{myGroup.task}</Text>
            </div>
          }
          closable
          onClose={() => setShowBreakout(false)}
        />
      )}

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 640 }}>
          {/* Progress */}
          <Steps
            current={questionIdx}
            size="small"
            style={{ marginBottom: 20 }}
            items={session.questions.map((_, i) => ({
              title: `Câu ${i + 1}`,
              status: i < questionIdx ? 'finish' : i === questionIdx ? 'process' : 'wait',
            }))}
          />

          {/* Question card */}
          <Card style={{ borderRadius: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Tag color="blue">
                {question.type === 'single' ? 'Trắc nghiệm 1 đáp án'
                  : question.type === 'multiple' ? 'Trắc nghiệm nhiều đáp án'
                    : 'Tự luận'}
              </Tag>
              {question.type === 'multiple' && (
                <Tag color="orange">Chọn tất cả đáp án đúng</Tag>
              )}
            </div>

            <div
              dangerouslySetInnerHTML={{ __html: question.content }}
              style={{ fontSize: 16, fontWeight: 500, marginBottom: 20, lineHeight: 1.7 }}
            />

            {/* Options */}
            {question.options && question.type === 'single' && (
              <Radio.Group
                value={selectedOptions[0]}
                style={{ width: '100%' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {question.options.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectSingle(opt.id)}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${selectedOptions.includes(opt.id) ? '#1677ff' : '#e8e8e8'}`,
                        borderRadius: 10,
                        cursor: submitted ? 'default' : 'pointer',
                        background: selectedOptions.includes(opt.id) ? '#e6f4ff' : '#fafafa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'all 0.15s',
                      }}
                    >
                      <Radio value={opt.id} />
                      <Tag style={{ minWidth: 28, textAlign: 'center' }}>{opt.label}</Tag>
                      <Text>{opt.text}</Text>
                    </div>
                  ))}
                </div>
              </Radio.Group>
            )}

            {question.options && question.type === 'multiple' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {question.options.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectMultiple(opt.id)}
                    style={{
                      padding: '12px 16px',
                      border: `2px solid ${selectedOptions.includes(opt.id) ? '#1677ff' : '#e8e8e8'}`,
                      borderRadius: 10,
                      cursor: submitted ? 'default' : 'pointer',
                      background: selectedOptions.includes(opt.id) ? '#e6f4ff' : '#fafafa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Checkbox checked={selectedOptions.includes(opt.id)} />
                    <Tag style={{ minWidth: 28, textAlign: 'center' }}>{opt.label}</Tag>
                    <Text>{opt.text}</Text>
                  </div>
                ))}
              </div>
            )}

            {question.type === 'essay' && (
              <TextArea
                placeholder="Nhập câu trả lời của bạn..."
                rows={4}
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                disabled={submitted}
                style={{ borderRadius: 8 }}
              />
            )}
          </Card>

          {/* Confidence selector */}
          {!submitted && (
            <Card style={{ borderRadius: 12, marginBottom: 16 }}>
              <ConfidenceSelector value={confidence} onChange={setConfidence} />
            </Card>
          )}

          {/* Submit / submitted state */}
          {!submitted ? (
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              block
              onClick={handleSubmit}
              disabled={selectedOptions.length === 0 && !essayText.trim()}
              style={{ height: 48, borderRadius: 10, fontWeight: 600 }}
            >
              Gửi câu trả lời
            </Button>
          ) : (
            <Card
              style={{
                borderRadius: 12,
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                textAlign: 'center',
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
              <div>
                <Text strong style={{ fontSize: 16, color: '#52c41a' }}>Đã gửi câu trả lời!</Text>
              </div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                Đang chờ giáo viên kết thúc câu hỏi...
              </Text>
              {questionIdx < session.questions.length - 1 && (
                <div style={{ marginTop: 12 }}>
                  <Button size="small" onClick={handleNext}>Câu tiếp theo →</Button>
                </div>
              )}
              {questionIdx === session.questions.length - 1 && (
                <div style={{ marginTop: 12 }}>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => navigate(`/review/${session.id}`)}
                  >
                    Xem kết quả buổi học
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
