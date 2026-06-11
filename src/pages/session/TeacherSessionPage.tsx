import { useState, useEffect, useRef } from 'react';
import {
  Avatar, Badge, Button, Card, Collapse, Divider, Drawer, Modal, Progress, Tag, Tooltip,
  Typography, Alert, Spin, notification,
} from 'antd';
import {
  ArrowLeftOutlined, PlusCircleOutlined,
  PlayCircleOutlined, StopOutlined, CheckCircleOutlined,
  DesktopOutlined, WarningOutlined, UsergroupAddOutlined,
  AudioOutlined, AudioMutedOutlined, VideoCameraOutlined,
  MessageOutlined, TeamOutlined, ClockCircleOutlined,
  PoweroffOutlined, ExclamationCircleOutlined,
  AimOutlined, CloseOutlined, BarChartOutlined,
  DownOutlined, UpOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import StudentStatusList from '../../components/session/StudentStatusList';
import StudentAnswersPanel from '../../components/session/StudentAnswersPanel';
import CreateQuestionModal from '../../components/session/CreateQuestionModal';
import BreakoutPanel from '../../components/session/BreakoutPanel';
import ChatPanel from '../../components/session/ChatPanel';
import CtrlBtn from '../../components/session/CtrlBtn';
import VideoTile from '../../components/session/VideoTile';
import type { ChatMessage } from '../../components/session/ChatPanel';
import sessionService from '../../services/session.service';
import questionService from '../../services/question.service';
import breakoutService from '../../services/breakout.service';
import chatService from '../../services/chat.service';
import { authService } from '../../services/auth.service';
import { createSessionWsClient } from '../../lib/websocket';
import type { SessionWsClient, WsEvent } from '../../lib/websocket';
import type {
  SessionDto, PresenceDto, QuestionDto, QuestionStatsDto,
  BreakoutSessionDto, ChatMessageDto, CreateQuestionRequest,
} from '../../types/api';
import { useAuthStore } from '../../store/authStore';
import { useLocalMedia } from '../../hooks/useLocalMedia';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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
    avatarColor: msg.sender.avatarColor ?? '#4f46e5',
    avatarUrl: msg.sender.avatarUrl ?? undefined,
    content: msg.content,
    time: formatTime(msg.sentAt),
    isTeacher: msg.sender.role === 'teacher',
  };
}

export default function TeacherSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const scheduleId = (location.state as { scheduleId?: string } | null)?.scheduleId;
  const { id } = useParams<{ id: string }>(); // classroomId
  const user = useAuthStore((s) => s.user);
  const { compact } = useBreakpoint();

  // ── Core state ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [presence, setPresence] = useState<PresenceDto[]>([]);
  const [raisedHandIds, setRaisedHandIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [runningQuestion, setRunningQuestion] = useState<QuestionDto | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStatsDto | null>(null);
  const [breakout, setBreakout] = useState<BreakoutSessionDto | null>(null);
  const [showBreakoutPanel, setShowBreakoutPanel] = useState(false);
  // Which sub-room the teacher is currently visiting (drives the live video grid).
  const [teacherJoinedRoomId, setTeacherJoinedRoomId] = useState<string | null>(null);
  // Collapse the breakout management panel to make room for the student video grid.
  const [breakoutPanelCollapsed, setBreakoutPanelCollapsed] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // Số tin nhắn chưa đọc — reset về 0 khi mở chat
  const [unreadChat, setUnreadChat] = useState(0);

  // ── UI state ────────────────────────────────────────────────────────
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [showStudentList, setShowStudentList] = useState(() => window.innerWidth >= 640);
  const [showQuickActions, setShowQuickActions] = useState(() => window.innerWidth >= 1024);
  const [showChat, setShowChat] = useState(false);
  // Ref đồng bộ showChat để WS handler đọc giá trị mới nhất (tránh stale closure)
  const showChatRef = useRef(showChat);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);
  const [createOpen, setCreateOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [allQuestionStats, setAllQuestionStats] = useState<Map<string, QuestionStatsDto>>(new Map());
  const [showResultsDrawer, setShowResultsDrawer] = useState(false);

  const wsRef = useRef<SessionWsClient | null>(null);
  const presenceRef = useRef<PresenceDto[]>([]);
  const questionsRef = useRef<QuestionDto[]>([]);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  // Server clock − local clock (ms), từ serverNow trong question_started — countdown bám
  // theo đồng hồ server để khớp với phía học sinh
  const clockOffsetRef = useRef(0);
  // Mirror breakout state cho closure onConnected (chạy ngoài React render): biết đang
  // breakout + GV đang ở phòng nào để chỉ gọi WebRTC tới đúng người sau khi (re)connect
  const breakoutRef = useRef<BreakoutSessionDto | null>(null);
  const teacherJoinedRoomIdRef = useRef<string | null>(null);

  useEffect(() => { presenceRef.current = presence; }, [presence]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { breakoutRef.current = breakout; }, [breakout]);
  useEffect(() => { teacherJoinedRoomIdRef.current = teacherJoinedRoomId; }, [teacherJoinedRoomId]);

  // ── WebRTC hooks ────────────────────────────────────────────────────
  const localMedia = useLocalMedia();
  const rtc = useWebRTC(user?.id ?? '', wsRef, localMedia.streamRef);

  // ── Timers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!runningQuestion?.endsAt) return;
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(clock);
  }, [runningQuestion?.endsAt]);


  // ── Init: start/reconnect session + connect WS + init WebRTC ────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function init() {
      let sess: SessionDto;
      try {
        // Backend trả về session hiện có nếu đã active (không throw SESSION_ALREADY_ACTIVE nữa)
        sess = (await sessionService.start(id!, scheduleId ? { scheduleId } : {})).data!;
      } catch {
        if (!cancelled) setLoading(false);
        return;
      }

      if (cancelled) return;
      setSession(sess);
      setLoading(false);

      const [qRes, pRes, cRes, bRes] = await Promise.all([
        questionService.list(sess.id),
        sessionService.getPresence(sess.id),
        chatService.getHistory(sess.id),
        breakoutService.getActive(sess.id),
      ]);
      if (cancelled) return;
      const loadedPresence = (pRes.data ?? []).filter((p) => p.isOnline);
      setQuestions(qRes.data ?? []);
      setPresence(loadedPresence);
      presenceRef.current = loadedPresence;
      setChatMessages((cRes.data ?? []).map(dtoToChat));

      const running = (qRes.data ?? []).find((q) => q.status === 'running');
      if (running) setRunningQuestion(running);

      if (bRes.data) {
        setBreakout(bRes.data);
        breakoutRef.current = bRes.data;
        setShowBreakoutPanel(true);
        // Reload giữa lúc đang ở trong một phòng nhóm → khôi phục vị trí; onConnected
        // sẽ gọi lại joinRoom để HS trong phòng re-offer WebRTC tới kết nối mới của GV
        if (bRes.data.teacherRoomId) {
          setTeacherJoinedRoomId(bRes.data.teacherRoomId);
          teacherJoinedRoomIdRef.current = bRes.data.teacherRoomId;
          setBreakoutPanelCollapsed(true);
        }
      }

      // Pre-fetch stats for already-ended questions so the results drawer can show them
      const endedQs = (qRes.data ?? []).filter((q) => q.status === 'ended');
      if (endedQs.length > 0) {
        Promise.allSettled(endedQs.map((q) => questionService.getStats(sess.id, q.id))).then((results) => {
          if (cancelled) return;
          setAllQuestionStats((prev) => {
            const map = new Map(prev);
            results.forEach((r, i) => {
              if (r.status === 'fulfilled' && r.value.data) map.set(endedQs[i].id, r.value.data);
            });
            return map;
          });
        });
      }

      // Start camera/mic BEFORE connecting WS so localStreamRef is ready when
      // the first student_presence event fires and callPeer creates a PeerConnection.
      // If media fails, we still connect WS (teacher can receive but not send video).
      if (!localMedia.streamRef.current) {
        const stream = await localMedia.startMedia(true, true);
        if (!stream && !cancelled) {
          notification.warning({
            message: 'Không truy cập được camera/mic',
            description: 'Bạn vẫn tham gia được nhưng sẽ không hiển thị video.',
            placement: 'topRight',
          });
        }
      }
      if (cancelled) return;

      function handleEvent(event: WsEvent) {
        switch (event.type) {
          case 'student_presence': {
            const p = event.payload as {
              studentId: string; name: string; avatarColor?: string; avatarUrl?: string; action: 'joined' | 'left';
            };
            if (p.action === 'left') {
              rtc.closePeer(p.studentId);
              setPresence((prev) => {
                const updated = prev.filter((x) => x.studentId !== p.studentId);
                presenceRef.current = updated;
                return updated;
              });
            } else {
              // Do NOT call callPeer here — backend broadcasts student_presence at STOMP CONNECT,
              // BEFORE student subscribes to /user/queue/private. Teacher's offer would be dropped.
              // Student always initiates WebRTC to teacher in their onConnected callback.
              // Optimistically mark online (may have partial info from WS payload)
              setPresence((prev) => {
                if (prev.some((x) => x.studentId === p.studentId)) {
                  return prev.map((x) => x.studentId === p.studentId ? { ...x, isOnline: true } : x);
                }
                return [...prev, { studentId: p.studentId, name: p.name ?? 'Học sinh', avatarColor: p.avatarColor, avatarUrl: p.avatarUrl, isOnline: true, joinedAt: new Date().toISOString() }];
              });
              // Refresh from API: update profile data AND remove students now offline
              void sessionService.getPresence(sess.id).then((res) => {
                if (res.data) {
                  const profileMap = new Map(res.data.map((ap) => [ap.studentId, ap]));
                  setPresence((prev) => {
                    const updated = prev
                      .filter(entry => {
                        const api = profileMap.get(entry.studentId);
                        return api === undefined || api.isOnline !== false;
                      })
                      .map(entry => {
                        const profile = profileMap.get(entry.studentId);
                        return profile
                          ? { ...entry, name: profile.name ?? entry.name, avatarColor: profile.avatarColor ?? entry.avatarColor, avatarUrl: profile.avatarUrl ?? entry.avatarUrl }
                          : entry;
                      });
                    presenceRef.current = updated;
                    return updated;
                  });
                }
              });
            }
            break;
          }
          case 'question_started': {
            // Backend payload: { questionId, type, content, options[{id,label,text,isCorrect,order}], endsAt }
            const raw = event.payload as {
              questionId: string; type: string; content: string;
              options?: { id: string; label: string; text: string; isCorrect: boolean; order: number }[];
              endsAt?: string;
              serverNow?: string;
            };
            if (raw.serverNow) {
              clockOffsetRef.current = new Date(raw.serverNow).getTime() - Date.now();
            }
            // Use setQuestions updater to read the LATEST state (avoids stale questionsRef causing duplicates)
            let resolvedQ: QuestionDto | null = null;
            setQuestions((current) => {
              const existing = current.find((x) => x.id === raw.questionId);
              if (existing) {
                const updated = { ...existing, status: 'running' as const, endsAt: raw.endsAt ?? existing.endsAt };
                resolvedQ = updated;
                return current.map((x) => x.id === raw.questionId ? updated : x);
              }
              // Fallback: question not yet in state (reconnect scenario) — construct from WS payload
              const fallback: QuestionDto = {
                id: raw.questionId, questionOrder: 0, type: raw.type as QuestionDto['type'],
                content: raw.content, status: 'running', createdAt: new Date().toISOString(),
                options: (raw.options ?? []).map((o) => ({
                  id: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, optionOrder: o.order,
                })),
                endsAt: raw.endsAt,
              };
              resolvedQ = fallback;
              return [...current, fallback];
            });
            const q = resolvedQ ?? questionsRef.current.find((x) => x.id === raw.questionId) ?? null;
            if (q) {
              setRunningQuestion(q);
              setQuestionStats({
                questionId: q.id,
                totalStudents: presenceRef.current.length,
                answeredCount: 0, skippedCount: 0, correctCount: 0, wrongCount: 0,
                optionDistribution: (q.options ?? []).map((o) => ({
                  optionId: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, count: 0,
                })),
                confidenceBreakdown: { high: 0, medium: 0, low: 0, none: 0 },
                silentStudents: presenceRef.current.map((p) => ({ id: p.studentId, name: p.name, avatarColor: p.avatarColor, avatarUrl: p.avatarUrl })),
              });
            }
            break;
          }
          case 'question_ended': {
            // Backend payload: { questionId } — NOT { id, endedAt }
            const ended = event.payload as { questionId: string };
            setRunningQuestion((prev) => prev?.id === ended.questionId ? { ...prev, status: 'ended' as const } : prev);
            setQuestions((prev) => prev.map((q) => q.id === ended.questionId ? { ...q, status: 'ended' as const } : q));
            questionService.getStats(sess.id, ended.questionId).then((r) => {
              if (r.data) {
                setQuestionStats(r.data);
                setAllQuestionStats((prev) => new Map(prev).set(ended.questionId, r.data!));
              }
            });
            break;
          }
          case 'answer_aggregate': {
            // Backend payload: { questionId, answeredCount, totalCount } — no silentStudents
            const agg = event.payload as { questionId: string; answeredCount: number; totalCount: number };
            // Update counts immediately for live progress bar
            setQuestionStats((prev) => prev ? {
              ...prev,
              answeredCount: agg.answeredCount,
              totalStudents: agg.totalCount,
            } : null);
            // Fetch full stats (silentStudents, optionDistribution, confidence) from REST
            questionService.getStats(sess.id, agg.questionId).then((r) => {
              if (r.data) setQuestionStats(r.data);
            });
            break;
          }
          case 'raise_hand_changed': {
            const { studentId, raised } = event.payload as { studentId: string; raised: boolean };
            setRaisedHandIds((prev) =>
              raised ? [...prev.filter((x) => x !== studentId), studentId] : prev.filter((x) => x !== studentId),
            );
            break;
          }
          case 'focus_changed': {
            const { focusedStudentId: fid } = event.payload as { focusedStudentId: string | null };
            setFocusedStudentId(fid);
            break;
          }
          case 'chat_message': {
            const msg = event.payload as ChatMessageDto;
            setChatMessages((prev) => [...prev, dtoToChat(msg)]);
            // Chat đang đóng → tăng số tin chưa đọc
            if (!showChatRef.current) setUnreadChat((n) => n + 1);
            break;
          }
          case 'breakout_started': {
            // WS payload chỉ có studentIds (không có name/avatarColor) → fetch full DTO từ REST
            void breakoutService.getActive(sess.id).then((res) => {
              if (!cancelled && res.data) setBreakout(res.data);
            });
            setShowBreakoutPanel(true);
            break;
          }
          case 'breakout_ended': {
            setBreakout(null);
            setShowBreakoutPanel(false);
            setTeacherJoinedRoomId(null);
            setBreakoutPanelCollapsed(false);
            // Close all PCs — some are stale (students closed their side during breakout).
            // Without this, callPeer skips students whose PC still shows 'connected' on our side.
            rtc.closeAllPeers();
            void (async () => {
              for (const p of presenceRef.current.filter((x) => x.isOnline)) {
                await rtc.callPeer(p.studentId);
              }
            })();
            break;
          }
          case 'camera_state_changed': {
            const { fromId, isCameraOff } = event.payload as { fromId: string; isCameraOff: boolean };
            rtc.updatePeerCameraState(fromId, isCameraOff);
            break;
          }
          case 'webrtc_offer': {
            const raw = event.payload as Record<string, unknown>;
            console.log('[RTC-WS] webrtc_offer keys:', Object.keys(raw), '| fromId:', raw.fromId);
            void rtc.handleOffer(raw.fromId as string, raw.sdp as string);
            break;
          }
          case 'webrtc_answer': {
            const raw = event.payload as Record<string, unknown>;
            console.log('[RTC-WS] webrtc_answer keys:', Object.keys(raw), '| fromId:', raw.fromId);
            void rtc.handleAnswer(raw.fromId as string, raw.sdp as string);
            break;
          }
          case 'webrtc_ice_candidate': {
            const raw = event.payload as Record<string, unknown>;
            void rtc.handleIceCandidate(raw.fromId as string, raw.candidate as RTCIceCandidateInit);
            break;
          }
        }
      }

      if (cancelled) return;
      const ws = createSessionWsClient(
        sess.wsTicket!,
        sess.id,
        async () => (await authService.getWsTicket()).ticket,
        async () => {
          if (cancelled) return;
          // On reconnect: refresh presence in case events were missed while WS was down
          try {
            const pRes = await sessionService.getPresence(sess.id);
            if (!cancelled && pRes.data) {
              const online = pRes.data.filter((p) => p.isOnline);
              setPresence(online);
              presenceRef.current = online;
            }
          } catch { /* ignore */ }
          if (cancelled) return;
          const bo = breakoutRef.current;
          const visitingRoomId = teacherJoinedRoomIdRef.current;
          if (bo && visitingRoomId) {
            // Đang ở trong một phòng nhóm (reload trang / WS reconnect): gọi lại joinRoom
            // để backend re-broadcast teacher_joined_room — HS trong phòng đóng PC cũ và
            // gửi offer mới tới kết nối vừa tạo của GV. Không tự callPeer (HS là bên offer).
            try {
              await breakoutService.joinRoom(sess.id, bo.breakoutSessionId, visitingRoomId);
            } catch { /* phòng/breakout có thể vừa kết thúc — bỏ qua */ }
            return;
          }
          // Re-offer WebRTC to online students — skip những HS đang ở phòng nhóm
          const assignedIds = bo
            ? new Set(bo.rooms.flatMap((r) => r.students.map((s) => s.id)))
            : null;
          for (const p of presenceRef.current.filter((x) => x.isOnline)) {
            if (assignedIds?.has(p.studentId)) continue;
            await rtc.callPeer(p.studentId);
          }
        },
      );
      ws.subscribe(handleEvent);
      wsRef.current = ws;
    }

    // setTimeout đảm bảo StrictMode cleanup cancel được trước khi init chạy
    const timer = setTimeout(() => { if (!cancelled) void init(); }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      wsRef.current?.disconnect();
      rtc.closeAllPeers();
      localMedia.stopMedia();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Derived ─────────────────────────────────────────────────────────
  const focusedStudent = focusedStudentId
    ? presence.find((p) => p.studentId === focusedStudentId) ?? null
    : null;

  const viewMode =
    breakout || showBreakoutPanel ? 'breakout'
      : runningQuestion?.status === 'running' ? 'running'
      : runningQuestion?.status === 'ended' ? 'ended'
      : 'idle';

  // The sub-room the teacher is currently visiting — its students get a live video grid.
  const teacherJoinedRoom = breakout?.rooms.find((r) => r.id === teacherJoinedRoomId) ?? null;
  // Chỉ render HS trong phòng còn online — HS rời lớp giữa breakout thì bỏ tile luôn
  const joinedRoomOnlineStudents = teacherJoinedRoom
    ? teacherJoinedRoom.students.filter((s) => presence.some((p) => p.studentId === s.id && p.isOnline))
    : [];

  // Students NOT assigned to any sub-room stay in the main room. While the teacher is in
  // the main room (no sub-room joined) they keep talking to these students.
  const assignedStudentIds = breakout
    ? breakout.rooms.flatMap((r) => r.students.map((s) => s.id))
    : [];
  const mainRoomStudents = presence.filter(
    (p) => p.isOnline && !assignedStudentIds.includes(p.studentId),
  );

  const timeRemaining = runningQuestion?.endsAt
    ? Math.max(0, Math.round((new Date(runningQuestion.endsAt).getTime() - (now + clockOffsetRef.current)) / 1000))
    : null;

  const silentStudents = viewMode === 'running' ? (questionStats?.silentStudents ?? []) : [];

  const answeredIds = viewMode === 'running' && questionStats
    ? presence
        .filter((p) => !questionStats.silentStudents.find((s) => s.id === p.studentId))
        .map((p) => p.studentId)
    : [];

  // ── Handlers ────────────────────────────────────────────────────────
  async function handleCreateQuestion(req: CreateQuestionRequest) {
    if (!session) return;
    try {
      const created = (await questionService.create(session.id, req)).data!;
      const started = (await questionService.start(session.id, created.id)).data!;
      const newQ: QuestionDto = { ...created, ...started };
      // Dedup-safe: WS question_started may fire before this and add fallback entry
      setQuestions((prev) => {
        if (prev.some((q) => q.id === newQ.id)) {
          return prev.map((q) => q.id === newQ.id ? newQ : q);
        }
        return [...prev, newQ];
      });
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
    } catch (err) {
      const errCode = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      const errMsg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      const desc = errCode === 'QUESTION_ALREADY_RUNNING'
        ? 'Đang có câu hỏi khác đang chạy. Hãy kết thúc câu hỏi hiện tại trước.'
        : errCode === 'NO_CORRECT_OPTION'
          ? 'Phải chọn ít nhất 1 đáp án đúng.'
          : (errMsg ?? 'Vui lòng thử lại.');
      notification.error({
        message: 'Không thể phát câu hỏi',
        description: desc,
        placement: 'topRight',
      });
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

  function handleToggleCamera() {
    localMedia.toggleCamera();
    const track = localMedia.streamRef.current?.getVideoTracks()[0];
    if (track) wsRef.current?.sendCameraState(!track.enabled);
  }

  async function handleToggleScreenShare() {
    if (screenShareOn) {
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      const cameraTrack = localMedia.streamRef.current?.getVideoTracks()[0] ?? null;
      await rtc.replaceVideoTrack(cameraTrack);
      setScreenShareOn(false);
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;
        await rtc.replaceVideoTrack(screenTrack);
        setScreenShareOn(true);
        screenTrack.onended = async () => {
          screenTrackRef.current = null;
          const cameraTrack = localMedia.streamRef.current?.getVideoTracks()[0] ?? null;
          await rtc.replaceVideoTrack(cameraTrack);
          setScreenShareOn(false);
        };
      } catch {
        // User cancelled screen share picker — ignore
      }
    }
  }

  function handleFocusStudent(studentId: string | null) {
    setFocusedStudentId(studentId);
    wsRef.current?.sendFocus(studentId);
  }

  const participants = [
    {
      id: user?.id ?? '__teacher__',
      name: user?.name ?? 'Giáo viên',
      avatarColor: user?.avatarColor ?? '#4f46e5',
      avatarUrl: user?.avatarUrl ?? undefined,
      isTeacher: true,
      isOnline: true,
    },
    // Only show online students in the list; offline ones stay in presence for the thumbnail strip
    ...presence
      .filter((p) => p.isOnline)
      .map((p) => ({
        id: p.studentId,
        name: p.name ?? 'Học sinh',
        avatarColor: p.avatarColor,
        avatarUrl: p.avatarUrl,
        isOnline: true,
      })),
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

  const overlayBase: React.CSSProperties = compact
    ? { position: 'fixed', top: 52, bottom: 60, zIndex: 100 }
    : {};

  function toggleStudentList() {
    if (compact) { setShowQuickActions(false); setShowChat(false); }
    setShowStudentList((v) => !v);
  }
  function toggleQuickActions() {
    if (compact) { setShowStudentList(false); setShowChat(false); }
    setShowQuickActions((v) => !v);
  }
  function toggleChat() {
    if (compact) { setShowStudentList(false); setShowQuickActions(false); }
    if (!showChat) setUnreadChat(0); // mở chat → coi như đã đọc
    setShowChat((v) => !v);
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1b3a' }}>
        <Spin size="large" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 16, fontSize: 15 }}>Đang khởi tạo buổi học...</Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1b3a' }}>

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
              background: '#4f46e5',
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

        {/* Right */}
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
                onClick={() => handleFocusStudent(null)}
              />
            </Tag>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 6 }}>
            <ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
              {formatElapsed(elapsedSeconds)}
            </Text>
          </div>
          <Avatar size={26} src={user?.avatarUrl ?? undefined} style={{ background: user?.avatarColor ?? '#4f46e5', fontSize: 12 }}>
            {user?.name?.charAt(0) ?? 'G'}
          </Avatar>
          {!compact && <Text style={{ fontSize: 13, color: '#fff' }}>{user?.name ?? 'Giáo viên'}</Text>}
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
                    src={s.avatarUrl ?? undefined}
                    style={{ background: s.avatarColor ?? '#4f46e5', fontSize: 10, marginRight: 3, verticalAlign: 'middle' }}
                  >
                    {s.name.charAt(0)}
                  </Avatar>
                  {s.name.split(' ').pop()}
                </span>
              ))}
              {' '}· hãy nhắc nhở các bạn này!
            </span>
          }
          closable
          style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #f3d49b', flexShrink: 0 }}
        />
      )}

      {/* ─── Main area ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '10px', gap: 10 }}>

        {/* LEFT: Student list panel */}
        {showStudentList && (
          <div
            className={compact ? 'sq-panel-overlay' : undefined}
            style={{ ...panelStyle, ...overlayBase, left: compact ? 0 : undefined, width: 220 }}
          >
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
                /* ── Focus / Spotlight mode: 2-column grid ── */
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minHeight: 0 }}>
                  {/* Teacher's own tile */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '2px solid rgba(79,70,229,0.4)' }}>
                    <VideoTile
                      stream={localMedia.stream}
                      name={user?.name ?? 'Giáo viên'}
                      avatarColor={user?.avatarColor ?? '#4f46e5'}
                      avatarUrl={user?.avatarUrl ?? undefined}
                      isTeacher
                      isLocal
                      isMuted={!localMedia.isMicOn}
                      isCameraOff={!localMedia.isCameraOn}
                      borderRadius={10}
                    >
                      {screenShareOn && (
                        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 5, zIndex: 3 }}>
                          <DesktopOutlined style={{ color: '#0ea672', fontSize: 11 }} />
                          <Text style={{ color: '#fff', fontSize: 11 }}>Đang chia sẻ màn hình</Text>
                        </div>
                      )}
                    </VideoTile>
                  </div>

                  {/* Focused student tile */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #4f46e5', position: 'relative' }}>
                    <VideoTile
                      stream={rtc.peers.get(focusedStudent.studentId)?.remoteStream ?? null}
                      name={focusedStudent.name}
                      avatarColor={focusedStudent.avatarColor}
                      avatarUrl={focusedStudent.avatarUrl}
                      isCameraOff={rtc.peers.get(focusedStudent.studentId)?.isCameraOff}
                      isFocused
                      borderRadius={10}
                    >
                      <Tag
                        color="purple"
                        style={{ position: 'absolute', top: 8, right: 8, borderRadius: 20, fontWeight: 600, zIndex: 3, display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        <AimOutlined />FOCUS
                      </Tag>
                    </VideoTile>
                  </div>
                </div>
              ) : (
                /* ── Normal mode: Teacher's video fills center ── */
                <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 280 }}>
                  <VideoTile
                    stream={localMedia.stream}
                    name={user?.name ?? 'Giáo viên'}
                    avatarColor={user?.avatarColor ?? '#4f46e5'}
                    avatarUrl={user?.avatarUrl ?? undefined}
                    isTeacher
                    isLocal
                    isMuted={!localMedia.isMicOn}
                    isCameraOff={!localMedia.isCameraOn}
                    borderRadius={12}
                  >
                    {screenShareOn && (
                      <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, zIndex: 3 }}>
                        <DesktopOutlined style={{ color: '#0ea672', fontSize: 12 }} />
                        <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}>
                      <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>LIVE</Text>} />
                    </div>
                  </VideoTile>
                </div>
              )}

              {/* Student thumbnail strip */}
              <div
                className={compact ? 'no-scrollbar' : undefined}
                style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: compact ? 'nowrap' : 'wrap', overflowX: compact ? 'auto' : undefined }}
              >
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
                        style={{ width: compact ? 60 : 80, aspectRatio: '4/3', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                        onMouseEnter={() => setHoveredStudentId(p.studentId)}
                        onMouseLeave={() => setHoveredStudentId(null)}
                        onClick={() => handleFocusStudent(isFocused ? null : p.studentId)}
                      >
                        <VideoTile
                          stream={rtc.peers.get(p.studentId)?.remoteStream ?? null}
                          name={p.name}
                          avatarColor={p.avatarColor}
                          avatarUrl={p.avatarUrl}
                          isCameraOff={rtc.peers.get(p.studentId)?.isCameraOff}
                          isFocused={isFocused}
                          compact
                          borderRadius={8}
                        >
                          {(isHovered || isFocused) && (
                            <AimOutlined
                              style={{
                                position: 'absolute',
                                top: 4, left: 5,
                                color: isFocused ? '#818cf8' : 'rgba(255,255,255,0.75)',
                                fontSize: 13,
                                zIndex: 3,
                              }}
                            />
                          )}
                          {raisedHandIds.includes(p.studentId) && (
                            <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 12, zIndex: 3 }}>✋</span>
                          )}
                          {!p.isOnline && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, borderRadius: 8 }}>
                              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Offline</Text>
                            </div>
                          )}
                        </VideoTile>
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
                          timeRemaining / runningQuestion.timerSeconds > 0.5 ? '#0ea672'
                            : timeRemaining / runningQuestion.timerSeconds > 0.2 ? '#e08c0b'
                              : '#e23d6d'
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
                  className="sq-rich"
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
                          border: `1px solid ${opt.isCorrect ? '#a7e3cd' : '#e7e3dc'}`,
                          borderRadius: 8,
                          background: opt.isCorrect ? '#e7f6ef' : '#f3f1ec',
                          display: 'flex', gap: 10, alignItems: 'center',
                        }}
                      >
                        <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ minWidth: 28, textAlign: 'center' }}>
                          {opt.label}
                        </Tag>
                        <Text>{opt.text}</Text>
                        {opt.isCorrect && <CheckCircleOutlined style={{ color: '#0ea672', marginLeft: 'auto' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              {questionStats && session && (
                <Card style={{ borderRadius: 12 }}>
                  <StudentAnswersPanel
                    sessionId={session.id}
                    question={runningQuestion}
                    stats={questionStats}
                    presence={presence}
                  />
                </Card>
              )}
            </div>
          )}

          {/* ── ENDED: Results ── */}
          {viewMode === 'ended' && runningQuestion && (
            <Card style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircleOutlined style={{ color: '#0ea672', fontSize: 18 }} />
                  <Text strong style={{ fontSize: 15 }}>Kết quả câu {runningQuestion.questionOrder}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    type="primary"
                    icon={<PlusCircleOutlined />}
                    onClick={() => { setRunningQuestion(null); setQuestionStats(null); setCreateOpen(true); }}
                  >
                    Câu hỏi mới
                  </Button>
                  <Button
                    type="text"
                    icon={<CloseOutlined />}
                    onClick={() => { setRunningQuestion(null); setQuestionStats(null); }}
                    title="Đóng kết quả"
                  />
                </div>
              </div>
              <div
                className="sq-rich"
                dangerouslySetInnerHTML={{ __html: runningQuestion.content }}
                style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}
              />
              {questionStats && session && (
                <StudentAnswersPanel
                  sessionId={session.id}
                  question={runningQuestion}
                  stats={questionStats}
                  presence={presence}
                />
              )}
            </Card>
          )}

          {/* ── BREAKOUT: live video grid (joined room) + collapsible management panel ── */}
          {viewMode === 'breakout' && session && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

              {/* Live grid of the room the teacher is visiting — provides the audio sink so
                  the teacher actually HEARS the students, and shows their video. */}
              {breakout && teacherJoinedRoom && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 180 }}>
                  <div style={{ background: 'rgba(79,70,229,0.18)', border: '1px solid rgba(79,70,229,0.35)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <TeamOutlined style={{ color: '#818cf8', fontSize: 18 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ color: '#fff', fontSize: 14 }}>Bạn đang ở {teacherJoinedRoom.name}</Text>
                      {teacherJoinedRoom.task && (
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 10 }}>{teacherJoinedRoom.task}</Text>
                      )}
                    </div>
                    <Tag color="purple" style={{ borderRadius: 20, margin: 0 }}>{joinedRoomOnlineStudents.length} HS</Tag>
                    <Button size="small" type="text" style={{ color: 'rgba(255,255,255,0.75)' }} onClick={() => setBreakoutPanelCollapsed(false)}>
                      Quản lý phòng
                    </Button>
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                    {/* Teacher self */}
                    <div style={{ aspectRatio: '4/3' }}>
                      <VideoTile
                        stream={localMedia.stream}
                        name={user?.name ?? 'Giáo viên'}
                        avatarColor={user?.avatarColor ?? '#4f46e5'}
                        avatarUrl={user?.avatarUrl ?? undefined}
                        isTeacher
                        isLocal
                        isMuted={!localMedia.isMicOn}
                        isCameraOff={!localMedia.isCameraOn}
                        borderRadius={10}
                      />
                    </div>
                    {/* Room students — stream is null until their fresh PC connects, so a stale
                        connection shows the avatar placeholder instead of a frozen frame. */}
                    {joinedRoomOnlineStudents.map((s) => {
                      const peer = rtc.peers.get(s.id);
                      return (
                        <div key={s.id} style={{ aspectRatio: '4/3' }}>
                          <VideoTile
                            stream={peer?.remoteStream ?? null}
                            name={s.name}
                            avatarColor={s.avatarColor}
                            avatarUrl={s.avatarUrl}
                            isCameraOff={peer?.isCameraOff}
                            borderRadius={10}
                          >
                            {raisedHandIds.includes(s.id) && (
                              <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 16, zIndex: 3 }}>✋</span>
                            )}
                          </VideoTile>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active but not visiting any sub-room → the teacher is in the main room and
                  stays connected to the students who weren't assigned to a breakout. */}
              {breakout && !teacherJoinedRoom && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 180 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <TeamOutlined style={{ color: '#a8a29e', fontSize: 18 }} />
                    <Text strong style={{ color: '#fff', fontSize: 14, flex: 1 }}>Phòng chính</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                      Vào một phòng nhóm bên dưới để trao đổi riêng
                    </Text>
                  </div>
                  {mainRoomStudents.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.4)' }}>Tất cả học sinh đang ở trong các phòng nhóm</Text>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                      {/* Teacher self */}
                      <div style={{ aspectRatio: '4/3' }}>
                        <VideoTile
                          stream={localMedia.stream}
                          name={user?.name ?? 'Giáo viên'}
                          avatarColor={user?.avatarColor ?? '#4f46e5'}
                          avatarUrl={user?.avatarUrl ?? undefined}
                          isTeacher
                          isLocal
                          isMuted={!localMedia.isMicOn}
                          isCameraOff={!localMedia.isCameraOn}
                          borderRadius={10}
                        />
                      </div>
                      {mainRoomStudents.map((p) => {
                        const peer = rtc.peers.get(p.studentId);
                        return (
                          <div key={p.studentId} style={{ aspectRatio: '4/3' }}>
                            <VideoTile
                              stream={peer?.remoteStream ?? null}
                              name={p.name}
                              avatarColor={p.avatarColor}
                              avatarUrl={p.avatarUrl}
                              isCameraOff={peer?.isCameraOff}
                              borderRadius={10}
                            >
                              {raisedHandIds.includes(p.studentId) && (
                                <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 16, zIndex: 3 }}>✋</span>
                              )}
                            </VideoTile>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Management panel — collapsible while a breakout is active. Kept mounted
                  (hidden, not unmounted) so its internal room selection survives collapse. */}
              <Card style={{ borderRadius: 12, flexShrink: 0 }} styles={{ body: { padding: 0 } }}>
                {breakout && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: breakoutPanelCollapsed ? 'none' : '1px solid #e7e3dc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Badge status="processing" />
                      <Text strong>Bảng điều khiển breakout</Text>
                      {teacherJoinedRoom && (
                        <Tag color="purple" style={{ borderRadius: 20, margin: 0 }}>Đang ở {teacherJoinedRoom.name}</Tag>
                      )}
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={breakoutPanelCollapsed ? <DownOutlined /> : <UpOutlined />}
                      onClick={() => setBreakoutPanelCollapsed((v) => !v)}
                    >
                      {breakoutPanelCollapsed ? 'Mở rộng' : 'Thu gọn để xem học sinh'}
                    </Button>
                  </div>
                )}
                <div style={{ display: breakout && breakoutPanelCollapsed ? 'none' : 'block', padding: '16px 24px' }}>
                  <BreakoutPanel
                    sessionId={session.id}
                    breakout={breakout}
                    presence={presence}
                    teacherRoomId={teacherJoinedRoomId}
                    onClose={() => { setShowBreakoutPanel(false); setBreakout(null); setTeacherJoinedRoomId(null); setBreakoutPanelCollapsed(false); }}
                    onSyncActive={async () => {
                      const bRes = await breakoutService.getActive(session.id);
                      if (bRes.data) setBreakout(bRes.data);
                    }}
                    // Entering a room: drop every PC so the room students' fresh offers
                    // (sent on teacher_joined_room) rebuild clean connections, and so the
                    // teacher's audio no longer leaks to students outside this room. Then
                    // reveal the live grid by collapsing the panel.
                    onTeacherJoinRoom={(roomId) => {
                      rtc.closeAllPeers();
                      setTeacherJoinedRoomId(roomId);
                      setBreakoutPanelCollapsed(true);
                    }}
                    onTeacherLeaveRoom={() => {
                      rtc.closeAllPeers();
                      setTeacherJoinedRoomId(null);
                      setBreakoutPanelCollapsed(false);
                    }}
                  />
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT: Quick actions panel */}
        {showQuickActions && (
          <div
            className={compact ? 'sq-panel-overlay-right' : undefined}
            style={{ ...panelStyle, ...overlayBase, right: compact ? 0 : undefined, width: 200, padding: 14, gap: 10, overflowY: 'auto' }}
          >
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
                    background: runningQuestion?.id === q.id ? '#eceafd' : '#f3f1ec',
                    border: `1px solid ${runningQuestion?.id === q.id ? '#c7d2fe' : '#e7e3dc'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#57534e', minWidth: 16 }}>{q.questionOrder}.</Text>
                  <Text style={{ fontSize: 12 }} ellipsis>
                    {q.type === 'single' ? '●' : q.type === 'multiple' ? '☑' : '✏'} Câu {q.questionOrder}
                  </Text>
                  {q.status === 'ended' && (
                    <CheckCircleOutlined style={{ color: '#0ea672', fontSize: 11, marginLeft: 'auto' }} />
                  )}
                </div>
              ))}
            </div>

            <Divider style={{ margin: '2px 0' }} />

            <Button
              size="small"
              block
              icon={<BarChartOutlined />}
              onClick={() => setShowResultsDrawer(true)}
              disabled={questions.filter((q) => q.status === 'ended').length === 0}
            >
              Xem kết quả phiên
            </Button>
          </div>
        )}

        {/* CHAT panel */}
        {showChat && (
          <div
            className={compact ? 'sq-panel-overlay-right' : undefined}
            style={{ ...panelStyle, ...overlayBase, right: compact ? 0 : undefined, width: compact ? Math.min(300, window.innerWidth - 20) : 280 }}
          >
            <ChatPanel
              messages={chatMessages}
              currentUser={{
                id: user?.id ?? '__teacher__',
                name: user?.name ?? 'Giáo viên',
                avatarColor: user?.avatarColor ?? '#4f46e5',
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
        className="no-scrollbar"
        style={{
          height: 60,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'flex-start' : 'center',
          gap: 10,
          flexShrink: 0,
          padding: '0 20px',
          overflowX: 'auto',
        }}
      >
        <CtrlBtn
          active={!localMedia.isMicOn}
          danger={!localMedia.isMicOn}
          onClick={localMedia.toggleMic}
          title={localMedia.isMicOn ? 'Tắt mic' : 'Bật mic'}
          icon={localMedia.isMicOn ? <AudioOutlined /> : <AudioMutedOutlined />}
        />
        <CtrlBtn
          active={!localMedia.isCameraOn}
          danger={!localMedia.isCameraOn}
          onClick={handleToggleCamera}
          title={localMedia.isCameraOn ? 'Tắt camera' : 'Bật camera'}
          icon={<VideoCameraOutlined />}
        />
        <CtrlBtn
          active={screenShareOn}
          onClick={() => { void handleToggleScreenShare(); }}
          title={screenShareOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
          icon={<DesktopOutlined />}
        />

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <CtrlBtn
          active={showStudentList}
          onClick={toggleStudentList}
          title={showStudentList ? 'Ẩn danh sách HS' : 'Hiện danh sách HS'}
          icon={<TeamOutlined />}
        />
        <CtrlBtn
          active={showQuickActions}
          onClick={toggleQuickActions}
          title={showQuickActions ? 'Ẩn hành động nhanh' : 'Hiện hành động nhanh'}
          icon={<PlusCircleOutlined />}
        />
        <Tooltip title="Chat">
          <Badge count={showChat ? 0 : unreadChat} size="small" overflowCount={99}>
            <Button
              shape="circle"
              type={showChat ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              style={!showChat ? { background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' } : {}}
              onClick={toggleChat}
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

      {compact && (showStudentList || showQuickActions || showChat) && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98 }}
          onClick={() => { setShowStudentList(false); setShowQuickActions(false); setShowChat(false); }}
        />
      )}

      {/* ─── Session Results Drawer ─── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChartOutlined style={{ color: '#4f46e5' }} />
            <span>Kết quả phiên học</span>
          </div>
        }
        open={showResultsDrawer}
        onClose={() => setShowResultsDrawer(false)}
        width={500}
        placement="right"
        mask={false}
      >
        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#57534e', padding: 40 }}>
            Chưa có câu hỏi nào trong phiên này.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: '#eceafd', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <Text strong style={{ fontSize: 22, color: '#4f46e5' }}>
                  {questions.filter((q) => q.status === 'ended').length}
                </Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>Câu đã kết thúc</Text></div>
              </div>
              <div style={{ flex: 1, background: '#e7f6ef', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <Text strong style={{ fontSize: 22, color: '#0ea672' }}>
                  {presence.filter((p) => p.isOnline).length}
                </Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>Học sinh online</Text></div>
              </div>
            </div>
            <Collapse
              accordion
              items={questions.map((q) => {
                const stats = (q.id === runningQuestion?.id && questionStats)
                  ? questionStats
                  : allQuestionStats.get(q.id);
                const isRunning = q.status === 'running';
                const typeLabel = q.type === 'single' ? 'Trắc nghiệm 1 đáp án'
                  : q.type === 'multiple' ? 'Nhiều đáp án' : 'Tự luận';
                return {
                  key: q.id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 13, minWidth: 28 }}>
                        {q.questionOrder > 0 ? `Câu ${q.questionOrder}` : 'Câu'}
                      </Text>
                      <Tag style={{ fontSize: 11, margin: 0, padding: '0 6px' }}>{typeLabel}</Tag>
                      {isRunning && (
                        <Tag color="blue" style={{ fontSize: 11, padding: '0 5px', margin: 0 }}>Đang chạy</Tag>
                      )}
                      {q.status === 'ended' && stats && (
                        <Tag color="green" style={{ fontSize: 11, padding: '0 5px', margin: 0 }}>
                          {stats.answeredCount}/{stats.totalStudents} trả lời
                        </Tag>
                      )}
                    </div>
                  ),
                  children: (
                    <div>
                      {/* Question content */}
                      <div
                        className="sq-rich"
                        dangerouslySetInnerHTML={{ __html: q.content }}
                        style={{
                          fontSize: 14, fontWeight: 500, lineHeight: 1.6, marginBottom: 12,
                          padding: '10px 12px', background: '#f3f1ec', borderRadius: 8,
                          border: '1px solid #e7e3dc',
                        }}
                      />
                      {/* Options (MCQ) */}
                      {q.options && q.options.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              style={{
                                display: 'flex', gap: 8, alignItems: 'center',
                                padding: '6px 10px', borderRadius: 6,
                                background: opt.isCorrect ? '#e7f6ef' : '#f3f1ec',
                                border: `1px solid ${opt.isCorrect ? '#a7e3cd' : '#e7e3dc'}`,
                              }}
                            >
                              <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ minWidth: 24, textAlign: 'center', margin: 0, fontSize: 11 }}>
                                {opt.label}
                              </Tag>
                              <Text style={{ fontSize: 13 }}>{opt.text}</Text>
                              {opt.isCorrect && <CheckCircleOutlined style={{ color: '#0ea672', marginLeft: 'auto', fontSize: 13 }} />}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Stats + per-student answers */}
                      {stats && session ? (
                        <StudentAnswersPanel
                          sessionId={session.id}
                          question={q}
                          stats={stats}
                          presence={presence}
                        />
                      ) : (
                        <div style={{ color: '#57534e', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                          {q.status === 'draft' ? 'Câu hỏi chưa bắt đầu' : 'Đang tải kết quả...'}
                        </div>
                      )}
                    </div>
                  ),
                };
              })}
            />
          </>
        )}
      </Drawer>

      {/* Modals */}
      <CreateQuestionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateQuestion}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: '#e08c0b', fontSize: 18 }} />
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
          <p style={{ marginBottom: 12, color: '#57534e' }}>
            Buổi học sẽ kết thúc và tất cả học sinh sẽ nhận được kết quả.
          </p>
          <div style={{ background: '#f3f1ec', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 24 }}>
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
