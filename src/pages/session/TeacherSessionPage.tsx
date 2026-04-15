import { useState, useEffect } from 'react';
import {
  Avatar, Badge, Button, Card, Divider, Modal, Segmented, Tag, Tooltip,
  Typography, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlusCircleOutlined,
  PlayCircleOutlined, StopOutlined, CheckCircleOutlined,
  DesktopOutlined, WarningOutlined, UsergroupAddOutlined,
  AudioOutlined, AudioMutedOutlined, VideoCameraOutlined,
  MessageOutlined, TeamOutlined, ClockCircleOutlined,
  PoweroffOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS, TEACHER } from '../../mock/students';
import StudentStatusList from '../../components/session/StudentStatusList';
import LiveQuestionStats from '../../components/session/LiveQuestionStats';
import CreateQuestionModal from '../../components/session/CreateQuestionModal';
import BreakoutPanel from '../../components/session/BreakoutPanel';
import ChatPanel, { MOCK_CHAT_MESSAGES } from '../../components/session/ChatPanel';
import CtrlBtn from '../../components/session/CtrlBtn';
import type { ChatMessage } from '../../components/session/ChatPanel';
import type { Question } from '../../types';
import heroImg from '../../assets/hero.png';

const { Text } = Typography;

type DemoState = 'idle' | 'running' | 'ended' | 'breakout';

const DEMO_LABELS: Record<DemoState, string> = {
  idle: 'Lớp học',
  running: 'Câu hỏi đang chạy',
  ended: 'Câu hỏi kết thúc',
  breakout: 'Breakout Room',
};

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}


export default function TeacherSessionPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false);

  const [showStudentList, setShowStudentList] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [raisedHandIds] = useState<string[]>(['s3', 's5']);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const session = LIVE_SESSION;
  const currentQuestion: Question = session.questions[activeQuestionIdx];

  const handlePublishQuestion = () => setDemoState('running');
  const handleEndQuestion = () => setDemoState('ended');
  const handleNextQuestion = () => {
    setActiveQuestionIdx((prev) => Math.min(prev + 1, session.questions.length - 1));
    setDemoState('idle');
  };

  const handleSendChat = (text: string) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        senderId: TEACHER.id,
        senderName: TEACHER.name,
        avatarColor: TEACHER.avatarColor ?? '#1677ff',
        content: text,
        time: getNow(),
        isTeacher: true,
      },
    ]);
  };

  // Shared panel style (white card on dark bg)
  const panelStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e' }}>

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
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />}
            onClick={() => navigate(`/classes/${id ?? 'c1'}`)}
          />
          <div
            style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg, #1677ff, #0958d9)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <PlayCircleOutlined style={{ color: '#fff', fontSize: 13 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 14, color: '#fff' }}>{session.classroomName}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge status="processing" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Đang diễn ra · {session.date}
              </Text>
            </div>
          </div>
        </div>

        {/* Center: Demo switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>Demo:</Text>
          <Segmented
            size="small"
            value={demoState}
            onChange={(v) => setDemoState(v as DemoState)}
            options={Object.entries(DEMO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>

        {/* Right: elapsed + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 6 }}>
            <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
              {formatElapsed(elapsedSeconds)}
            </Text>
          </div>
          <Avatar size={26} style={{ background: '#1677ff', fontSize: 12 }}>L</Avatar>
          <Text style={{ fontSize: 13, color: '#fff' }}>{TEACHER.name}</Text>
        </div>
      </div>

      {/* Silent student alert */}
      {session.silentStudentIds.length > 0 && demoState === 'running' && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message={`${session.silentStudentIds.length} học sinh chưa tương tác trong câu hỏi này`}
          closable
          style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #ffd591', flexShrink: 0 }}
        />
      )}

      {/* ─── Main area ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '10px', gap: 10 }}>

        {/* LEFT: Student list panel */}
        {showStudentList && (
          <div style={{ ...panelStyle, width: 220 }}>
            <StudentStatusList
              students={STUDENTS}
              answers={demoState === 'idle' ? [] : currentQuestion.answers}
              silentStudentIds={demoState === 'running' ? session.silentStudentIds : []}
              raisedHandIds={demoState !== 'idle' ? raisedHandIds : []}
              currentQuestionId={demoState !== 'idle' ? currentQuestion.id : undefined}
            />
          </div>
        )}

        {/* CENTER: content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

          {/* ── IDLE: Video classroom ── */}
          {demoState === 'idle' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              {/* Main video */}
              <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 280 }}>
                <img
                  src={heroImg}
                  alt="Screen share"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {screenShareOn && (
                  <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DesktopOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '24px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar size={32} style={{ background: '#1677ff', flexShrink: 0 }}>L</Avatar>
                  <div>
                    <Text strong style={{ color: '#fff', fontSize: 13 }}>{TEACHER.name}</Text>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!micOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Mic tắt</Tag>}
                      {!cameraOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Camera tắt</Tag>}
                      {micOn && cameraOn && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Đang giảng bài</Text>}
                    </div>
                  </div>
                  <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>LIVE</Text>} style={{ marginLeft: 'auto' }} />
                </div>
              </div>

              {/* Student thumbnails */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {STUDENTS.map((s) => (
                  <div key={s.id} style={{ flex: 1, background: '#2d2d44', borderRadius: 8, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' }}>
                    <Avatar size={28} style={{ background: s.avatarColor, fontSize: 12 }}>{s.name.charAt(0)}</Avatar>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }} ellipsis>{s.name.split(' ').pop()}</Text>
                    <Badge status="processing" />
                    {raisedHandIds.includes(s.id) && <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 12 }}>✋</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RUNNING: Question + stats (white cards) ── */}
          {demoState === 'running' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Card style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <Tag color="blue">
                      {currentQuestion.type === 'single' ? 'Trắc nghiệm 1 đáp án'
                        : currentQuestion.type === 'multiple' ? 'Trắc nghiệm nhiều đáp án' : 'Tự luận'}
                    </Tag>
                    <Tag color="orange" style={{ marginLeft: 4 }}>Câu {activeQuestionIdx + 1}/{session.questions.length}</Tag>
                  </div>
                  <Button danger size="small" icon={<StopOutlined />} onClick={handleEndQuestion}>
                    Kết thúc câu hỏi
                  </Button>
                </div>
                <div dangerouslySetInnerHTML={{ __html: currentQuestion.content }} style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, lineHeight: 1.6 }} />
                {currentQuestion.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentQuestion.options.map((opt) => (
                      <div key={opt.id} style={{ padding: '10px 14px', border: `1px solid ${opt.isCorrect ? '#b7eb8f' : '#d9d9d9'}`, borderRadius: 8, background: opt.isCorrect ? '#f6ffed' : '#fafafa', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ minWidth: 28, textAlign: 'center' }}>{opt.label}</Tag>
                        <Text>{opt.text}</Text>
                        {opt.isCorrect && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card style={{ borderRadius: 12 }}>
                <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>Thống kê thời gian thực</Text>
                <LiveQuestionStats question={currentQuestion} />
              </Card>
            </div>
          )}

          {/* ── ENDED: Results ── */}
          {demoState === 'ended' && (
            <Card style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <Text strong style={{ fontSize: 15 }}>Kết quả câu {activeQuestionIdx + 1}</Text>
                </div>
                <Button type="primary" onClick={handleNextQuestion} disabled={activeQuestionIdx >= session.questions.length - 1}>
                  Câu tiếp theo →
                </Button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: currentQuestion.content }} style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }} />
              <LiveQuestionStats question={currentQuestion} />
            </Card>
          )}

          {/* ── BREAKOUT: Teacher management view ── */}
          {demoState === 'breakout' && session.breakoutGroups && (
            <Card style={{ borderRadius: 12 }}>
              <BreakoutPanel
                groups={session.breakoutGroups}
                onClose={() => setDemoState('idle')}
              />
            </Card>
          )}
        </div>

        {/* RIGHT: Quick actions panel */}
        {showQuickActions && (
          <div style={{ ...panelStyle, width: 200, padding: 14, gap: 10, overflowY: 'auto' }}>
            <Text strong style={{ fontSize: 13 }}>Hành động nhanh</Text>

            <Button type="primary" icon={<PlusCircleOutlined />} block onClick={() => setCreateOpen(true)} disabled={demoState === 'running'}>
              Tạo câu hỏi
            </Button>

            <Button icon={<UsergroupAddOutlined />} block onClick={() => setDemoState('breakout')}>
              Chia nhóm
            </Button>

            <Divider style={{ margin: '2px 0' }} />

            <Text type="secondary" style={{ fontSize: 12 }}>Câu hỏi trong buổi</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {session.questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: idx === activeQuestionIdx && demoState !== 'idle' ? '#e6f4ff' : '#fafafa',
                    border: `1px solid ${idx === activeQuestionIdx && demoState !== 'idle' ? '#91caff' : '#f0f0f0'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onClick={() => { setActiveQuestionIdx(idx); if (demoState !== 'breakout') setDemoState('running'); }}
                >
                  <Text style={{ fontSize: 12, color: '#8c8c8c', minWidth: 16 }}>{idx + 1}.</Text>
                  <Text style={{ fontSize: 12 }} ellipsis>
                    {q.type === 'single' ? '●' : q.type === 'multiple' ? '☑' : '✏'} Câu {idx + 1}
                  </Text>
                </div>
              ))}
            </div>

            <Divider style={{ margin: '2px 0' }} />

            <Button size="small" block onClick={() => navigate(`/dashboard/${session.id}`)}>
              Xem Dashboard
            </Button>
          </div>
        )}

        {/* CHAT panel */}
        {showChat && (
          <div style={{ ...panelStyle, width: 280 }}>
            <ChatPanel
              messages={chatMessages}
              currentUser={{ id: TEACHER.id, name: TEACHER.name, avatarColor: TEACHER.avatarColor ?? '#1677ff', isTeacher: true }}
              onSend={handleSendChat}
              onClose={() => setShowChat(false)}
              height="100%"
            />
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
        {/* Media */}
        <CtrlBtn active={!micOn} danger={!micOn} onClick={() => setMicOn(!micOn)} title={micOn ? 'Tắt mic' : 'Bật mic'} icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />} />
        <CtrlBtn active={!cameraOn} danger={!cameraOn} onClick={() => setCameraOn(!cameraOn)} title={cameraOn ? 'Tắt camera' : 'Bật camera'} icon={<VideoCameraOutlined />} />
        <CtrlBtn active={screenShareOn} onClick={() => setScreenShareOn(!screenShareOn)} title={screenShareOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'} icon={<DesktopOutlined />} />

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        {/* Layout toggles */}
        <CtrlBtn active={showStudentList} onClick={() => setShowStudentList(!showStudentList)} title={showStudentList ? 'Ẩn danh sách HS' : 'Hiện danh sách HS'} icon={<TeamOutlined />} />
        <CtrlBtn active={showQuickActions} onClick={() => setShowQuickActions(!showQuickActions)} title={showQuickActions ? 'Ẩn hành động nhanh' : 'Hiện hành động nhanh'} icon={<PlusCircleOutlined />} />
        <Tooltip title="Chat">
          <Badge count={showChat ? 0 : 2} size="small">
            <Button
              shape="circle"
              type={showChat ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              style={!showChat ? { background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' } : {}}
              onClick={() => setShowChat(!showChat)}
            />
          </Badge>
        </Tooltip>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        {/* End session */}
        <Button
          type="primary"
          danger
          shape="round"
          icon={<PoweroffOutlined />}
          onClick={() => setEndSessionOpen(true)}
          style={{ fontWeight: 600 }}
        >
          Kết thúc buổi học
        </Button>
      </div>

      {/* Modals */}
      <CreateQuestionModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handlePublishQuestion} />

      <Modal
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} /><span>Kết thúc buổi học?</span></div>}
        open={endSessionOpen}
        onOk={() => navigate(`/dashboard/${session.id}`)}
        onCancel={() => setEndSessionOpen(false)}
        okText="Kết thúc & Xem kết quả"
        cancelText="Tiếp tục buổi học"
        okButtonProps={{ danger: true, type: 'primary' }}
        centered
        width={420}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ marginBottom: 12, color: '#595959' }}>Buổi học sẽ kết thúc và tất cả học sinh sẽ nhận được kết quả.</p>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 24 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Thời gian học</Text>
              <div><Text strong style={{ fontFamily: 'monospace', fontSize: 16 }}>{formatElapsed(elapsedSeconds)}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Câu hỏi</Text>
              <div><Text strong style={{ fontSize: 16 }}>{session.questions.length}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Học sinh</Text>
              <div><Text strong style={{ fontSize: 16 }}>{STUDENTS.length}</Text></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
