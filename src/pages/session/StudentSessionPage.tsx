import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Avatar, Badge, Button, Checkbox, Modal, Progress, Radio,
  Spin, Tag, Tooltip, Typography, Alert,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  SendOutlined, MessageOutlined, AudioOutlined, AudioMutedOutlined,
  VideoCameraOutlined, MinusOutlined, ExpandAltOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined, DesktopOutlined, CompressOutlined, AimOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import sessionService from '../../services/session.service';
import questionService from '../../services/question.service';
import answerService from '../../services/answer.service';
import breakoutService from '../../services/breakout.service';
import chatService from '../../services/chat.service';
import { createSessionWsClient } from '../../lib/websocket';
import type { SessionWsClient, WsEvent } from '../../lib/websocket';
import ConfidenceSelector from '../../components/session/ConfidenceSelector';
import ChatPanel from '../../components/session/ChatPanel';
import type { ChatMessage } from '../../components/session/ChatPanel';
import StudentStatusList from '../../components/session/StudentStatusList';
import CtrlBtn from '../../components/session/CtrlBtn';
import RichTextEditor from '../../components/session/RichTextEditor';
import VideoTile from '../../components/session/VideoTile';
import { useLocalMedia } from '../../hooks/useLocalMedia';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type {
  JoinSessionResponse, PresenceDto, QuestionDto,
  ChatMessageDto, RoomDto, ConfidenceLevel, QuestionType,
} from '../../types/api';

const { Text, Title } = Typography;

function dtoToChat(dto: ChatMessageDto): ChatMessage {
  const d = new Date(dto.sentAt);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    id: dto.id,
    senderId: dto.sender.id,
    senderName: dto.sender.name,
    avatarColor: dto.sender.avatarColor ?? '#4f46e5',
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
  const { compact } = useBreakpoint();

  const [loading, setLoading] = useState(true);
  const [joinInfo, setJoinInfo] = useState<JoinSessionResponse | null>(null);

  const [presence, setPresence] = useState<PresenceDto[]>([]);
  const [raisedHandIds, setRaisedHandIds] = useState<string[]>([]);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);

  const [runningQuestion, setRunningQuestion] = useState<QuestionDto | null>(null);
  const [questionSubmitted, setQuestionSubmitted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [essayText, setEssayText] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);

  const [myRoom, setMyRoom] = useState<RoomDto | null>(null);
  // Students assigned to ANY breakout sub-room. For a main-room student these are the
  // peers who left to another room — excluded from the main grid and their PC closed so
  // their tile shows a placeholder instead of a frozen last frame.
  const [breakoutMemberIds, setBreakoutMemberIds] = useState<string[]>([]);
  const [teacherInRoom, setTeacherInRoom] = useState(false);
  // For a main-room student: true while the teacher is visiting a sub-room (so the teacher
  // tile shows an "in breakout room" placeholder instead of a frozen frame).
  const [teacherAway, setTeacherAway] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // Số tin nhắn chưa đọc — reset về 0 khi mở chat
  const [unreadChat, setUnreadChat] = useState(0);

  const [screenShareOn, setScreenShareOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // Ref đồng bộ showChat để WS handler đọc giá trị mới nhất (tránh stale closure)
  const showChatRef = useRef(showChat);
  useEffect(() => { showChatRef.current = showChat; }, [showChat]);
  const [showParticipants, setShowParticipants] = useState(() => window.innerWidth >= 640);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);

  const [now, setNow] = useState(Date.now());

  const wsRef = useRef<SessionWsClient | null>(null);
  const submitFnRef = useRef<(() => void) | null>(null);
  const teacherIdRef = useRef<string | null>(null);
  const presenceRef = useRef<PresenceDto[]>([]);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  // Latest sub-room id (null = I'm in the main room) for the WS handler closure to read.
  const myRoomIdRef = useRef<string | null>(null);

  useEffect(() => { presenceRef.current = presence; }, [presence]);
  useEffect(() => { myRoomIdRef.current = myRoom?.id ?? null; }, [myRoom]);

  // ── WebRTC hooks ────────────────────────────────────────────────────
  const localMedia = useLocalMedia();
  const rtc = useWebRTC(me?.id ?? '', wsRef, localMedia.streamRef);

  // Clock tick for countdown
  useEffect(() => {
    const tid = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tid);
  }, []);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const sessionsRes = await sessionService.listByClassroom(id!);
        if (cancelled) return;
        const active = sessionsRes.data?.find((s) => s.status === 'active');
        if (!active) { setLoading(false); return; }

        const joinRes = await sessionService.join(active.id);
        if (cancelled) return;
        if (!joinRes.data) { setLoading(false); return; }
        const info = joinRes.data;
        setJoinInfo(info);
        // Teacher ID is included in join response — set immediately so onConnected can call teacher.
        teacherIdRef.current = info.teacherId;

        const [presenceRes, chatHistRes, questionsRes] = await Promise.all([
          sessionService.getPresence(info.sessionId),
          chatService.getHistory(info.sessionId, 50),
          questionService.list(info.sessionId),
        ]);
        if (cancelled) return;

        const loadedPresence = (presenceRes.data ?? []).filter((p) => p.isOnline);
        if (loadedPresence.length > 0) setPresence(loadedPresence);
        presenceRef.current = loadedPresence;
        if (chatHistRes.data) setChatMessages(chatHistRes.data.map(dtoToChat));
        const runningQ = questionsRes.data?.find((q) => q.status === 'running');
        if (runningQ) { setRunningQuestion(runningQ); setQuestionPanelOpen(true); }

        setLoading(false);

        // Start camera/mic BEFORE connecting WS so localStreamRef is ready when
        // teacher's offer arrives and the PeerConnection is created.
        if (!localMedia.streamRef.current) {
          await localMedia.startMedia(true, true);
        }
        if (cancelled) return;

        function handleEvent(event: WsEvent) {
          switch (event.type) {
            case 'student_presence': {
              const payload = event.payload as { studentId: string; name: string; avatarColor?: string; action: 'joined' | 'left' };
              if (payload.action === 'left') {
                rtc.closePeer(payload.studentId);
                setPresence((prev) => {
                  const updated = prev.filter((x) => x.studentId !== payload.studentId);
                  presenceRef.current = updated;
                  return updated;
                });
              } else {
                // Polite peer: lower ID initiates student-to-student connection
                if (payload.studentId !== me?.id && (me?.id ?? '') < payload.studentId) {
                  void rtc.callPeer(payload.studentId);
                }
                // Optimistically mark online with whatever the WS payload has
                setPresence((prev) => {
                  if (prev.some((x) => x.studentId === payload.studentId)) {
                    return prev.map((x) => x.studentId === payload.studentId ? { ...x, isOnline: true } : x);
                  }
                  return [...prev, { studentId: payload.studentId, name: payload.name ?? 'Học sinh', avatarColor: payload.avatarColor, isOnline: true, joinedAt: new Date().toISOString() }];
                });
                // Refresh profile data from API; also add any students not yet in state.
                void sessionService.getPresence(info.sessionId).then((res) => {
                  if (res.data) {
                    const profileMap = new Map(res.data.map((ap) => [ap.studentId, ap]));
                    setPresence((prev) => {
                      const existingIds = new Set(prev.map((e) => e.studentId));
                      const updated = prev.map((entry) => {
                        const profile = profileMap.get(entry.studentId);
                        return profile
                          ? { ...entry, name: profile.name ?? entry.name, avatarColor: profile.avatarColor ?? entry.avatarColor }
                          : entry;
                      });
                      // Add online students from API not yet in local state (except self)
                      const newEntries = res.data!.filter(
                        (ap) => ap.isOnline && !existingIds.has(ap.studentId) && ap.studentId !== me?.id,
                      );
                      const merged = [...updated, ...newEntries];
                      presenceRef.current = merged;
                      return merged;
                    });
                  }
                });
              }
              break;
            }
            case 'session_ended': {
              const { sessionId: endedSessionId } = event.payload as { sessionId?: string };
              wsRef.current?.disconnect();
              wsRef.current = null;
              rtc.closeAllPeers();
              localMedia.stopMedia();
              navigate(`/review/${endedSessionId ?? info.sessionId}`);
              break;
            }
            case 'question_started': {
              // Backend payload: { questionId, type, content, options[{id,label,text,isCorrect,order}], endsAt }
              // NOT a QuestionDto — must map fields manually
              const raw = event.payload as {
                questionId: string; type: QuestionType; content: string;
                options?: { id: string; label: string; text: string; isCorrect: boolean; order: number }[];
                endsAt?: string;
              };
              const estimatedTimer = raw.endsAt
                ? Math.round((new Date(raw.endsAt).getTime() - Date.now()) / 1000)
                : 0;
              const q: QuestionDto = {
                id: raw.questionId,
                questionOrder: 0,
                type: raw.type,
                content: raw.content,
                status: 'running',
                createdAt: new Date().toISOString(),
                timerSeconds: estimatedTimer > 0 ? estimatedTimer : undefined,
                options: (raw.options ?? []).map((o) => ({
                  id: o.id, label: o.label, text: o.text, isCorrect: o.isCorrect, optionOrder: o.order,
                })),
                endsAt: raw.endsAt,
              };
              setRunningQuestion(q);
              setQuestionSubmitted(false);
              setSelectedOptions([]);
              setEssayText('');
              setConfidence(null);
              setQuestionPanelOpen(true);
              setShowNewQuestionModal(true);
              break;
            }
            case 'question_ended': {
              // Backend payload: { questionId }
              const ended = event.payload as { questionId: string };
              setRunningQuestion((prev) => (prev?.id === ended.questionId ? { ...prev, status: 'ended' } : prev));
              break;
            }
            case 'raise_hand_changed': {
              const { studentId, raised } = event.payload as { studentId: string; raised: boolean };
              setRaisedHandIds((prev) =>
                raised
                  ? [...prev.filter((sid) => sid !== studentId), studentId]
                  : prev.filter((sid) => sid !== studentId),
              );
              break;
            }
            case 'focus_changed': {
              const { focusedStudentId: fid } = event.payload as { focusedStudentId: string | null };
              setFocusedStudentId(fid);
              break;
            }
            case 'breakout_started': {
              // WS payload chỉ có studentIds (không có name/avatarColor) → fetch full DTO từ REST
              void breakoutService.getActive(info.sessionId).then((res) => {
                if (cancelled || !res.data) return;
                const bo = res.data;
                const assignedIds = bo.rooms.flatMap((r) => r.students.map((s) => s.id));
                setBreakoutMemberIds(assignedIds);
                const room = bo.rooms.find((r) => r.students.some((s) => s.id === me?.id));
                setMyRoom(room ?? null);
                myRoomIdRef.current = room?.id ?? null;
                if (room) {
                  // Assigned to a sub-room → talk only to roommates. The teacher is still in
                  // the main room at this point, so we are not connected to them yet.
                  wsRef.current?.subscribeRoom(room.id, handleEvent);
                  rtc.closeAllPeers();
                  const myId = me?.id ?? '';
                  const roommates = room.students.filter((s) => s.id !== myId);
                  setTimeout(() => {
                    roommates.forEach((s) => {
                      if (myId < s.id) void rtc.callPeer(s.id);
                    });
                  }, 500);
                } else {
                  // Staying in the main room → the students who moved into sub-rooms have
                  // closed their side of our PC. Close ours too so their tile drops the
                  // frozen last frame and falls back to an avatar placeholder. The teacher
                  // starts in the main room, so our teacher connection stays live.
                  setTeacherAway(false);
                  assignedIds.forEach((sid) => rtc.closePeer(sid));
                }
              });
              break;
            }
            case 'breakout_ended': {
              setTeacherInRoom(false);
              setTeacherAway(false);
              setBreakoutMemberIds([]);
              myRoomIdRef.current = null;
              setMyRoom((prev) => {
                if (prev) wsRef.current?.unsubscribeRoom(prev.id);
                return null;
              });
              // Close breakout connections; teacher will re-initiate to us
              rtc.closeAllPeers();
              void (async () => {
                // Polite peer: lower ID initiates student-to-student reconnect
                for (const p of presenceRef.current) {
                  if (p.isOnline && p.studentId !== me?.id && (me?.id ?? '') < p.studentId) {
                    await rtc.callPeer(p.studentId);
                  }
                }
              })();
              break;
            }
            case 'broadcast_message': {
              const { content } = event.payload as { content: string };
              setBroadcastMsg(content);
              break;
            }
            case 'chat_message':
              setChatMessages((prev) => [...prev, dtoToChat(event.payload as ChatMessageDto)]);
              // Chat đang đóng → tăng số tin chưa đọc
              if (!showChatRef.current) setUnreadChat((n) => n + 1);
              break;
            case 'camera_state_changed': {
              const { fromId, isCameraOff } = event.payload as { fromId: string; isCameraOff: boolean };
              rtc.updatePeerCameraState(fromId, isCameraOff);
              break;
            }
            case 'teacher_joined_room': {
              // Session-wide: `roomId` is the teacher's current sub-room. Connect only if it
              // is MY room; otherwise drop the teacher PC (main-room or other-room students).
              const { roomId } = event.payload as { roomId: string };
              const withMe = roomId === myRoomIdRef.current;
              setTeacherInRoom(withMe);
              setTeacherAway(myRoomIdRef.current === null);
              if (withMe) {
                setBroadcastMsg('Giáo viên đã vào phòng');
                if (teacherIdRef.current) void rtc.callPeer(teacherIdRef.current);
              } else if (teacherIdRef.current) {
                // Teacher is elsewhere → close so the tile shows a placeholder, not a frozen frame.
                rtc.closePeer(teacherIdRef.current);
              }
              break;
            }
            case 'teacher_left_room': {
              // Session-wide: the teacher returned to the main room.
              setTeacherInRoom(false);
              if (myRoomIdRef.current === null) {
                // I'm in the main room → the teacher is back with me, reconnect.
                setTeacherAway(false);
                setBroadcastMsg('Giáo viên đã quay lại phòng chính');
                if (teacherIdRef.current) void rtc.callPeer(teacherIdRef.current);
              } else if (teacherIdRef.current) {
                // I'm in a sub-room → the teacher is no longer here.
                rtc.closePeer(teacherIdRef.current);
              }
              break;
            }
            case 'webrtc_offer': {
              const raw = event.payload as Record<string, unknown>;
              const fromId = raw.fromId as string;
              console.log('[RTC-WS] webrtc_offer keys:', Object.keys(raw), '| fromId:', fromId);
              // Auto-detect teacher ID: offer sender who is not in student presence list
              if (fromId && fromId !== me?.id && !presenceRef.current.some((p) => p.studentId === fromId)) {
                teacherIdRef.current = fromId;
              }
              void rtc.handleOffer(fromId, raw.sdp as string);
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
          info.wsTicket,
          info.sessionId,
          async () => {
            try {
              return (await sessionService.join(info.sessionId)).data!.wsTicket;
            } catch (err) {
              // Session kết thúc → redirect sang review thay vì retry vô hạn
              const code = (err as { response?: { data?: { error?: { code?: string } } } })
                ?.response?.data?.error?.code;
              if (code === 'SESSION_NOT_ACTIVE' || code === 'SESSION_ENDED' || code === 'SESSION_NOT_FOUND') {
                wsRef.current?.disconnect();
                wsRef.current = null;
                rtc.closeAllPeers();
                localMedia.stopMedia();
                navigate(`/review/${info.sessionId}`);
              }
              throw err;
            }
          },
          async () => {
            if (cancelled) return;
            // Refresh presence — students who joined before us may not be in state yet
            // if their student_presence event fired before our WS subscription was active.
            try {
              const freshRes = await sessionService.getPresence(info.sessionId);
              if (!cancelled && freshRes.data) {
                const online = freshRes.data.filter((p) => p.isOnline);
                setPresence(online);
                presenceRef.current = online;
              }
            } catch { /* ignore — use existing presence */ }
            if (cancelled) return;
            // Call Teacher. The backend broadcasts student_presence as soon as the REST join
            // completes, BEFORE our WS subscription is ready. Teacher's offer was already
            // sent and dropped. We initiate here so Teacher can do glare resolution.
            if (teacherIdRef.current) {
              await rtc.callPeer(teacherIdRef.current);
            }
            // Call ALL online students regardless of polite-peer ID order.
            // Students who joined before us tried to call us when we weren't subscribed yet.
            // We call them now; if they have a stale have-local-offer PC they will rollback
            // and handle our offer via glare resolution.
            for (const p of presenceRef.current) {
              if (p.isOnline && p.studentId !== me?.id) {
                await rtc.callPeer(p.studentId);
              }
            }
          },
        );
        ws.subscribe(handleEvent);
        wsRef.current = ws;
      } catch {
        if (!cancelled) setLoading(false);
      }
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
  const myAvatarColor = me?.avatarColor ?? '#4f46e5';
  const iAmFocused = focusedStudentId === me?.id;

  const teacherPeer = teacherIdRef.current ? rtc.peers.get(teacherIdRef.current) : undefined;

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

  useEffect(() => { submitFnRef.current = handleSubmit; }, [handleSubmit]);

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
    wsRef.current?.sendRaiseHand(!myRaisedHand);
  };

  const handleSendChat = (text: string) => {
    wsRef.current?.sendChat(text, myRoom?.id ?? null);
  };

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

  const handleLeave = async () => {
    // Disconnect WS first — sets deactivating=true so onWebSocketClose
    // cannot trigger auto-rejoin if the backend closes the socket during leave()
    wsRef.current?.disconnect();
    wsRef.current = null;
    rtc.closeAllPeers();
    localMedia.stopMedia();
    if (joinInfo) {
      try { await sessionService.leave(joinInfo.sessionId); } catch { /* ignore */ }
    }
    navigate(`/review/${joinInfo?.sessionId}`);
  };

  // ── Participant list ───────────────────────────────────────────────
  // Always include self from authStore — getPresence may not return the current student's own entry
  const participants = [
    { id: 'teacher', name: joinInfo?.teacherName ?? 'Giáo viên', isTeacher: true as const, isOnline: true },
    ...(me ? [{ id: me.id, name: me.name ?? 'Học sinh', avatarColor: me.avatarColor ?? '#4f46e5', isOnline: true }] : []),
    ...presence
      .filter((p) => p.isOnline && p.studentId !== me?.id)
      .map((p) => ({
        id: p.studentId,
        name: p.name ?? 'Học sinh',
        avatarColor: p.avatarColor,
        isOnline: true,
      })),
  ];

  // ── Panel styles ──────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 10, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
    boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
  };

  const overlayBase: React.CSSProperties = compact
    ? { position: 'fixed', top: 52, bottom: 60, zIndex: 100 }
    : {};

  function toggleParticipants() {
    if (compact) setShowChat(false);
    setShowParticipants((v) => !v);
  }
  function toggleChat() {
    if (compact) setShowParticipants(false);
    if (!showChat) setUnreadChat(0); // mở chat → coi như đã đọc
    setShowChat((v) => !v);
  }

  const questionPanelStyle: React.CSSProperties = panelExpanded
    ? { position: 'absolute', inset: 0, width: '100%', maxHeight: '100%', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50 }
    : compact
      ? { position: 'fixed', left: 0, right: 0, bottom: 60, top: 52, background: '#fff', borderRadius: 0, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 101 }
      : { position: 'absolute', right: showChat ? 316 : 0, bottom: 0, width: 360, maxHeight: 'calc(100% - 10px)', background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 50 };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1b3a', gap: 16 }}>
        <Spin size="large" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Đang tham gia buổi học...</Text>
      </div>
    );
  }

  if (!joinInfo) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e1b3a', gap: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>Không có buổi học đang diễn ra.</Text>
        <Button onClick={() => navigate('/classes')}>Về trang chủ</Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1b3a', overflow: 'hidden' }}>

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
          {!isBreakout && breakoutMemberIds.length > 0 && (
            <Tag color="geekblue" icon={<TeamOutlined />} style={{ borderRadius: 20, fontSize: 11 }}>
              {breakoutMemberIds.length} bạn đang ở phòng nhóm
            </Tag>
          )}
          {focusedStudentId && (
            <Tag color="purple" icon={<AimOutlined />} style={{ borderRadius: 20, fontSize: 11 }}>
              {iAmFocused
                ? 'Bạn đang được focus'
                : `Focus: ${presence.find((p) => p.studentId === focusedStudentId)?.name?.split(' ').pop() ?? 'Học sinh'}`}
            </Tag>
          )}
          {runningQuestion && !questionPanelOpen && (
            <Button size="small" type="primary" style={{ background: '#4f46e5', borderColor: '#4f46e5', fontSize: 12 }} onClick={() => setQuestionPanelOpen(true)}>
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
          <div
            className={compact ? 'sq-panel-overlay' : undefined}
            style={{ ...panelStyle, ...overlayBase, left: compact ? 0 : undefined, width: 200 }}
          >
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

          {/* ── Idle / Question: Teacher video + student strip ── */}
          {!isBreakout && (
            <>
              {focusedStudentId ? (
                /* ── Focus / Spotlight mode: 2-column grid teacher | focused student ── */
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minHeight: 0 }}>
                  {/* Teacher tile */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '2px solid rgba(79,70,229,0.4)' }}>
                    <VideoTile
                      stream={teacherPeer?.remoteStream ?? null}
                      name={joinInfo.teacherName}
                      avatarColor="#4f46e5"
                      isTeacher
                      isCameraOff={teacherPeer?.isCameraOff}
                      borderRadius={10}
                    >
                      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}>
                        <Badge status={teacherPeer?.state === 'connected' ? 'processing' : 'default'} text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>LIVE</Text>} />
                      </div>
                    </VideoTile>
                  </div>

                  {/* Focused student tile */}
                  <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #4f46e5', position: 'relative' }}>
                    <VideoTile
                      stream={focusedStudentId === me?.id ? localMedia.stream : (rtc.peers.get(focusedStudentId)?.remoteStream ?? null)}
                      name={focusedStudentId === me?.id ? (me?.name ?? 'Bạn') : (presence.find((p) => p.studentId === focusedStudentId)?.name ?? 'Học sinh')}
                      avatarColor={focusedStudentId === me?.id ? myAvatarColor : presence.find((p) => p.studentId === focusedStudentId)?.avatarColor}
                      isLocal={focusedStudentId === me?.id}
                      isMuted={focusedStudentId === me?.id ? !localMedia.isMicOn : undefined}
                      isCameraOff={focusedStudentId === me?.id ? !localMedia.isCameraOn : rtc.peers.get(focusedStudentId)?.isCameraOff}
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
                /* ── Normal mode: Teacher's video fills main area ── */
                <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                  <VideoTile
                    stream={teacherPeer?.remoteStream ?? null}
                    name={joinInfo.teacherName}
                    avatarColor="#4f46e5"
                    isTeacher
                    isCameraOff={teacherPeer?.isCameraOff}
                    borderRadius={12}
                  >
                    {screenShareOn && (
                      <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, zIndex: 3 }}>
                        <DesktopOutlined style={{ color: '#0ea672', fontSize: 12 }} />
                        <Text style={{ color: '#fff', fontSize: 12 }}>Đang chia sẻ màn hình</Text>
                      </div>
                    )}
                    {teacherAway && (
                      <div style={{ position: 'absolute', top: 10, left: 12, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, zIndex: 3 }}>
                        <TeamOutlined style={{ color: '#a5b4fc', fontSize: 12 }} />
                        <Text style={{ color: '#fff', fontSize: 12 }}>Giáo viên đang ở phòng nhóm</Text>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}>
                      <Badge status={teacherPeer?.state === 'connected' ? 'processing' : 'default'} text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>LIVE</Text>} />
                    </div>
                  </VideoTile>
                </div>
              )}

              {/* Bottom strip: own tile + other connected students */}
              <div className={compact ? 'no-scrollbar' : undefined} style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: compact ? 'nowrap' : 'wrap', overflowX: compact ? 'auto' : undefined }}>
                {/* My tile */}
                <div style={{ width: compact ? 80 : 120, aspectRatio: '4/3', flexShrink: 0 }}>
                  <VideoTile
                    stream={localMedia.stream}
                    name={me?.name ?? 'Bạn'}
                    avatarColor={myAvatarColor}
                    isLocal
                    isMuted={!localMedia.isMicOn}
                    isCameraOff={!localMedia.isCameraOn}
                    isFocused={iAmFocused}
                    compact
                    borderRadius={8}
                  >
                    {myRaisedHand && (
                      <span style={{ position: 'absolute', top: 4, right: 4, fontSize: 14, zIndex: 3 }}>✋</span>
                    )}
                  </VideoTile>
                </div>

                {/* Other online students — hide those who moved into a breakout sub-room */}
                {presence
                  .filter((p) => p.studentId !== me?.id && p.isOnline && !breakoutMemberIds.includes(p.studentId))
                  .slice(0, 5)
                  .map((p) => {
                    const peer = rtc.peers.get(p.studentId);
                    return (
                      <div key={p.studentId} style={{ width: compact ? 80 : 120, aspectRatio: '4/3', flexShrink: 0 }}>
                        <VideoTile
                          stream={peer?.remoteStream ?? null}
                          name={p.name}
                          avatarColor={p.avatarColor}
                          isCameraOff={peer?.isCameraOff}
                          isFocused={focusedStudentId === p.studentId}
                          compact
                          borderRadius={8}
                        />
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* ── Breakout: group member grid ── */}
          {isBreakout && myRoom && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <div style={{ background: '#4f46e522', border: '1px solid #4f46e544', borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <TeamOutlined style={{ color: '#4f46e5', fontSize: 16 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ color: '#a5b4fc', fontSize: 13 }}>{myRoom.name}</Text>
                  {myRoom.task && (
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 10 }}>{myRoom.task}</Text>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                {/* Teacher tile — shown when teacher has joined this room */}
                {teacherInRoom && (
                  <div style={{ aspectRatio: '4/3', position: 'relative' }}>
                    <VideoTile
                      stream={teacherPeer?.remoteStream ?? null}
                      name={joinInfo.teacherName}
                      avatarColor="#4f46e5"
                      isTeacher
                      isCameraOff={teacherPeer?.isCameraOff}
                      borderRadius={10}
                    >
                      <div style={{ position: 'absolute', top: 6, left: 8, background: 'rgba(79,70,229,0.85)', borderRadius: 4, padding: '1px 8px', zIndex: 3 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 600 }}>GV</Text>
                      </div>
                    </VideoTile>
                  </div>
                )}
                {myRoom.students.map((s) => {
                  const isSelf = s.id === me?.id;
                  const peer = rtc.peers.get(s.id);
                  return (
                    <div key={s.id} style={{ aspectRatio: '4/3' }}>
                      <VideoTile
                        stream={isSelf ? localMedia.stream : (peer?.remoteStream ?? null)}
                        name={s.name}
                        avatarColor={s.avatarColor}
                        isLocal={isSelf}
                        isMuted={isSelf && !localMedia.isMicOn}
                        isCameraOff={isSelf ? !localMedia.isCameraOn : peer?.isCameraOff}
                        isSelf={isSelf}
                        borderRadius={10}
                      >
                        {isSelf && myRaisedHand && (
                          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 16, zIndex: 3 }}>✋</span>
                        )}
                        {isSelf && screenShareOn && (
                          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(82,196,26,0.85)', borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 4, zIndex: 3 }}>
                            <DesktopOutlined style={{ color: '#fff', fontSize: 11 }} />
                            <Text style={{ color: '#fff', fontSize: 10 }}>Đang chia sẻ</Text>
                          </div>
                        )}
                      </VideoTile>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Floating question panel ── */}
          {runningQuestion && questionPanelOpen && (
            <div className={compact ? 'sq-panel-overlay-up' : undefined} style={questionPanelStyle}>
              {/* Header */}
              <div style={{ padding: '10px 14px', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
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
                          style={{ padding: '10px 12px', border: `2px solid ${selectedOptions.includes(opt.id) ? '#4f46e5' : '#e7e3dc'}`, borderRadius: 8, cursor: questionSubmitted ? 'default' : 'pointer', background: selectedOptions.includes(opt.id) ? '#eceafd' : '#f3f1ec', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
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
                        style={{ padding: '10px 12px', border: `2px solid ${selectedOptions.includes(opt.id) ? '#4f46e5' : '#e7e3dc'}`, borderRadius: 8, cursor: questionSubmitted ? 'default' : 'pointer', background: selectedOptions.includes(opt.id) ? '#eceafd' : '#f3f1ec', display: 'flex', alignItems: 'center', gap: 8 }}
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
                      style={{ fontSize: 13, lineHeight: 1.6, padding: '8px 12px', background: '#f3f1ec', borderRadius: 8, border: '1px solid #e7e3dc', minHeight: 64 }}
                      dangerouslySetInnerHTML={{ __html: essayText || '<span style="color:#a8a29e">Không có câu trả lời</span>' }}
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
              <div style={{ padding: '12px 14px', borderTop: '1px solid #e7e3dc', flexShrink: 0 }}>
                {!questionSubmitted ? (
                  <Button type="primary" icon={<SendOutlined />} block onClick={handleSubmit} disabled={!canSubmit} style={{ borderRadius: 8, fontWeight: 600 }}>
                    Gửi câu trả lời
                  </Button>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                      <CheckCircleOutlined style={{ color: '#0ea672', fontSize: 18 }} />
                      <Text strong style={{ color: '#0ea672' }}>Đã gửi câu trả lời!</Text>
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
          <div
            className={compact ? 'sq-panel-overlay-right' : undefined}
            style={{ ...panelStyle, ...overlayBase, right: compact ? 0 : undefined, width: compact ? Math.min(300, window.innerWidth - 20) : 280 }}
          >
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
        <CtrlBtn active={!localMedia.isMicOn} danger={!localMedia.isMicOn} onClick={localMedia.toggleMic} title={localMedia.isMicOn ? 'Tắt mic' : 'Bật mic'} icon={localMedia.isMicOn ? <AudioOutlined /> : <AudioMutedOutlined />} />
        <CtrlBtn active={!localMedia.isCameraOn} danger={!localMedia.isCameraOn} onClick={handleToggleCamera} title={localMedia.isCameraOn ? 'Tắt camera' : 'Bật camera'} icon={<VideoCameraOutlined />} />
        <CtrlBtn active={screenShareOn} onClick={() => { void handleToggleScreenShare(); }} title={screenShareOn ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'} icon={<DesktopOutlined />} />

        <CtrlBtn active={myRaisedHand} onClick={handleRaiseHand} title={myRaisedHand ? 'Hạ tay' : 'Giơ tay'}>✋</CtrlBtn>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)', margin: '0 4px', flexShrink: 0 }} />

        <CtrlBtn active={showParticipants} onClick={toggleParticipants} title={showParticipants ? 'Ẩn thành viên' : 'Hiện thành viên'} icon={<TeamOutlined />} />

        <Tooltip title="Chat">
          <Badge count={showChat ? 0 : unreadChat} size="small" overflowCount={99}>
            <Button
              shape="circle"
              type={showChat ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              style={{ background: showChat ? undefined : 'rgba(255,255,255,0.15)', borderColor: showChat ? undefined : 'transparent', color: showChat ? undefined : '#fff' }}
              onClick={toggleChat}
            />
          </Badge>
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

      {compact && (showParticipants || showChat) && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 98 }}
          onClick={() => { setShowParticipants(false); setShowChat(false); }}
        />
      )}

      {/* ── Leave confirm modal ── */}
      <Modal
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ExclamationCircleOutlined style={{ color: '#e08c0b', fontSize: 18 }} /><span>Rời khỏi lớp học?</span></div>}
        open={leaveOpen}
        onOk={handleLeave}
        onCancel={() => setLeaveOpen(false)}
        okText="Rời lớp & Xem kết quả"
        cancelText="Tiếp tục học"
        okButtonProps={{ danger: true, type: 'primary' }}
        centered
        width={400}
      >
        <p style={{ color: '#57534e', margin: '8px 0' }}>Bạn sẽ rời buổi học và xem lại kết quả của mình.</p>
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
