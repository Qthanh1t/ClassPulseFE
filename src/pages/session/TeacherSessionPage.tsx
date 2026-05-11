import { useState, useEffect, useRef } from 'react';
import {
  Avatar, Badge, Button, Card, Divider, Modal, Progress, Tag, Tooltip,
  Typography, Alert, Spin,
} from 'antd';
import {
  ArrowLeftOutlined, PlusCircleOutlined,
  PlayCircleOutlined, StopOutlined, CheckCircleOutlined,
  DesktopOutlined, WarningOutlined, UsergroupAddOutlined,
  AudioOutlined, AudioMutedOutlined, VideoCameraOutlined,
  MessageOutlined, TeamOutlined, ClockCircleOutlined,
  PoweroffOutlined, ExclamationCircleOutlined,
  AimOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import StudentStatusList from '../../components/session/StudentStatusList';
import LiveQuestionStats from '../../components/session/LiveQuestionStats';
import CreateQuestionModal from '../../components/session/CreateQuestionModal';
import BreakoutPanel from '../../components/session/BreakoutPanel';
import ChatPanel from '../../components/session/ChatPanel';
import CtrlBtn from '../../components/session/CtrlBtn';
import type { ChatMessage } from '../../components/session/ChatPanel';
import sessionService from '../../services/session.service';
import questionService from '../../services/question.service';
import chatService from '../../services/chat.service';
import { authService } from '../../services/auth.service';
import { createSessionWsClient } from '../../lib/websocket';
import type { SessionWsClient, WsEvent } from '../../lib/websocket';
import type {
  SessionDto, PresenceDto, QuestionDto, QuestionStatsDto,
  BreakoutSessionDto, ChatMessageDto, CreateQuestionRequest,
} from '../../types/api';
import { useAuthStore } from '../../store/authStore';
import heroImg from '../../assets/hero.png';

const { Text } = Typography;

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dtoToChat(msg: ChatMessageDto): ChatMessage {
  return {
    id: msg.id,
    senderId: msg.sender.id,
    senderName: msg.sender.name,
    avatarColor: msg.sender.avatarColor ?? '#6366f1',
    content: msg.content,
    time: formatTime(msg.sentAt),
    isTeacher: msg.sender.role === 'teacher',
  };
}

export default function TeacherSessionPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // classroomId
  const user = useAuthStore((s) => s.user);

  // Core state
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [presence, setPresence] = useState<PresenceDto[]>([]);
  const [raisedHandIds, setRaisedHandIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [runningQuestion, setRunningQuestion] = useState<QuestionDto | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStatsDto | null>(null);
  const [breakout, setBreakout] = useState<BreakoutSessionDto | null>(null);
  const [showBreakoutPanel, setShowBreakoutPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [showStudentList, setShowStudentList] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [now, setNow] = useState(Date.now());

  const wsRef = useRef<SessionWsClient | null>(null);
  const presenceRef = useRef<PresenceDto[]>([]);

  useEffect(() => { presenceRef.current = presence; }, [presence]);

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Clock tick for question countdown (only when timer active)
  useEffect(() => {
    if (!runningQuestion?.endsAt) return;
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(clock);
  }, [runningQuestion?.endsAt]);

  // Init: start/reconnect session + connect WS
  useEffect(() => {
    if (!id) return;

    async function init() {
      let sess: SessionDto;
      try {
        sess = (await sessionService.start(id!, {})).data!;
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { error?: { code?: string } } } })
          ?.response?.data?.error?.code;
        if (code === 'SESSION_ALREADY_ACTIVE') {
          const listRes = await sessionService.listByClassroom(id!);
          const active = listRes.data?.find((s) => s.status === 'active');
          if (!active) { setLoading(false); return; }
          const ticket = await authService.getWsTicket();
          sess = { ...active, wsTicket: ticket.ticket };
        } else {
          setLoading(false);
          return;
        }
      }

      setSession(sess);
      setLoading(false);

      // Load existing data in parallel
      const [qRes, pRes, cRes] = await Promise.all([
        questionService.list(sess.id),
        sessionService.getPresence(sess.id),
        chatService.getHistory(sess.id),
      ]);
      const loadedPresence = pRes.data ?? [];
      setQuestions(qRes.data ?? []);
      setPresence(loadedPresence);
      presenceRef.current = loadedPresence;
      setChatMessages((cRes.data ?? []).map(dtoToChat));

      // Check if a question is already running
      const running = (qRes.data ?? []).find((q) => q.status === 'running');
      if (running) setRunningQuestion(running);

      function handleEvent(event: WsEvent) {
        switch (event.type) {
          case 'student_presence': {
            const p = event.payload as {
              studentId: string; name: string; avatarColor?: string; action: 'joined' | 'left';
            };
            setPresence((prev) => {
              if (p.action === 'joined') {
                if (prev.some((x) => x.studentId === p.studentId)) {
                  return prev.map((x) => x.studentId === p.studentId ? { ...x, isOnline: true } : x);
                }
                return [...prev, { studentId: p.studentId, name: p.name, avatarColor: p.avatarColor, isOnline: true, joinedAt: new Date().toISOString() }];
              }
              return prev.map((x) => x.studentId === p.studentId ? { ...x, isOnline: false } : x);
            });
            break;
          }
          case 'question_started': {
            const q = event.payload as QuestionDto;
            setRunningQuestion(q);
            setQuestions((prev) => {
              const exists = prev.find((x) => x.id === q.id);
              return exists ? prev.map((x) => x.id === q.id ? q : x) : [...prev, q];
            });
            setQuestionStats({
              questionId: q.id,
              totalStudents: presenceRef.current.length,
              answeredCount: 0,
              skippedCount: 0,
              correctCount: 0,
              wrongCount: 0,
              optionDistribution: (q.options ?? []).map((o) => ({
                optionId: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, count: 0,
              })),
              confidenceBreakdown: { high: 0, medium: 0, low: 0, none: 0 },
              silentStudents: [],
            });
            break;
          }
          case 'question_ended': {
            const ended = event.payload as { id: string; endedAt: string };
            setRunningQuestion((prev) => prev ? { ...prev, status: 'ended' as const, endedAt: ended.endedAt } : null);
            setQuestions((prev) => prev.map((q) => q.id === ended.id ? { ...q, status: 'ended' as const } : q));
            questionService.getStats(sess.id, ended.id).then((r) => {
              if (r.data) setQuestionStats(r.data);
            });
            break;
          }
          case 'answer_aggregate': {
            const agg = event.payload as Partial<QuestionStatsDto>;
            setQuestionStats((prev) => prev ? { ...prev, ...agg } : null);
            break;
          }
          case 'raise_hand_changed': {
            const { studentId, raised } = event.payload as { studentId: string; raised: boolean };
            setRaisedHandIds((prev) =>
              raised ? [...prev.filter((x) => x !== studentId), studentId] : prev.filter((x) => x !== studentId),
            );
            break;
          }
          case 'chat_message': {
            const msg = event.payload as ChatMessageDto;
            setChatMessages((prev) => [...prev, dtoToChat(msg)]);
            break;
          }
          case 'breakout_started': {
            setBreakout(event.payload as BreakoutSessionDto);
            setShowBreakoutPanel(true);
            break;
          }
          case 'breakout_ended': {
            setBreakout(null);
            setShowBreakoutPanel(false);
            break;
          }
        }
      }

      const ws = createSessionWsClient(
        sess.wsTicket!,
        sess.id,
        async () => (await authService.getWsTicket()).ticket,
      );
      ws.subscribe(handleEvent);
      wsRef.current = ws;
    }

    init();
    return () => wsRef.current?.disconnect();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const focusedStudent = focusedStudentId
    ? presence.find((p) => p.studentId === focusedStudentId) ?? null
    : null;

  const viewMode =
    breakout || showBreakoutPanel ? 'breakout'
      : runningQuestion?.status === 'running' ? 'running'
      : runningQuestion?.status === 'ended' ? 'ended'
      : 'idle';

  const timeRemaining = runningQuestion?.endsAt
    ? Math.max(0, Math.round((new Date(runningQuestion.endsAt).getTime() - now) / 1000))
    : null;

  const silentStudents = viewMode === 'running' ? (questionStats?.silentStudents ?? []) : [];

  const answeredIds = viewMode === 'running' && questionStats
    ? presence
        .filter((p) => !questionStats.silentStudents.find((s) => s.id === p.studentId))
        .map((p) => p.studentId)
    : [];

  async function handleCreateQuestion(req: CreateQuestionRequest) {
    if (!session) return;
    try {
      const created = (await questionService.create(session.id, req)).data!;
      const started = (await questionService.start(session.id, created.id)).data!;
      const newQ: QuestionDto = { ...created, ...started };
      setQuestions((prev) => [...prev, newQ]);
      setRunningQuestion(newQ);
      setQuestionStats({
        questionId: newQ.id,
        totalStudents: presenceRef.current.length,
        answeredCount: 0,
        skippedCount: 0,
        correctCount: 0,
        wrongCount: 0,
        optionDistribution: (newQ.options ?? []).map((o) => ({
          optionId: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, count: 0,
        })),
        confidenceBreakdown: { high: 0, medium: 0, low: 0, none: 0 },
        silentStudents: presenceRef.current.map((p) => ({ id: p.studentId, name: p.name, avatarColor: p.avatarColor })),
      });
    } catch {
      // handled via WS events if server responds
    }
  }

  async function handleEndQuestion() {
    if (!runningQuestion || !session) return;
    await questionService.end(session.id, runningQuestion.id);
  }

  async function handleEndSession() {
    if (!session) return;
    setEndSessionOpen(false);
    const res = await sessionService.end(session.id);
    navigate(`/dashboard/${res.data!.sessionId}`);
  }

  function handleSendChat(text: string) {
    wsRef.current?.sendChat(text);
  }

  const participants = [
    {
      id: user?.id ?? '__teacher__',
      name: user?.name ?? 'Giáo viên',
      avatarColor: '#6366f1',
      isTeacher: true,
    },
    ...presence.map((p) => ({ id: p.studentId, name: p.name, avatarColor: p.avatarColor })),
  ];

  const panelStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
        <Spin size="large" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 16, fontSize: 15 }}>Đang khởi tạo buổi học...</Text>
      </div>
    );
  }

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
            onClick={() => navigate(`/classes/${id ?? ''}`)}
          />
          <div
            style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <PlayCircleOutlined style={{ color: '#fff', fontSize: 13 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 14, color: '#fff' }}>{session?.classroomName ?? '...'}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge status="processing" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Đang diễn ra · {presence.filter((p) => p.isOnline).length} HS online
              </Text>
            </div>
          </div>
        </div>

        {/* Right: focus badge + elapsed + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {focusedStudent && (
            <Tag
              color="purple"
              icon={<AimOutlined />}
              style={{ borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Focus: {focusedStudent.name.split(' ').pop()}
              <CloseOutlined
                style={{ fontSize: 10, marginLeft: 4, cursor: 'pointer' }}
                onClick={() => setFocusedStudentId(null)}
              />
            </Tag>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 6 }}>
            <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
              {formatElapsed(elapsedSeconds)}
            </Text>
          </div>
          <Avatar size={26} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: 12 }}>
            {user?.name?.charAt(0) ?? 'G'}
          </Avatar>
          <Text style={{ fontSize: 13, color: '#fff' }}>{user?.name ?? 'Giáo viên'}</Text>
        </div>
      </div>

      {/* Silent student alert */}
      {silentStudents.length > 0 && viewMode === 'running' && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message={
            <span>
              <strong>Chưa trả lời: </strong>
              {silentStudents.map((s, i) => (
                <span key={s.id}>
                  {i > 0 ? ', ' : ''}
                  <Avatar
                    size={18}
                    style={{ background: s.avatarColor ?? '#6366f1', fontSize: 10, marginRight: 3, verticalAlign: 'middle' }}
                  >
                    {s.name.charAt(0)}
                  </Avatar>
                  {s.name.split(' ').pop()}
                </span>
              ))}
              {' '}— hãy nhắc nhở các bạn này!
            </span>
          }
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
              participants={participants}
              answeredIds={answeredIds}
              silentStudentIds={silentStudents.map((s) => s.id)}
              raisedHandIds={raisedHandIds}
              questionActive={viewMode === 'running'}
            />
          </div>
        )}

        {/* CENTER: content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

          {/* ── IDLE: Video classroom ── */}
          {viewMode === 'idle' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              {/* Main video area */}
              {focusedStudent ? (
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minHeight: 0 }}>
                  {/* Teacher tile */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '2px solid rgba(99,102,241,0.4)' }}>
                    <img src={heroImg} alt="Screen share" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {screenShareOn && (
                      <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DesktopOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                        <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '24px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={32} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }}>
                        {user?.name?.charAt(0) ?? 'G'}
                      </Avatar>
                      <div>
                        <Text strong style={{ color: '#fff', fontSize: 13 }}>{user?.name ?? 'Giáo viên'}</Text>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {!micOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Mic tắt</Tag>}
                          {!cameraOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Camera tắt</Tag>}
                          {micOn && cameraOn && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Đang giảng bài</Text>}
                        </div>
                      </div>
                      <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>LIVE</Text>} style={{ marginLeft: 'auto' }} />
                    </div>
                  </div>
                  {/* Focused student tile */}
                  <div style={{ borderRadius: 12, background: '#2a2a40', border: '2px solid #6366f1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
                    <Tag color="purple" style={{ position: 'absolute', top: 10, right: 10, borderRadius: 20, fontWeight: 600 }}>
                      <AimOutlined style={{ marginRight: 4 }} />FOCUS
                    </Tag>
                    <Avatar size={80} style={{ background: focusedStudent.avatarColor ?? '#6366f1', fontSize: 30, boxShadow: '0 0 0 4px rgba(99,102,241,0.3)' }}>
                      {focusedStudent.name.charAt(0)}
                    </Avatar>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ color: '#fff', fontSize: 16, display: 'block' }}>{focusedStudent.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontStyle: 'italic' }}>Camera đang được phóng to</Text>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', padding: '16px 14px 10px', display: 'flex', justifyContent: 'center' }}>
                      <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Đang kết nối</Text>} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 280 }}>
                  <img src={heroImg} alt="Screen share" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {screenShareOn && (
                    <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DesktopOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                      <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '24px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar size={32} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }}>
                      {user?.name?.charAt(0) ?? 'G'}
                    </Avatar>
                    <div>
                      <Text strong style={{ color: '#fff', fontSize: 13 }}>{user?.name ?? 'Giáo viên'}</Text>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!micOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Mic tắt</Tag>}
                        {!cameraOn && <Tag color="error" style={{ fontSize: 11, padding: '0 5px' }}>Camera tắt</Tag>}
                        {micOn && cameraOn && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Đang giảng bài</Text>}
                      </div>
                    </div>
                    <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>LIVE</Text>} style={{ marginLeft: 'auto' }} />
                  </div>
                </div>
              )}

              {/* Student thumbnails */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                {presence.length === 0 && (
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: '8px 0' }}>
                    Chờ học sinh tham gia...
                  </Text>
                )}
                {presence.map((p) => {
                  const isFocused = focusedStudentId === p.studentId;
                  const isHovered = hoveredStudentId === p.studentId;
                  return (
                    <Tooltip
                      key={p.studentId}
                      title={isFocused ? 'Đang focus · Click để hủy' : 'Click để focus học sinh này'}
                    >
                      <div
                        style={{
                          width: 80,
                          background: isFocused ? '#2a2a40' : '#2d2d44',
                          borderRadius: 8,
                          aspectRatio: '4/3',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                          position: 'relative',
                          cursor: 'pointer',
                          border: isFocused ? '2px solid #6366f1' : '2px solid transparent',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={() => setHoveredStudentId(p.studentId)}
                        onMouseLeave={() => setHoveredStudentId(null)}
                        onClick={() => setFocusedStudentId(isFocused ? null : p.studentId)}
                      >
                        {(isHovered || isFocused) && (
                          <AimOutlined
                            style={{
                              position: 'absolute',
                              top: 4, left: 5,
                              color: isFocused ? '#818cf8' : 'rgba(255,255,255,0.75)',
                              fontSize: 13,
                            }}
                          />
                        )}
                        <Avatar size={28} style={{ background: p.avatarColor ?? '#6366f1', fontSize: 12 }}>
                          {p.name.charAt(0)}
                        </Avatar>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }} ellipsis>
                          {p.name.split(' ').pop()}
                        </Text>
                        <Badge status={p.isOnline ? 'processing' : 'default'} />
                        {raisedHandIds.includes(p.studentId) && (
                          <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 12 }}>✋</span>
                        )}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RUNNING: Question + stats ── */}
          {viewMode === 'running' && runningQuestion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Card style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <Tag color="blue">
                      {runningQuestion.type === 'single' ? 'Trắc nghiệm 1 đáp án'
                        : runningQuestion.type === 'multiple' ? 'Trắc nghiệm nhiều đáp án' : 'Tự luận'}
                    </Tag>
                    <Tag color="orange" style={{ marginLeft: 4 }}>Câu {runningQuestion.questionOrder}</Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {timeRemaining !== null && runningQuestion.timerSeconds && (
                      <Progress
                        type="circle"
                        size={44}
                        percent={Math.round((timeRemaining / runningQuestion.timerSeconds) * 100)}
                        strokeColor={
                          timeRemaining / runningQuestion.timerSeconds > 0.5 ? '#52c41a'
                            : timeRemaining / runningQuestion.timerSeconds > 0.2 ? '#fa8c16'
                              : '#ff4d4f'
                        }
                        format={() => (
                          <span style={{ fontSize: 11, fontWeight: 600 }}>
                            {timeRemaining >= 60
                              ? `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`
                              : `${timeRemaining}s`}
                          </span>
                        )}
                      />
                    )}
                    <Button danger size="small" icon={<StopOutlined />} onClick={handleEndQuestion}>
                      Kết thúc câu hỏi
                    </Button>
                  </div>
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: runningQuestion.content }}
                  style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, lineHeight: 1.6 }}
                />
                {runningQuestion.options && runningQuestion.options.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {runningQuestion.options.map((opt) => (
                      <div
                        key={opt.id}
                        style={{
                          padding: '10px 14px',
                          border: `1px solid ${opt.isCorrect ? '#b7eb8f' : '#d9d9d9'}`,
                          borderRadius: 8,
                          background: opt.isCorrect ? '#f6ffed' : '#fafafa',
                          display: 'flex', gap: 10, alignItems: 'center',
                        }}
                      >
                        <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ minWidth: 28, textAlign: 'center' }}>
                          {opt.label}
                        </Tag>
                        <Text>{opt.text}</Text>
                        {opt.isCorrect && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {questionStats && (
                <Card style={{ borderRadius: 12 }}>
                  <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>Thống kê thời gian thực</Text>
                  <LiveQuestionStats stats={questionStats} questionType={runningQuestion.type} />
                </Card>
              )}
            </div>
          )}

          {/* ── ENDED: Results ── */}
          {viewMode === 'ended' && runningQuestion && (
            <Card style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <Text strong style={{ fontSize: 15 }}>Kết quả câu {runningQuestion.questionOrder}</Text>
                </div>
                <Button type="primary" onClick={() => { setRunningQuestion(null); setQuestionStats(null); }}>
                  Câu hỏi mới
                </Button>
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: runningQuestion.content }}
                style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}
              />
              {questionStats && <LiveQuestionStats stats={questionStats} questionType={runningQuestion.type} />}
            </Card>
          )}

          {/* ── BREAKOUT: Teacher management view ── */}
          {viewMode === 'breakout' && session && (
            <Card style={{ borderRadius: 12 }}>
              <BreakoutPanel
                sessionId={session.id}
                breakout={breakout}
                presence={presence}
                onClose={() => { setShowBreakoutPanel(false); setBreakout(null); }}
              />
            </Card>
          )}
        </div>

        {/* RIGHT: Quick actions panel */}
        {showQuickActions && (
          <div style={{ ...panelStyle, width: 200, padding: 14, gap: 10, overflowY: 'auto' }}>
            <Text strong style={{ fontSize: 13 }}>Hành động nhanh</Text>

            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              block
              onClick={() => setCreateOpen(true)}
              disabled={viewMode === 'running'}
            >
              Tạo câu hỏi
            </Button>

            <Button icon={<UsergroupAddOutlined />} block onClick={() => setShowBreakoutPanel(true)}>
              Chia nhóm
            </Button>

            <Divider style={{ margin: '2px 0' }} />

            <Text type="secondary" style={{ fontSize: 12 }}>Câu hỏi trong buổi</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {questions.length === 0 && (
                <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Chưa có câu hỏi</Text>
              )}
              {questions.map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: runningQuestion?.id === q.id ? '#e6f4ff' : '#fafafa',
                    border: `1px solid ${runningQuestion?.id === q.id ? '#91caff' : '#f0f0f0'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#8c8c8c', minWidth: 16 }}>{q.questionOrder}.</Text>
                  <Text style={{ fontSize: 12 }} ellipsis>
                    {q.type === 'single' ? '●' : q.type === 'multiple' ? '☑' : '✏'} Câu {q.questionOrder}
                  </Text>
                  {q.status === 'ended' && (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11, marginLeft: 'auto' }} />
                  )}
                </div>
              ))}
            </div>

            <Divider style={{ margin: '2px 0' }} />

            <Button
              size="small"
              block
              onClick={() => session && navigate(`/dashboard/${session.id}`)}
              disabled={!session}
            >
              Xem Dashboard
            </Button>
          </div>
        )}

        {/* CHAT panel */}
        {showChat && (
          <div style={{ ...panelStyle, width: 280 }}>
            <ChatPanel
              messages={chatMessages}
              currentUser={{
                id: user?.id ?? '__teacher__',
                name: user?.name ?? 'Giáo viên',
                avatarColor: '#6366f1',
                isTeacher: true,
              }}
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
        <CtrlBtn
          active={!micOn}
          danger={!micOn}
          onClick={() => setMicOn(!micOn)}
          title={micOn ? 'Tắt mic' : 'Bật mic'}
          icon={micOn ? <AudioOutlined /> : <AudioMutedOutlined />}
        />
        <CtrlBtn
          active={!cameraOn}
          danger={!cameraOn}
          onClick={() => setCameraOn(!cameraOn)}
          title={cameraOn ? 'Tắt camera' : 'Bật camera'}
          icon={<VideoCameraOutlined />}
        />
        <CtrlBtn
          active={screenShareOn}
          onClick={() => setScreenShareOn(!screenShareOn)}
          title={screenShareOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
          icon={<DesktopOutlined />}
        />

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <CtrlBtn
          active={showStudentList}
          onClick={() => setShowStudentList(!showStudentList)}
          title={showStudentList ? 'Ẩn danh sách HS' : 'Hiện danh sách HS'}
          icon={<TeamOutlined />}
        />
        <CtrlBtn
          active={showQuickActions}
          onClick={() => setShowQuickActions(!showQuickActions)}
          title={showQuickActions ? 'Ẩn hành động nhanh' : 'Hiện hành động nhanh'}
          icon={<PlusCircleOutlined />}
        />
        <Tooltip title="Chat">
          <Badge count={showChat ? 0 : chatMessages.length} size="small" overflowCount={99}>
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
      <CreateQuestionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateQuestion}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
            <span>Kết thúc buổi học?</span>
          </div>
        }
        open={endSessionOpen}
        onOk={handleEndSession}
        onCancel={() => setEndSessionOpen(false)}
        okText="Kết thúc & Xem kết quả"
        cancelText="Tiếp tục buổi học"
        okButtonProps={{ danger: true, type: 'primary' }}
        centered
        width={420}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ marginBottom: 12, color: '#595959' }}>
            Buổi học sẽ kết thúc và tất cả học sinh sẽ nhận được kết quả.
          </p>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 24 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Thời gian học</Text>
              <div><Text strong style={{ fontFamily: 'monospace', fontSize: 16 }}>{formatElapsed(elapsedSeconds)}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Câu hỏi</Text>
              <div><Text strong style={{ fontSize: 16 }}>{questions.length}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Học sinh</Text>
              <div><Text strong style={{ fontSize: 16 }}>{presence.length}</Text></div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
