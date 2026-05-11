import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Avatar, Badge, Button, Checkbox, Modal, Progress, Radio,
  Spin, Tag, Tooltip, Typography, Alert,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  SendOutlined, MessageOutlined, AudioOutlined, AudioMutedOutlined,
  VideoCameraOutlined, MinusOutlined, ExpandAltOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined, DesktopOutlined, CompressOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import sessionService from '../../services/session.service';
import questionService from '../../services/question.service';
import answerService from '../../services/answer.service';
import chatService from '../../services/chat.service';
import { createSessionWsClient } from '../../lib/websocket';
import type { SessionWsClient, WsEvent } from '../../lib/websocket';
import ConfidenceSelector from '../../components/session/ConfidenceSelector';
import ChatPanel from '../../components/session/ChatPanel';
import type { ChatMessage } from '../../components/session/ChatPanel';
import StudentStatusList from '../../components/session/StudentStatusList';
import CtrlBtn from '../../components/session/CtrlBtn';
import RichTextEditor from '../../components/session/RichTextEditor';
import heroImg from '../../assets/hero.png';
import type {
  JoinSessionResponse, PresenceDto, QuestionDto, BreakoutSessionDto,
  ChatMessageDto, RoomDto, ConfidenceLevel,
} from '../../types/api';

const { Text, Title } = Typography;

function dtoToChat(dto: ChatMessageDto): ChatMessage {
  const d = new Date(dto.sentAt);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    id: dto.id,
    senderId: dto.sender.id,
    senderName: dto.sender.name,
    avatarColor: dto.sender.avatarColor ?? '#6366f1',
    content: dto.content,
    time,
    isTeacher: dto.sender.role === 'teacher',
  };
}

const Q_TYPE_LABEL: Record<string, string> = {
  single: 'Trắc nghiệm 1 đáp án',
  multiple: 'Nhiều đáp án',
  essay: 'Tự luận',
};

export default function StudentSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [joinInfo, setJoinInfo] = useState<JoinSessionResponse | null>(null);

  const [presence, setPresence] = useState<PresenceDto[]>([]);
  const [raisedHandIds, setRaisedHandIds] = useState<string[]>([]);

  const [runningQuestion, setRunningQuestion] = useState<QuestionDto | null>(null);
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [essayText, setEssayText] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);

  const [myRoom, setMyRoom] = useState<RoomDto | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);

  const [now, setNow] = useState(Date.now());

  const wsRef = useRef<SessionWsClient | null>(null);
  // Ref to always-current submit fn (avoids stale closure in timer effect)
  const submitFnRef = useRef<(() => void) | null>(null);

  // Clock tick for countdown
  useEffect(() => {
    const tid = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tid);
  }, []);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const sessionsRes = await sessionService.listByClassroom(id!);
        const active = sessionsRes.data?.find((s) => s.status === 'active');
        if (!active) { setLoading(false); return; }

        const joinRes = await sessionService.join(active.id);
        if (!joinRes.data) { setLoading(false); return; }
        const info = joinRes.data;
        setJoinInfo(info);

        const [presenceRes, chatHistRes, questionsRes] = await Promise.all([
          sessionService.getPresence(info.sessionId),
          chatService.getHistory(info.sessionId, 50),
          questionService.list(info.sessionId),
        ]);
        if (presenceRes.data) setPresence(presenceRes.data);
        if (chatHistRes.data) setChatMessages(chatHistRes.data.map(dtoToChat));
        const runningQ = questionsRes.data?.find((q) => q.status === 'running');
        if (runningQ) { setRunningQuestion(runningQ); setQuestionPanelOpen(true); }

        function handleEvent(event: WsEvent) {
          switch (event.type) {
            case 'student_presence':
              setPresence(event.payload as PresenceDto[]);
              break;
            case 'question_started': {
              const q = event.payload as QuestionDto;
              setRunningQuestion(q);
              setQuestionSubmitted(false);
              setSelectedOptions([]);
              setEssayText('');
              setConfidence(null);
              setQuestionPanelOpen(true);
              setShowNewQuestionModal(true);
              break;
            }
            case 'question_ended':
              setRunningQuestion((prev) => (prev ? { ...prev, status: 'ended' } : null));
              break;
            case 'raise_hand_changed': {
              const { studentId, raised } = event.payload as { studentId: string; raised: boolean };
              setRaisedHandIds((prev) =>
                raised
                  ? [...prev.filter((sid) => sid !== studentId), studentId]
                  : prev.filter((sid) => sid !== studentId),
              );
              break;
            }
            case 'breakout_started': {
              const bo = event.payload as BreakoutSessionDto;
              const room = bo.rooms.find((r) => r.students.some((s) => s.id === me?.id));
              setMyRoom(room ?? null);
              if (room) wsRef.current?.subscribeRoom(room.id, handleEvent);
              break;
            }
            case 'breakout_ended':
              setMyRoom((prev) => {
                if (prev) wsRef.current?.unsubscribeRoom(prev.id);
                return null;
              });
              break;
            case 'broadcast_message': {
              const { content } = event.payload as { content: string };
              setBroadcastMsg(content);
              break;
            }
            case 'chat_message':
              setChatMessages((prev) => [...prev, dtoToChat(event.payload as ChatMessageDto)]);
              break;
          }
        }

        const ws = createSessionWsClient(
          info.wsTicket,
          info.sessionId,
          async () => (await sessionService.join(info.sessionId)).data!.wsTicket,
        );
        ws.subscribe(handleEvent);
        wsRef.current = ws;
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }
    init();
    return () => wsRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Derived ───────────────────────────────────────────────────────
  const isBreakout = myRoom !== null;
  const isQuestionRunning = runningQuestion?.status === 'running';
  const TIMER_TOTAL = runningQuestion?.timerSeconds ?? 0;
  const timeRemaining =
    isQuestionRunning && runningQuestion?.endsAt && !questionSubmitted
      ? Math.max(0, Math.round((new Date(runningQuestion.endsAt).getTime() - now) / 1000))
      : null;

  const essayHasContent = essayText.replace(/<[^>]*>/g, '').trim().length > 0;
  const canSubmit = selectedOptions.length > 0 || essayHasContent;
  const myRaisedHand = raisedHandIds.includes(me?.id ?? '');
  const myAvatarColor = me?.avatarColor ?? '#6366f1';

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!runningQuestion || !joinInfo || questionSubmitted) return;
    setQuestionSubmitted(true);
    try {
      await answerService.submit(joinInfo.sessionId, runningQuestion.id, {
        selectedOptionIds: selectedOptions.length > 0 ? selectedOptions : undefined,
        essayText: essayText || undefined,
        confidence: confidence || undefined,
      });
    } catch { /* keep submitted flag */ }
  }, [runningQuestion, joinInfo, questionSubmitted, selectedOptions, essayText, confidence]);

  // Keep submit ref current for timer effect
  useEffect(() => { submitFnRef.current = handleSubmit; }, [handleSubmit]);

  // Auto-submit when timer expires
  useEffect(() => {
    if (timeRemaining === 0 && runningQuestion && !questionSubmitted) {
      submitFnRef.current?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  const handleSelectSingle = (optId: string) => {
    if (questionSubmitted) return;
    setSelectedOptions([optId]);
  };

  const handleSelectMultiple = (optId: string) => {
    if (questionSubmitted) return;
    setSelectedOptions((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    );
  };

  const handleRaiseHand = () => {
    const raised = !myRaisedHand;
    wsRef.current?.sendRaiseHand(raised);
  };

  const handleSendChat = (text: string) => {
    wsRef.current?.sendChat(text, myRoom?.id ?? null);
  };

  const handleLeave = async () => {
    if (joinInfo) {
      try { await sessionService.leave(joinInfo.sessionId); } catch { /* ignore */ }
    }
    navigate(`/review/${joinInfo?.sessionId}`);
  };

  // ── Participant list ───────────────────────────────────────────────
  const participants = [
    { id: 'teacher', name: joinInfo?.teacherName ?? 'Giáo viên', isTeacher: true as const },
    ...presence.map((p) => ({ id: p.studentId, name: p.name, avatarColor: p.avatarColor })),
  ];

  // ── Panel styles ──────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 10, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
  };

  const questionPanelStyle: React.CSSProperties = panelExpanded
    ? { position: 'absolute', inset: 0, width: '100%', maxHeight: '100%', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50 }
    : { position: 'absolute', right: showChat ? 316 : 0, bottom: 0, width: 360, maxHeight: 'calc(100% - 10px)', background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50 };

  // ── Loading / error screens ───────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', gap: 16 }}>
        <Spin size="large" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Đang tham gia buổi học...</Text>
      </div>
    );
  }

  if (!joinInfo) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', gap: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>Không có buổi học đang diễn ra.</Text>
        <Button onClick={() => navigate('/classes')}>Về trang chủ</Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1a1a2e', overflow: 'hidden' }}>

      {/* ─── Top header ─── */}
      <div style={{ height: 52, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, gap: 12, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={28} style={{ background: myAvatarColor }}>{me?.name.charAt(0)}</Avatar>
          <div>
            <Text strong style={{ fontSize: 13, color: '#fff' }}>{me?.name}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Badge status="processing" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{joinInfo.classroomName}</Text>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {runningQuestion && !questionPanelOpen && (
            <Button size="small" type="primary" style={{ background: '#6366f1', borderColor: '#6366f1', fontSize: 12 }} onClick={() => setQuestionPanelOpen(true)}>
              📝 Câu hỏi đang chờ
            </Button>
          )}
          <Button size="small" type="text" icon={<ArrowLeftOutlined style={{ color: 'rgba(255,255,255,0.7)' }} />} style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => navigate(`/review/${joinInfo.sessionId}`)}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Kết quả</Text>
          </Button>
        </div>
      </div>

      {/* ─── Broadcast alert ─── */}
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

      {/* ─── Main area ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '10px', gap: 10 }}>

        {/* LEFT: Participant list */}
        {showParticipants && (
          <div style={{ ...panelStyle, width: 200 }}>
            <StudentStatusList
              participants={participants}
              answeredIds={questionSubmitted && runningQuestion ? [me?.id ?? ''] : []}
              silentStudentIds={[]}
              raisedHandIds={raisedHandIds}
              questionActive={isQuestionRunning}
            />
          </div>
        )}

        {/* CENTER: video area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', position: 'relative' }}>

          {/* ── Idle / Question: Teacher + student thumbnails ── */}
          {!isBreakout && (
            <>
              <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                <img src={heroImg} alt="Teacher screen" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {screenShareOn && (
                  <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DesktopOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 10, left: 12, background: 'rgba(0,0,0,0.5)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar size={20} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: 11 }}>
                    {joinInfo.teacherName.charAt(0)}
                  </Avatar>
                  <Text style={{ color: '#fff', fontSize: 12 }}>{joinInfo.teacherName}</Text>
                  <Badge status="processing" />
                </div>
                <div style={{ position: 'absolute', top: 10, right: 12 }}>
                  <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>LIVE</Text>} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {/* My tile */}
                <div style={{ flex: 1, maxWidth: 120, background: '#2d2d44', borderRadius: 8, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative', border: '2px solid #6366f1' }}>
                  {cameraOn
                    ? <Avatar size={36} style={{ background: myAvatarColor }}>{me?.name.charAt(0)}</Avatar>
                    : <div style={{ fontSize: 20 }}>🚫</div>}
                  <Text style={{ color: '#fff', fontSize: 10 }} ellipsis>{(me?.name ?? '').split(' ').pop()} (bạn)</Text>
                  {!micOn && <div style={{ position: 'absolute', bottom: 4, left: 4 }}><AudioMutedOutlined style={{ color: '#ff4d4f', fontSize: 12 }} /></div>}
                  {myRaisedHand && <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 14 }}>✋</div>}
                </div>

                {/* Other students */}
                {presence.filter((p) => p.studentId !== me?.id).slice(0, 5).map((p) => (
                  <div key={p.studentId} style={{ flex: 1, maxWidth: 120, background: '#2d2d44', borderRadius: 8, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Avatar size={32} style={{ background: p.avatarColor ?? '#6366f1', fontSize: 13 }}>{p.name.charAt(0)}</Avatar>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }} ellipsis>{p.name.split(' ').pop()}</Text>
                    <Badge status={p.isOnline ? 'processing' : 'default'} />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Breakout: group member grid ── */}
          {isBreakout && myRoom && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f122, #4f46e522)', border: '1px solid #6366f144', borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <TeamOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ color: '#a5b4fc', fontSize: 13 }}>{myRoom.name}</Text>
                  {myRoom.task && (
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 10 }}>{myRoom.task}</Text>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                {myRoom.students.map((s) => {
                  const isSelf = s.id === me?.id;
                  return (
                    <div key={s.id} style={{ background: '#2d2d44', borderRadius: 10, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', border: isSelf ? '2px solid #6366f1' : '2px solid transparent' }}>
                      {isSelf && !cameraOn
                        ? <div style={{ fontSize: 28 }}>🚫</div>
                        : <Avatar size={48} style={{ background: s.avatarColor ?? '#6366f1', fontSize: 18 }}>{s.name.charAt(0)}</Avatar>}
                      <Text style={{ color: isSelf ? '#91caff' : 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: isSelf ? 600 : 400 }}>
                        {s.name.split(' ').pop()}{isSelf ? ' (bạn)' : ''}
                      </Text>
                      <Badge status="processing" />
                      {isSelf && !micOn && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8 }}>
                          <AudioMutedOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
                        </div>
                      )}
                      {isSelf && myRaisedHand && (
                        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 16 }}>✋</div>
                      )}
                      {isSelf && screenShareOn && (
                        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(82,196,26,0.85)', borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <DesktopOutlined style={{ color: '#fff', fontSize: 11 }} />
                          <Text style={{ color: '#fff', fontSize: 10 }}>Đang chia sẻ</Text>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Floating question panel ── */}
          {runningQuestion && questionPanelOpen && (
            <div style={questionPanelStyle}>
              {/* Header */}
              <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Text strong style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}>📝 Câu hỏi</Text>
                  <Tag color="gold" style={{ fontSize: 11, padding: '0 6px', flexShrink: 0 }}>
                    {Q_TYPE_LABEL[runningQuestion.type]}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {timeRemaining !== null && timeRemaining > 0 && (
                    <Progress
                      type="circle"
                      size={34}
                      percent={TIMER_TOTAL > 0 ? Math.round((timeRemaining / TIMER_TOTAL) * 100) : 100}
                      strokeColor={
                        TIMER_TOTAL > 0 && timeRemaining / TIMER_TOTAL > 0.5 ? '#34d399'
                          : TIMER_TOTAL > 0 && timeRemaining / TIMER_TOTAL > 0.2 ? '#fbbf24'
                            : '#f87171'
                      }
                      trailColor="rgba(255,255,255,0.2)"
                      format={() => (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
                          {timeRemaining >= 60
                            ? `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`
                            : `${timeRemaining}s`}
                        </span>
                      )}
                    />
                  )}
                  <Tooltip title={panelExpanded ? 'Thu nhỏ' : 'Phóng to'}>
                    <Button size="small" type="text" icon={panelExpanded ? <CompressOutlined style={{ color: 'rgba(255,255,255,0.8)' }} /> : <ExpandAltOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />} onClick={() => setPanelExpanded(!panelExpanded)} style={{ background: 'rgba(255,255,255,0.15)' }} />
                  </Tooltip>
                  <Tooltip title="Thu nhỏ">
                    <Button size="small" type="text" icon={<MinusOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />} onClick={() => { setQuestionPanelOpen(false); setPanelExpanded(false); }} style={{ background: 'rgba(255,255,255,0.15)' }} />
                  </Tooltip>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: runningQuestion.content }}
                  style={{ fontSize: 14, fontWeight: 500, marginBottom: 14, lineHeight: 1.6 }}
                />

                {runningQuestion.options && runningQuestion.type === 'single' && (
                  <Radio.Group value={selectedOptions[0]} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {runningQuestion.options.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectSingle(opt.id)}
                          style={{ padding: '10px 12px', border: `2px solid ${selectedOptions.includes(opt.id) ? '#6366f1' : '#e8e8e8'}`, borderRadius: 8, cursor: questionSubmitted ? 'default' : 'pointer', background: selectedOptions.includes(opt.id) ? '#eef2ff' : '#fafafa', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
                        >
                          <Radio value={opt.id} />
                          <Tag style={{ minWidth: 24, textAlign: 'center', margin: 0, fontSize: 11 }}>{opt.label}</Tag>
                          <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                        </div>
                      ))}
                    </div>
                  </Radio.Group>
                )}

                {runningQuestion.options && runningQuestion.type === 'multiple' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {runningQuestion.options.map((opt) => (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectMultiple(opt.id)}
                        style={{ padding: '10px 12px', border: `2px solid ${selectedOptions.includes(opt.id) ? '#6366f1' : '#e8e8e8'}`, borderRadius: 8, cursor: questionSubmitted ? 'default' : 'pointer', background: selectedOptions.includes(opt.id) ? '#eef2ff' : '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <Checkbox checked={selectedOptions.includes(opt.id)} />
                        <Tag style={{ minWidth: 24, textAlign: 'center', margin: 0, fontSize: 11 }}>{opt.label}</Tag>
                        <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                      </div>
                    ))}
                  </div>
                )}

                {runningQuestion.type === 'essay' && (
                  questionSubmitted ? (
                    <div
                      className="ck-content"
                      style={{ fontSize: 13, lineHeight: 1.6, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', minHeight: 64 }}
                      dangerouslySetInnerHTML={{ __html: essayText || '<span style="color:#94a3b8">Không có câu trả lời</span>' }}
                    />
                  ) : (
                    <RichTextEditor onChange={setEssayText} placeholder="Nhập câu trả lời của bạn..." minHeight={panelExpanded ? 180 : 100} />
                  )
                )}

                {!questionSubmitted && (
                  <div style={{ marginTop: 12 }}>
                    <ConfidenceSelector value={confidence} onChange={setConfidence} />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
                {!questionSubmitted ? (
                  <Button type="primary" icon={<SendOutlined />} block onClick={handleSubmit} disabled={!canSubmit} style={{ borderRadius: 8, fontWeight: 600 }}>
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
                      {runningQuestion.status === 'ended' ? 'Câu hỏi đã kết thúc.' : 'Chờ giáo viên kết thúc câu hỏi...'}
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Button size="small" icon={<MinusOutlined />} onClick={() => { setQuestionPanelOpen(false); setPanelExpanded(false); }}>
                        Thu nhỏ, tiếp tục học
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Chat panel */}
        {showChat && (
          <div style={{ ...panelStyle, width: 280 }}>
            <ChatPanel
              messages={chatMessages}
              currentUser={{ id: me?.id ?? '', name: me?.name ?? '', avatarColor: myAvatarColor }}
              onSend={handleSendChat}
              onClose={() => setShowChat(false)}
              height="100%"
            />
          </div>
        )}
      </div>

      {/* ─── Bottom control bar ─── */}
      <div style={{ height: 60, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexShrink: 0, padding: '0 20px', overflowX: 'auto' }}>
        <CtrlBtn active={!micOn} danger={!micOn} onClick={() => setMicOn(!micOn)} title={micOn ? 'Tắt mic' : 'Bật mic'} icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />} />
        <CtrlBtn active={!cameraOn} danger={!cameraOn} onClick={() => setCameraOn(!cameraOn)} title={cameraOn ? 'Tắt camera' : 'Bật camera'} icon={<VideoCameraOutlined />} />
        <CtrlBtn active={screenShareOn} onClick={() => setScreenShareOn(!screenShareOn)} title={screenShareOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'} icon={<DesktopOutlined />} />

        <CtrlBtn active={myRaisedHand} onClick={handleRaiseHand} title={myRaisedHand ? 'Hạ tay' : 'Giơ tay'}>✋</CtrlBtn>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px', flexShrink: 0 }} />

        <CtrlBtn active={showParticipants} onClick={() => setShowParticipants(!showParticipants)} title={showParticipants ? 'Ẩn thành viên' : 'Hiện thành viên'} icon={<TeamOutlined />} />

        <Tooltip title="Chat">
          <Button
            shape="circle"
            type={showChat ? 'primary' : 'default'}
            icon={<MessageOutlined />}
            style={{ background: showChat ? undefined : 'rgba(255,255,255,0.15)', borderColor: showChat ? undefined : 'transparent', color: showChat ? undefined : '#fff' }}
            onClick={() => setShowChat(!showChat)}
          />
        </Tooltip>

        {runningQuestion && (
          <CtrlBtn
            active={questionPanelOpen}
            onClick={() => setQuestionPanelOpen(!questionPanelOpen)}
            title={questionPanelOpen ? 'Thu nhỏ câu hỏi' : 'Mở câu hỏi'}
            icon={questionPanelOpen ? <MinusOutlined /> : <ExpandAltOutlined />}
          >
            {questionSubmitted ? '✓ Đã trả lời' : '📝 Câu hỏi'}
          </CtrlBtn>
        )}

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px', flexShrink: 0 }} />

        <Button type="primary" danger shape="round" onClick={() => setLeaveOpen(true)} style={{ fontWeight: 600, flexShrink: 0 }}>
          Rời lớp
        </Button>
      </div>

      {/* ── Leave confirm modal ── */}
      <Modal
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} /><span>Rời khỏi lớp học?</span></div>}
        open={leaveOpen}
        onOk={handleLeave}
        onCancel={() => setLeaveOpen(false)}
        okText="Rời lớp & Xem kết quả"
        cancelText="Tiếp tục học"
        okButtonProps={{ danger: true, type: 'primary' }}
        centered
        width={400}
      >
        <p style={{ color: '#595959', margin: '8px 0' }}>Bạn sẽ rời buổi học và xem lại kết quả của mình.</p>
      </Modal>

      {/* ── New question notification ── */}
      <Modal open={showNewQuestionModal} onCancel={() => setShowNewQuestionModal(false)} footer={null} centered width={360} closeIcon={null}>
        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>📢</div>
          <Title level={4} style={{ margin: '0 0 8px' }}>Giáo viên vừa đặt câu hỏi!</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Trả lời câu hỏi ngay bên dưới hoặc thu nhỏ để tiếp tục xem bài giảng
          </Text>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <Button block onClick={() => setShowNewQuestionModal(false)}>Thu nhỏ</Button>
            <Button type="primary" block onClick={() => setShowNewQuestionModal(false)}>Trả lời ngay →</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
