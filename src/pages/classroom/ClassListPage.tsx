import { useState, useEffect, useCallback } from 'react';
import {
  Button, Col, Row, Typography, Modal, Form,
  Input, Badge, message, Spin,
} from 'antd';
import {
  PlusOutlined, TeamOutlined, CalendarOutlined,
  PlayCircleOutlined, UserOutlined, DownOutlined,
  CodeOutlined, DatabaseOutlined, ApartmentOutlined,
  BookOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { classroomService } from '../../services/classroom.service';
import { useAuthStore } from '../../store/authStore';
import type { ClassroomDto } from '../../types/api';

const { Title, Text, Paragraph } = Typography;

interface SubjectConfig {
  gradient: string;
  lightBg: string;
  textColor: string;
  icon: React.ReactNode;
}

const SUBJECT_CONFIG: Record<string, SubjectConfig> = {
  Frontend: {
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    lightBg: '#eef2ff',
    textColor: '#6366f1',
    icon: <CodeOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
  Database: {
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
    lightBg: '#f0f9ff',
    textColor: '#0ea5e9',
    icon: <DatabaseOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
  Architecture: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
    lightBg: '#fff7ed',
    textColor: '#f59e0b',
    icon: <ApartmentOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
};

const DEFAULT_SUBJECT: SubjectConfig = {
  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  lightBg: '#f0fdf4',
  textColor: '#10b981',
  icon: <BookOutlined style={{ fontSize: 28, color: '#fff' }} />,
};

function CourseCard({ cls, onStart, onJoinAsStudent, onCardClick }: {
  cls: ClassroomDto;
  onStart: () => void;
  onJoinAsStudent: () => void;
  onCardClick: () => void;
}) {
  const config = SUBJECT_CONFIG[cls.subject ?? ''] ?? DEFAULT_SUBJECT;

  return (
    <div
      className="sq-card-hover"
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
        overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
      }}
      onClick={onCardClick}
    >
      <div
        style={{
          background: config.gradient, height: 88,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.18)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            {config.icon}
          </div>
          {cls.subject && (
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, letterSpacing: '0.02em' }}>
              {cls.subject}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Title level={5} style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.35 }} ellipsis={{ rows: 2 }}>
          {cls.name}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 13, margin: '0 0 14px', lineHeight: 1.5, flex: 1 }} ellipsis={{ rows: 2 }}>
          {cls.description ?? 'Chưa có mô tả'}
        </Paragraph>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <TeamOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
            <Text style={{ fontSize: 12, color: '#64748b' }}>{cls.studentCount} học sinh</Text>
          </div>
          {cls.nextSchedule && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
              <Text style={{ fontSize: 12, color: '#64748b' }}>{cls.nextSchedule.scheduledDate}</Text>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: '#f1f5f9', margin: '0 0 14px' }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            style={{ flex: 1, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, fontSize: 13, height: 34 }}
          >
            Bắt đầu (GV)
          </Button>
          <Button
            size="small"
            icon={<UserOutlined />}
            onClick={(e) => { e.stopPropagation(); onJoinAsStudent(); }}
            style={{ height: 34, fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b' }}
            title="Vào học (học sinh)"
          >
            <DownOutlined style={{ fontSize: 10 }} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddClassCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="sq-card-hover"
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 16, border: '2px dashed #e2e8f0',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 10, padding: 24,
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f8fafc', border: '1.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PlusOutlined style={{ color: '#94a3b8', fontSize: 20 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>Tạo lớp mới</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Thêm môn học của bạn</div>
      </div>
    </div>
  );
}

export default function ClassListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [messageApi, contextHolder] = message.useMessage();

  const [classes, setClasses] = useState<ClassroomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [form] = Form.useForm();

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await classroomService.list();
      setClasses(data);
    } catch {
      messageApi.error('Không thể tải danh sách lớp');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  async function handleCreate(values: { name: string; description?: string; subject?: string }) {
    setCreating(true);
    try {
      const created = await classroomService.create(values);
      setClasses((prev) => [created, ...prev]);
      setCreateOpen(false);
      form.resetFields();
      messageApi.success('Tạo lớp thành công!');
    } catch {
      messageApi.error('Tạo lớp thất bại');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const result = await classroomService.join(joinCode.trim().toUpperCase());
      messageApi.success(`Đã tham gia lớp ${result.classroomName}!`);
      setJoinCode('');
      fetchClasses();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string } } } };
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'ALREADY_MEMBER') messageApi.warning('Bạn đã là thành viên lớp này');
      else if (code === 'JOIN_CODE_NOT_FOUND') messageApi.error('Mã lớp không hợp lệ');
      else messageApi.error('Tham gia lớp thất bại');
    } finally {
      setJoining(false);
    }
  }

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
  const displayName = user?.name ?? '';
  const isTeacher = user?.role === 'teacher';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {contextHolder}

      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', borderRadius: 20, padding: '28px 32px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -50, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: 500 }}>Xin chào,</div>
            <Title level={3} style={{ color: '#fff', margin: '0 0 6px', fontSize: 24, fontWeight: 700 }}>
              {displayName || 'Người dùng'}
            </Title>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOutlined style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{classes.length} lớp học</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TeamOutlined style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{totalStudents} học sinh</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Badge status="processing" color="#34d399" />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>Đang hoạt động</span>
              </div>
            </div>
          </div>

          {isTeacher && (
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.35)', color: '#fff', fontWeight: 600, fontSize: 14, height: 40, backdropFilter: 'blur(8px)', borderRadius: 10 }}
            >
              Tạo lớp mới
            </Button>
          )}
        </div>
      </div>

      {/* Section title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <Title level={5} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Lớp học của tôi</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Quản lý và tham gia các lớp học của bạn</Text>
        </div>
      </div>

      {/* Course grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {classes.map((cls) => (
            <Col key={cls.id} xs={24} sm={12} lg={8}>
              <CourseCard
                cls={cls}
                onCardClick={() => navigate(`/classes/${cls.id}`)}
                onStart={() => navigate(`/session/teacher/${cls.id}`)}
                onJoinAsStudent={() => navigate(`/session/student/${cls.id}`)}
              />
            </Col>
          ))}
          {isTeacher && (
            <Col xs={24} sm={12} lg={8}>
              <AddClassCard onClick={() => setCreateOpen(true)} />
            </Col>
          )}
        </Row>
      )}

      {/* Join with code */}
      <div style={{ marginTop: 28, padding: '20px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Tham gia bằng mã lớp</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Nhập mã do giáo viên cung cấp để tham gia lớp học</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Nhập mã lớp (VD: ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onPressEnter={handleJoin}
            style={{ width: 240, borderRadius: 10, height: 38, borderColor: '#e2e8f0' }}
          />
          <Button
            type="primary"
            loading={joining}
            onClick={handleJoin}
            style={{ height: 38, borderRadius: 10, fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
          >
            Tham gia
          </Button>
        </div>
      </div>

      {/* Create class modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusOutlined style={{ color: '#fff', fontSize: 14 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Tạo lớp học mới</span>
          </div>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        footer={null}
        width={480}
        styles={{ header: { borderBottom: '1px solid #f1f5f9', paddingBottom: 16 } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleCreate}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Tên lớp học</span>}
            rules={[{ required: true, message: 'Vui lòng nhập tên lớp' }]}
          >
            <Input placeholder="VD: Lập trình Web nâng cao" style={{ height: 40, borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Mô tả</span>}>
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về khóa học..." style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="subject" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Môn học</span>}>
            <Input placeholder="VD: Frontend, Database, ..." style={{ height: 40, borderRadius: 10 }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }} style={{ borderRadius: 10 }}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={creating}
              style={{ borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 }}
            >
              Tạo lớp
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
