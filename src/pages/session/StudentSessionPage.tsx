import { useState } from 'react';
import {
  Avatar, Badge, Button, Checkbox, Modal, Radio, Segmented, Tag, Typography, Alert,
  Input as AntInput, Tooltip,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  SendOutlined, MessageOutlined, AudioOutlined, AudioMutedOutlined,
  VideoCameraOutlined, MinusOutlined, ExpandAltOutlined,
  BellOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS } from '../../mock/students';
import ConfidenceSelector from '../../components/session/ConfidenceSelector';
import ChatPanel, { MOCK_CHAT_MESSAGES } from '../../components/session/ChatPanel';
import type { ChatMessage } from '../../components/session/ChatPanel';
import type { ConfidenceLevel } from '../../types';
import heroImg from '../../assets/hero.png';

const { Text, Title } = Typography;
const { TextArea } = AntInput;

const STUDENT = STUDENTS[0]; // demo as s1 — Nguyễn Văn An

type StudentDemoState = 'idle' | 'question' | 'breakout';

function getNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function StudentSessionPage() {
  const navigate = useNavigate();
  const session = LIVE_SESSION;

  // ── Demo switcher ──
  const [demoState, setDemoState] = useState<StudentDemoState>('idle');

  // ── Question answer state ──
  const [questionIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [essayText, setEssayText] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Question popup panel ──
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);

  // ── Media & UI controls ──
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [raisedHand, setRaisedHand] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // ── Chat ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);

  // ── Broadcast (breakout) ──
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  const question = session.questions[questionIdx];
  const myGroup = session.breakoutGroups?.find((g) => g.studentIds.includes(STUDENT.id));
  const myGroupMembers = myGroup ? STUDENTS.filter((s) => myGroup.studentIds.includes(s.id)) : [];

  // Which students to show in the video grid
  const visibleStudents = demoState === 'breakout' ? myGroupMembers.filter((s) => s.id !== STUDENT.id) : STUDENTS.filter((s) => s.id !== STUDENT.id);

  const handleDemoStateChange = (val: string) => {
    const state = val as StudentDemoState;
    if (state === 'question' && demoState !== 'question') {
      setShowNewQuestionModal(true);
      setQuestionPanelOpen(true);
      // reset answer
      setSelectedOptions([]);
      setEssayText('');
      setConfidence(null);
      setSubmitted(false);
    }
    if (state !== 'question') {
      setQuestionPanelOpen(false);
    }
    setDemoState(state);
  };

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

  const handleSendChat = (text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        senderId: STUDENT.id,
        senderName: STUDENT.name,
        avatarColor: STUDENT.avatarColor ?? '#1677ff',
        content: text,
        time: getNow(),
      },
    ]);
  };

  const canSubmit = selectedOptions.length > 0 || essayText.trim().length > 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e', overflow: 'hidden' }}>

      {/* ─── Top header ─── */}
      <div
        style={{
          height: 52,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          gap: 12,
          zIndex: 10,
        }}
      >
        {/* Left: student info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={28} style={{ background: STUDENT.avatarColor }}>
            {STUDENT.name.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13, color: '#fff' }}>{STUDENT.name}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Badge status="processing" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{session.classroomName}</Text>
            </div>
          </div>
        </div>

        {/* Center: Demo switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Demo:</Text>
          <Segmented
            size="small"
            value={demoState}
            onChange={handleDemoStateChange}
            options={[
              { value: 'idle', label: 'Lớp học' },
              { value: 'question', label: '📝 Có câu hỏi' },
              { value: 'breakout', label: '👥 Breakout' },
            ]}
          />
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {demoState === 'question' && !questionPanelOpen && (
            <Button
              size="small"
              type="primary"
              style={{ background: '#fa8c16', borderColor: '#fa8c16', fontSize: 12 }}
              onClick={() => setQuestionPanelOpen(true)}
            >
              📝 Câu hỏi đang chờ
            </Button>
          )}
          <Tooltip title="Chat">
            <Badge count={showChat ? 0 : 2} size="small">
              <Button
                size="small"
                type={showChat ? 'primary' : 'text'}
                shape="circle"
                icon={<MessageOutlined style={{ color: '#fff' }} />}
                style={{ background: 'rgba(255,255,255,0.1)' }}
                onClick={() => setShowChat(!showChat)}
              />
            </Badge>
          </Tooltip>
          <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => navigate(`/review/${session.id}`)}
          >
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Kết quả</Text>
          </Button>
        </div>
      </div>

      {/* ─── Broadcast alert (breakout) ─── */}
      {broadcastMsg && (
        <Alert
          type="warning"
          showIcon
          message={<><Text strong>📢 Thông báo từ giáo viên: </Text><Text>{broadcastMsg}</Text></>}
          closable
          onClose={() => setBroadcastMsg(null)}
          style={{ borderRadius: 0, border: 'none', flexShrink: 0, zIndex: 10 }}
        />
      )}

      {/* ─── Main area: video grid + chat ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Video grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 10, overflow: 'hidden' }}>

          {/* Breakout room banner */}
          {demoState === 'breakout' && myGroup && (
            <div
              style={{
                background: 'linear-gradient(135deg, #1677ff22, #0958d922)',
                border: '1px solid #1677ff44',
                borderRadius: 10,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <TeamOutlined style={{ color: '#4096ff', fontSize: 16 }} />
              <div>
                <Text strong style={{ color: '#91caff', fontSize: 13 }}>{myGroup.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 10 }}>
                  {myGroup.task}
                </Text>
              </div>
              {/* Demo broadcast button */}
              <Button
                size="small"
                style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                icon={<BellOutlined />}
                onClick={() => setBroadcastMsg('Còn 3 phút, các nhóm chuẩn bị báo cáo kết quả!')}
              >
                Demo: GV gửi thông báo
              </Button>
            </div>
          )}

          {/* Teacher video — main */}
          <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
            <img
              src={heroImg}
              alt="Teacher screen"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Teacher label */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 12,
                background: 'rgba(0,0,0,0.5)',
                padding: '3px 10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Avatar size={20} style={{ background: '#1677ff', fontSize: 11 }}>L</Avatar>
              <Text style={{ color: '#fff', fontSize: 12 }}>{session.teacherName}</Text>
              <Badge status="processing" />
            </div>
            {/* LIVE badge */}
            <div style={{ position: 'absolute', top: 10, right: 12 }}>
              <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>LIVE</Text>} />
            </div>
          </div>

          {/* Student video grid */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {/* Self */}
            <div
              style={{
                flex: 1,
                maxWidth: 120,
                background: '#2d2d44',
                borderRadius: 8,
                aspectRatio: '4/3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                position: 'relative',
                border: '2px solid #1677ff',
              }}
            >
              {cameraOn ? (
                <Avatar size={36} style={{ background: STUDENT.avatarColor }}>
                  {STUDENT.name.charAt(0)}
                </Avatar>
              ) : (
                <div style={{ fontSize: 20 }}>🚫</div>
              )}
              <Text style={{ color: '#fff', fontSize: 10 }} ellipsis>
                {STUDENT.name.split(' ').pop()} (bạn)
              </Text>
              {!micOn && (
                <div style={{ position: 'absolute', bottom: 4, left: 4 }}>
                  <AudioMutedOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                </div>
              )}
              {raisedHand && (
                <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 14 }}>✋</div>
              )}
            </div>

            {/* Other students */}
            {visibleStudents.slice(0, 5).map((s) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  maxWidth: 120,
                  background: '#2d2d44',
                  borderRadius: 8,
                  aspectRatio: '4/3',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Avatar size={32} style={{ background: s.avatarColor, fontSize: 13 }}>
                  {s.name.charAt(0)}
                </Avatar>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }} ellipsis>
                  {s.name.split(' ').pop()}
                </Text>
                <Badge status="processing" />
              </div>
            ))}

            {visibleStudents.length > 5 && (
              <div
                style={{
                  flex: 1,
                  maxWidth: 120,
                  background: '#2d2d44',
                  borderRadius: 8,
                  aspectRatio: '4/3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  +{visibleStudents.length - 5}
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <ChatPanel
              messages={chatMessages}
              currentUser={{
                id: STUDENT.id,
                name: STUDENT.name,
                avatarColor: STUDENT.avatarColor ?? '#1677ff',
              }}
              onSend={handleSendChat}
              onClose={() => setShowChat(false)}
              height="100%"
            />
          </div>
        )}

        {/* ── Floating question panel ── */}
        {demoState === 'question' && questionPanelOpen && (
          <div
            style={{
              position: 'absolute',
              right: showChat ? 316 : 16,
              bottom: 70, // above bottom bar
              width: 360,
              maxHeight: 'calc(100vh - 160px)',
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 50,
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: '10px 14px',
                background: 'linear-gradient(135deg, #1677ff, #0958d9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ color: '#fff', fontSize: 13 }}>
                  📝 Câu hỏi {questionIdx + 1}/{session.questions.length}
                </Text>
                <Tag color="gold" style={{ fontSize: 11, padding: '0 6px' }}>
                  {question.type === 'single' ? 'Trắc nghiệm' : question.type === 'multiple' ? 'Nhiều đáp án' : 'Tự luận'}
                </Tag>
              </div>
              <Tooltip title="Thu nhỏ">
                <Button
                  size="small"
                  type="text"
                  icon={<MinusOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
                  onClick={() => setQuestionPanelOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                />
              </Tooltip>
            </div>

            {/* Panel body (scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>

              {/* Question content */}
              <div
                dangerouslySetInnerHTML={{ __html: question.content }}
                style={{ fontSize: 14, fontWeight: 500, marginBottom: 14, lineHeight: 1.6 }}
              />

              {/* Single choice */}
              {question.options && question.type === 'single' && (
                <Radio.Group value={selectedOptions[0]} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {question.options.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectSingle(opt.id)}
                        style={{
                          padding: '10px 12px',
                          border: `2px solid ${selectedOptions.includes(opt.id) ? '#1677ff' : '#e8e8e8'}`,
                          borderRadius: 8,
                          cursor: submitted ? 'default' : 'pointer',
                          background: selectedOptions.includes(opt.id) ? '#e6f4ff' : '#fafafa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Radio value={opt.id} />
                        <Tag style={{ minWidth: 24, textAlign: 'center', margin: 0, fontSize: 11 }}>{opt.label}</Tag>
                        <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                      </div>
                    ))}
                  </div>
                </Radio.Group>
              )}

              {/* Multiple choice */}
              {question.options && question.type === 'multiple' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {question.options.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectMultiple(opt.id)}
                      style={{
                        padding: '10px 12px',
                        border: `2px solid ${selectedOptions.includes(opt.id) ? '#1677ff' : '#e8e8e8'}`,
                        borderRadius: 8,
                        cursor: submitted ? 'default' : 'pointer',
                        background: selectedOptions.includes(opt.id) ? '#e6f4ff' : '#fafafa',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Checkbox checked={selectedOptions.includes(opt.id)} />
                      <Tag style={{ minWidth: 24, textAlign: 'center', margin: 0, fontSize: 11 }}>{opt.label}</Tag>
                      <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                    </div>
                  ))}
                </div>
              )}

              {/* Essay */}
              {question.type === 'essay' && (
                <TextArea
                  placeholder="Nhập câu trả lời của bạn..."
                  rows={3}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  disabled={submitted}
                  style={{ borderRadius: 8, fontSize: 13 }}
                />
              )}

              {/* Confidence (before submit) */}
              {!submitted && (
                <div style={{ marginTop: 12 }}>
                  <ConfidenceSelector value={confidence} onChange={setConfidence} />
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
              {!submitted ? (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  block
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  Gửi câu trả lời
                </Button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <Text strong style={{ color: '#52c41a' }}>Đã gửi câu trả lời!</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    Chờ giáo viên kết thúc câu hỏi...
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      onClick={() => setQuestionPanelOpen(false)}
                    >
                      Thu nhỏ, tiếp tục học
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom control bar ─── */}
      <div
        style={{
          height: 60,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          flexShrink: 0,
          padding: '0 20px',
        }}
      >
        {/* Mic */}
        <Tooltip title={micOn ? 'Tắt mic' : 'Bật mic'}>
          <Button
            shape="circle"
            type={micOn ? 'default' : 'primary'}
            danger={!micOn}
            icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />}
            style={{
              background: micOn ? 'rgba(255,255,255,0.15)' : undefined,
              borderColor: micOn ? 'transparent' : undefined,
              color: micOn ? '#fff' : undefined,
            }}
            onClick={() => setMicOn(!micOn)}
          />
        </Tooltip>

        {/* Camera */}
        <Tooltip title={cameraOn ? 'Tắt camera' : 'Bật camera'}>
          <Button
            shape="circle"
            type={cameraOn ? 'default' : 'primary'}
            danger={!cameraOn}
            icon={<VideoCameraOutlined />}
            style={{
              background: cameraOn ? 'rgba(255,255,255,0.15)' : undefined,
              borderColor: cameraOn ? 'transparent' : undefined,
              color: cameraOn ? '#fff' : undefined,
            }}
            onClick={() => setCameraOn(!cameraOn)}
          />
        </Tooltip>

        {/* Raise hand */}
        <Tooltip title={raisedHand ? 'Hạ tay' : 'Giơ tay'}>
          <Button
            shape="circle"
            type={raisedHand ? 'primary' : 'default'}
            style={{
              background: raisedHand ? '#fa8c16' : 'rgba(255,255,255,0.15)',
              borderColor: raisedHand ? '#fa8c16' : 'transparent',
              color: '#fff',
              fontSize: 16,
            }}
            onClick={() => setRaisedHand(!raisedHand)}
          >
            ✋
          </Button>
        </Tooltip>

        {/* Question toggle (when question is active and minimized) */}
        {demoState === 'question' && (
          <Tooltip title={questionPanelOpen ? 'Thu nhỏ câu hỏi' : 'Mở câu hỏi'}>
            <Button
              shape="round"
              type={questionPanelOpen ? 'primary' : 'default'}
              style={{
                background: !questionPanelOpen
                  ? (submitted ? 'rgba(82,196,26,0.8)' : 'rgba(250,140,22,0.9)')
                  : undefined,
                borderColor: 'transparent',
                color: '#fff',
                fontWeight: 600,
                gap: 6,
              }}
              icon={questionPanelOpen ? <MinusOutlined /> : <ExpandAltOutlined />}
              onClick={() => setQuestionPanelOpen(!questionPanelOpen)}
            >
              {submitted ? '✓ Đã trả lời' : '📝 Câu hỏi'}
            </Button>
          </Tooltip>
        )}

        {/* Chat */}
        <Tooltip title="Chat">
          <Badge count={showChat ? 0 : 2} size="small">
            <Button
              shape="circle"
              type={showChat ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              style={{
                background: showChat ? undefined : 'rgba(255,255,255,0.15)',
                borderColor: showChat ? undefined : 'transparent',
                color: showChat ? undefined : '#fff',
              }}
              onClick={() => setShowChat(!showChat)}
            />
          </Badge>
        </Tooltip>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        {/* Leave */}
        <Button
          type="primary"
          danger
          shape="round"
          onClick={() => navigate(`/review/${session.id}`)}
          style={{ fontWeight: 600 }}
        >
          Rời lớp
        </Button>
      </div>

      {/* ── New question notification modal ── */}
      <Modal
        open={showNewQuestionModal}
        onCancel={() => setShowNewQuestionModal(false)}
        footer={null}
        centered
        width={360}
        closeIcon={null}
      >
        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>📢</div>
          <Title level={4} style={{ margin: '0 0 8px' }}>Giáo viên vừa đặt câu hỏi!</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Trả lời câu hỏi ngay bên dưới hoặc thu nhỏ để tiếp tục xem bài giảng
          </Text>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <Button
              block
              onClick={() => setShowNewQuestionModal(false)}
            >
              Thu nhỏ
            </Button>
            <Button
              type="primary"
              block
              onClick={() => setShowNewQuestionModal(false)}
            >
              Trả lời ngay →
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
