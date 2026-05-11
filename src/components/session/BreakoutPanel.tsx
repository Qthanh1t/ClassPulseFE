import {
  Avatar, Badge, Button, Card, Collapse, Input, Modal, Select, Tag, Tooltip,
  Typography, message,
} from 'antd';
import {
  TeamOutlined, MessageOutlined, PlusOutlined, CloseOutlined,
  LoginOutlined, LogoutOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { BreakoutSessionDto, PresenceDto } from '../../types/api';
import breakoutService from '../../services/breakout.service';

const { Text, Title } = Typography;

interface LocalRoom {
  localId: string;
  name: string;
  task: string;
  studentIds: string[];
}

interface Props {
  sessionId: string;
  breakout: BreakoutSessionDto | null;
  presence: PresenceDto[];
  onClose: () => void;
}

export default function BreakoutPanel({ sessionId, breakout, presence, onClose }: Props) {
  // Setup mode state
  const [rooms, setRooms] = useState<LocalRoom[]>([
    { localId: 'room-1', name: 'Phòng 1', task: '', studentIds: [] },
  ]);
  const [roomCounter, setRoomCounter] = useState(2);
  const [starting, setStarting] = useState(false);

  // Active mode state
  const [teacherRoomId, setTeacherRoomId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    setTeacherRoomId(null);
  }, [breakout?.breakoutSessionId]);

  // Derived from presence for setup mode
  const allStudents = presence.map((p) => ({
    id: p.studentId,
    name: p.name,
    avatarColor: p.avatarColor,
  }));
  const assignedIds = new Set(rooms.flatMap((r) => r.studentIds));
  const mainRoomStudents = allStudents.filter((s) => !assignedIds.has(s.id));

  /* ── Setup mode handlers ── */
  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      { localId: `room-${roomCounter}`, name: `Phòng ${roomCounter}`, task: '', studentIds: [] },
    ]);
    setRoomCounter((c) => c + 1);
  };

  const removeRoom = (localId: string) => {
    setRooms((prev) => prev.filter((r) => r.localId !== localId));
  };

  const assignStudent = (studentId: string, localId: string) => {
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        studentIds:
          r.localId === localId
            ? [...r.studentIds, studentId]
            : r.studentIds.filter((id) => id !== studentId),
      })),
    );
  };

  const removeStudentFromRoom = (studentId: string, localId: string) => {
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        studentIds: r.localId === localId ? r.studentIds.filter((id) => id !== studentId) : r.studentIds,
      })),
    );
  };

  const handleStartBreakout = async () => {
    setStarting(true);
    try {
      await breakoutService.create(sessionId, {
        rooms: rooms
          .filter((r) => r.studentIds.length > 0)
          .map((r) => ({
            name: r.name,
            task: r.task || undefined,
            studentIds: r.studentIds,
          })),
      });
      // WS event 'breakout_started' will flip parent state → breakout prop becomes non-null
    } catch {
      message.error('Không thể tạo phòng nhỏ');
    } finally {
      setStarting(false);
    }
  };

  /* ── Active mode handlers ── */
  const handleJoinRoom = async (roomId: string) => {
    if (!breakout) return;
    try {
      if (teacherRoomId && teacherRoomId !== roomId) {
        await breakoutService.leaveRoom(sessionId, breakout.breakoutSessionId, teacherRoomId);
      }
      await breakoutService.joinRoom(sessionId, breakout.breakoutSessionId, roomId);
      setTeacherRoomId(roomId);
    } catch {
      message.error('Không thể vào phòng');
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!breakout) return;
    try {
      await breakoutService.leaveRoom(sessionId, breakout.breakoutSessionId, roomId);
      setTeacherRoomId(null);
    } catch {
      message.error('Không thể rời phòng');
    }
  };

  const handleEndBreakout = async () => {
    if (!breakout) return;
    setEnding(true);
    try {
      await breakoutService.end(sessionId, breakout.breakoutSessionId);
      onClose();
    } catch {
      message.error('Không thể kết thúc breakout');
    } finally {
      setEnding(false);
    }
  };

  const handleBroadcast = async () => {
    if (!breakout || !broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      await breakoutService.broadcast(sessionId, breakout.breakoutSessionId, {
        content: broadcastMsg.trim(),
      });
      message.success('Đã gửi thông báo đến tất cả nhóm');
      setBroadcastMsg('');
      setBroadcastOpen(false);
    } catch {
      message.error('Không thể gửi thông báo');
    } finally {
      setBroadcasting(false);
    }
  };

  /* ── ACTIVE MODE ── */
  if (breakout !== null) {
    const sortedRooms = [...breakout.rooms].sort((a, b) => a.order - b.order);

    return (
      <div style={{ padding: '0 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge status="processing" />
            <Title level={5} style={{ margin: 0 }}>Breakout đang hoạt động</Title>
            <Badge count={sortedRooms.length} color="#6366f1" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" icon={<MessageOutlined />} onClick={() => setBroadcastOpen(true)}>
              Thông báo cả lớp
            </Button>
            <Button size="small" danger loading={ending} onClick={handleEndBreakout}>
              Kết thúc breakout
            </Button>
          </div>
        </div>

        <Collapse
          size="small"
          defaultActiveKey={sortedRooms.map((r) => r.id)}
          items={sortedRooms.map((room) => {
            const isTeacherHere = teacherRoomId === room.id;
            return {
              key: room.id,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{room.name}</Text>
                  <Tag color="blue" style={{ borderRadius: 20 }}>{room.students.length} HS</Tag>
                  <Badge
                    status="processing"
                    text={<Text style={{ fontSize: 12, color: '#52c41a' }}>Đang thảo luận</Text>}
                  />
                  {isTeacherHere && (
                    <Tag color="purple" style={{ borderRadius: 20, fontSize: 11 }}>
                      <CheckCircleFilled style={{ marginRight: 3, fontSize: 10 }} />
                      GV đang ở đây
                    </Tag>
                  )}
                </div>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {room.students.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Avatar size={24} style={{ background: s.avatarColor ?? '#6366f1', fontSize: 11 }}>
                          {s.name.charAt(0)}
                        </Avatar>
                        <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                      </div>
                    ))}
                    {isTeacherHere && (
                      <Tooltip title="Giáo viên đang trong phòng này">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Avatar
                            size={24}
                            style={{
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              fontSize: 11,
                              border: '2px solid #6366f1',
                            }}
                          >
                            G
                          </Avatar>
                          <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>GV</Text>
                        </div>
                      </Tooltip>
                    )}
                  </div>

                  {room.task && (
                    <Card
                      size="small"
                      style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, marginBottom: 10 }}
                      styles={{ body: { padding: '8px 12px' } }}
                    >
                      <Text style={{ fontSize: 12 }}>
                        <span style={{ color: '#6366f1', fontWeight: 600 }}>Nhiệm vụ: </span>
                        {room.task}
                      </Text>
                    </Card>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      size="small"
                      type={isTeacherHere ? 'default' : 'primary'}
                      ghost={!isTeacherHere}
                      icon={isTeacherHere ? <LogoutOutlined /> : <LoginOutlined />}
                      style={!isTeacherHere ? { borderColor: '#6366f1', color: '#6366f1' } : {}}
                      onClick={() => (isTeacherHere ? handleLeaveRoom(room.id) : handleJoinRoom(room.id))}
                    >
                      {isTeacherHere ? 'Rời phòng' : 'Vào phòng'}
                    </Button>
                    {!isTeacherHere && room.students.length <= 2 && (
                      <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                        {room.students.length === 1 ? 'Trao đổi riêng 1-1' : 'Trao đổi nhóm nhỏ'}
                      </Text>
                    )}
                  </div>
                </div>
              ),
            };
          })}
        />

        <Modal
          title={<><MessageOutlined style={{ color: '#6366f1', marginRight: 8 }} />Thông báo đến tất cả nhóm</>}
          open={broadcastOpen}
          onCancel={() => setBroadcastOpen(false)}
          onOk={handleBroadcast}
          okText="Gửi thông báo"
          confirmLoading={broadcasting}
          okButtonProps={{ disabled: !broadcastMsg.trim() }}
        >
          <Input.TextArea
            rows={3}
            placeholder="VD: Còn 5 phút nữa, chuẩn bị báo cáo kết quả..."
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            style={{ marginTop: 12 }}
          />
        </Modal>
      </div>
    );
  }

  /* ── SETUP MODE ── */
  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#6366f1', fontSize: 16 }} />
          <Title level={5} style={{ margin: 0 }}>Thiết lập phòng nhỏ</Title>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={addRoom}>
            Thêm phòng
          </Button>
          <Button size="small" onClick={onClose}>Hủy</Button>
        </div>
      </div>

      {/* Main room — unassigned students */}
      <Card
        size="small"
        style={{ marginBottom: 14, border: '1.5px dashed #c7d2fe', borderRadius: 10, background: '#fafbff' }}
        styles={{ body: { padding: '12px 14px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>Phòng chính</Text>
          <Tag style={{ borderRadius: 20, fontSize: 11 }}>{mainRoomStudents.length} học sinh</Tag>
          {allStudents.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>— chọn phòng để phân công từng HS</Text>
          )}
        </div>
        {allStudents.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
            Chưa có học sinh tham gia buổi học
          </Text>
        ) : mainRoomStudents.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
            Tất cả học sinh đã được phân công vào các phòng
          </Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {mainRoomStudents.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: '#f1f5f9', borderRadius: 20,
                  padding: '3px 6px 3px 4px', border: '1px solid #e2e8f0',
                }}
              >
                <Avatar size={20} style={{ background: s.avatarColor ?? '#6366f1', fontSize: 10, flexShrink: 0 }}>
                  {s.name.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                <Select
                  size="small"
                  placeholder="→ phòng"
                  style={{ width: 100 }}
                  value={undefined}
                  popupMatchSelectWidth={false}
                  options={rooms.map((r) => ({ value: r.localId, label: r.name }))}
                  onChange={(localId) => localId && assignStudent(s.id, localId)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Breakout room cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rooms.map((room) => (
          <Card
            key={room.localId}
            size="small"
            style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
            styles={{ body: { padding: '10px 14px' } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Input
                  size="small"
                  value={room.name}
                  onChange={(e) =>
                    setRooms((prev) =>
                      prev.map((r) => (r.localId === room.localId ? { ...r, name: e.target.value } : r)),
                    )
                  }
                  style={{
                    width: 90, fontWeight: 600, fontSize: 13,
                    border: 'none', padding: '0 4px', background: 'transparent', boxShadow: 'none',
                  }}
                />
                <Tag color="blue" style={{ borderRadius: 20, fontSize: 11 }}>
                  {room.studentIds.length} HS
                </Tag>
              </div>
            }
            extra={
              <Tooltip title="Xóa phòng">
                <Button
                  type="text" size="small" danger
                  icon={<CloseOutlined />}
                  onClick={() => removeRoom(room.localId)}
                />
              </Tooltip>
            }
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {room.studentIds.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                  Chưa có học sinh — phân công từ phòng chính
                </Text>
              ) : (
                room.studentIds.map((sid) => {
                  const s = allStudents.find((st) => st.id === sid);
                  return s ? (
                    <div
                      key={sid}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        background: '#eef2ff', borderRadius: 20,
                        padding: '2px 8px 2px 4px', border: '1px solid #c7d2fe',
                      }}
                    >
                      <Avatar size={18} style={{ background: s.avatarColor ?? '#6366f1', fontSize: 10 }}>
                        {s.name.charAt(0)}
                      </Avatar>
                      <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                      <CloseOutlined
                        style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer', marginLeft: 2 }}
                        onClick={() => removeStudentFromRoom(sid, room.localId)}
                      />
                    </div>
                  ) : null;
                })
              )}
            </div>

            <Input
              size="small"
              placeholder="Nhiệm vụ cho phòng này (tùy chọn)..."
              value={room.task}
              onChange={(e) =>
                setRooms((prev) =>
                  prev.map((r) => (r.localId === room.localId ? { ...r, task: e.target.value } : r)),
                )
              }
              style={{ borderRadius: 8, fontSize: 12 }}
            />
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
        {rooms.every((r) => r.studentIds.length === 0) && allStudents.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Phân công ít nhất 1 học sinh vào phòng để bắt đầu
          </Text>
        )}
        <Button
          type="primary"
          loading={starting}
          disabled={rooms.every((r) => r.studentIds.length === 0)}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', fontWeight: 600, borderRadius: 10,
          }}
          onClick={handleStartBreakout}
        >
          Bắt đầu breakout →
        </Button>
      </div>
    </div>
  );
}
