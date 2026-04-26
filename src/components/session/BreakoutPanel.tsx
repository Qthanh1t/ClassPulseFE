import { Avatar, Badge, Button, Card, Collapse, Input, Modal, Select, Tag, Tooltip, Typography } from 'antd';
import {
  TeamOutlined, MessageOutlined, PlusOutlined, CloseOutlined,
  LoginOutlined, LogoutOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { useState } from 'react';
import type { BreakoutGroup } from '../../types';
import { STUDENTS } from '../../mock/students';

const { Text, Title } = Typography;

interface Props {
  onClose: () => void;
}

export default function BreakoutPanel({ onClose }: Props) {
  const [mode, setMode] = useState<'setup' | 'active'>('setup');
  const [rooms, setRooms] = useState<BreakoutGroup[]>([
    { id: 'room-1', name: 'Phòng 1', studentIds: [], task: '' },
  ]);
  const [roomCounter, setRoomCounter] = useState(2);
  const [teacherInRoomId, setTeacherInRoomId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const assignedIds = new Set(rooms.flatMap((r) => r.studentIds));
  const mainRoomStudents = STUDENTS.filter((s) => !assignedIds.has(s.id));

  const addRoom = () => {
    const id = `room-${roomCounter}`;
    setRooms((prev) => [...prev, { id, name: `Phòng ${roomCounter}`, studentIds: [], task: '' }]);
    setRoomCounter((c) => c + 1);
  };

  const removeRoom = (roomId: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const assignStudent = (studentId: string, roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        studentIds: r.id === roomId
          ? [...r.studentIds, studentId]
          : r.studentIds.filter((id) => id !== studentId),
      }))
    );
  };

  const removeStudentFromRoom = (studentId: string, roomId: string) => {
    setRooms((prev) =>
      prev.map((r) => ({
        ...r,
        studentIds: r.id === roomId ? r.studentIds.filter((id) => id !== studentId) : r.studentIds,
      }))
    );
  };

  const updateRoomName = (roomId: string, name: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, name } : r)));
  };

  const updateTask = (roomId: string, task: string) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, task } : r)));
  };

  const toggleJoinRoom = (roomId: string) => {
    setTeacherInRoomId((prev) => (prev === roomId ? null : roomId));
  };

  /* ── SETUP MODE ── */
  if (mode === 'setup') {
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
            <Text type="secondary" style={{ fontSize: 11 }}>— chọn phòng để phân công từng HS</Text>
          </div>
          {mainRoomStudents.length === 0 ? (
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
                  <Avatar size={20} style={{ background: s.avatarColor, fontSize: 10, flexShrink: 0 }}>
                    {s.name.charAt(0)}
                  </Avatar>
                  <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                  <Select
                    size="small"
                    placeholder="→ phòng"
                    style={{ width: 100 }}
                    value={undefined}
                    popupMatchSelectWidth={false}
                    options={rooms.map((r) => ({ value: r.id, label: r.name }))}
                    onChange={(roomId) => roomId && assignStudent(s.id, roomId)}
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
              key={room.id}
              size="small"
              style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
              styles={{ body: { padding: '10px 14px' } }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Input
                    size="small"
                    value={room.name}
                    onChange={(e) => updateRoomName(room.id, e.target.value)}
                    style={{
                      width: 90, fontWeight: 600, fontSize: 13,
                      border: 'none', padding: '0 4px', background: 'transparent',
                      boxShadow: 'none',
                    }}
                  />
                  <Tag color="blue" style={{ borderRadius: 20, fontSize: 11 }}>
                    {room.studentIds.length} HS
                  </Tag>
                </div>
              }
              extra={
                <Tooltip title="Xóa phòng">
                  <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => removeRoom(room.id)} />
                </Tooltip>
              }
            >
              {/* Assigned students */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {room.studentIds.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                    Chưa có học sinh — phân công từ phòng chính
                  </Text>
                ) : (
                  room.studentIds.map((sid) => {
                    const s = STUDENTS.find((st) => st.id === sid);
                    return s ? (
                      <div
                        key={sid}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          background: '#eef2ff', borderRadius: 20,
                          padding: '2px 8px 2px 4px', border: '1px solid #c7d2fe',
                        }}
                      >
                        <Avatar size={18} style={{ background: s.avatarColor, fontSize: 10 }}>
                          {s.name.charAt(0)}
                        </Avatar>
                        <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                        <CloseOutlined
                          style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer', marginLeft: 2 }}
                          onClick={() => removeStudentFromRoom(sid, room.id)}
                        />
                      </div>
                    ) : null;
                  })
                )}
              </div>

              {/* Task input */}
              <Input
                size="small"
                placeholder="Nhiệm vụ cho phòng này (tùy chọn)..."
                value={room.task ?? ''}
                onChange={(e) => updateTask(room.id, e.target.value)}
                style={{ borderRadius: 8, fontSize: 12 }}
              />
            </Card>
          ))}
        </div>

        {/* Start breakout button */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
          {rooms.every((r) => r.studentIds.length === 0) && (
            <Text type="secondary" style={{ fontSize: 12 }}>Phân công ít nhất 1 học sinh vào phòng để bắt đầu</Text>
          )}
          <Button
            type="primary"
            disabled={rooms.every((r) => r.studentIds.length === 0)}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none', fontWeight: 600, borderRadius: 10,
            }}
            onClick={() => setMode('active')}
          >
            Bắt đầu breakout →
          </Button>
        </div>
      </div>
    );
  }

  /* ── ACTIVE MODE ── */
  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge status="processing" />
          <Title level={5} style={{ margin: 0 }}>Breakout đang hoạt động</Title>
          <Badge count={rooms.length} color="#6366f1" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<MessageOutlined />} onClick={() => setBroadcastOpen(true)}>
            Thông báo cả lớp
          </Button>
          <Button size="small" danger onClick={onClose}>
            Kết thúc breakout
          </Button>
        </div>
      </div>

      {/* Main room students (if any unassigned) */}
      {mainRoomStudents.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 10, border: '1.5px dashed #c7d2fe', borderRadius: 10, background: '#fafbff' }}
          styles={{ body: { padding: '10px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>Phòng chính</Text>
            <Tag style={{ borderRadius: 20, fontSize: 11 }}>{mainRoomStudents.length} học sinh</Tag>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mainRoomStudents.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Avatar size={22} style={{ background: s.avatarColor, fontSize: 10 }}>{s.name.charAt(0)}</Avatar>
                <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Breakout rooms */}
      <Collapse
        size="small"
        defaultActiveKey={rooms.map((r) => r.id)}
        items={rooms.map((room) => {
          const isTeacherHere = teacherInRoomId === room.id;
          const isSmallGroup = room.studentIds.length <= 2;
          return {
            key: room.id,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>{room.name}</Text>
                <Tag color="blue" style={{ borderRadius: 20 }}>{room.studentIds.length} HS</Tag>
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
                {/* Members */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {room.studentIds.map((sid) => {
                    const s = STUDENTS.find((st) => st.id === sid);
                    return s ? (
                      <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Avatar size={24} style={{ background: s.avatarColor, fontSize: 11 }}>{s.name.charAt(0)}</Avatar>
                        <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                      </div>
                    ) : null;
                  })}
                  {isTeacherHere && (
                    <Tooltip title="Giáo viên đang trong phòng này">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Avatar
                          size={24}
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: 11, border: '2px solid #6366f1' }}
                        >
                          L
                        </Avatar>
                        <Text style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>GV</Text>
                      </div>
                    </Tooltip>
                  )}
                </div>

                {/* Task */}
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

                {/* Join / Leave button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    size="small"
                    type={isTeacherHere ? 'default' : 'primary'}
                    ghost={!isTeacherHere}
                    icon={isTeacherHere ? <LogoutOutlined /> : <LoginOutlined />}
                    style={!isTeacherHere ? { borderColor: '#6366f1', color: '#6366f1' } : {}}
                    onClick={() => toggleJoinRoom(room.id)}
                  >
                    {isTeacherHere ? 'Rời phòng' : 'Vào phòng'}
                  </Button>
                  {!isTeacherHere && isSmallGroup && (
                    <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                      {room.studentIds.length === 1 ? 'Trao đổi riêng 1-1' : 'Trao đổi nhóm nhỏ'}
                    </Text>
                  )}
                </div>
              </div>
            ),
          };
        })}
      />

      {/* Broadcast modal */}
      <Modal
        title={<><MessageOutlined style={{ color: '#6366f1', marginRight: 8 }} />Thông báo đến tất cả nhóm</>}
        open={broadcastOpen}
        onCancel={() => setBroadcastOpen(false)}
        onOk={() => setBroadcastOpen(false)}
        okText="Gửi thông báo"
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
