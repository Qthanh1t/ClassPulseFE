import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Form, Input, message } from 'antd';
import {
  PlusOutlined, TeamOutlined, CalendarOutlined,
  PlayCircleOutlined, UserOutlined,
  CodeOutlined, DatabaseOutlined, ApartmentOutlined,
  BookOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { classroomService } from '../../services/classroom.service';
import { useAuthStore } from '../../store/authStore';
import type { ClassroomDto } from '../../types/api';
import PageContainer from '../../components/ui/PageContainer';
import SectionHeader from '../../components/ui/SectionHeader';
import EmptyState from '../../components/ui/EmptyState';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { color, radius, shadow } from '../../theme/tokens';

interface SubjectConfig {
  accent: string;
  tint: string;
  icon: React.ReactNode;
}

const SUBJECT_CONFIG: Record<string, SubjectConfig> = {
  Frontend: { accent: color.primary, tint: color.primaryLight, icon: <CodeOutlined /> },
  Database: { accent: '#0e7faa', tint: '#e3f1f8', icon: <DatabaseOutlined /> },
  Architecture: { accent: color.amber, tint: color.amberLight, icon: <ApartmentOutlined /> },
};

const DEFAULT_SUBJECT: SubjectConfig = {
  accent: color.emerald,
  tint: color.emeraldLight,
  icon: <BookOutlined />,
};

function CourseCard({ cls, onStart, onJoinAsStudent, onCardClick, isTeacher }: {
  cls: ClassroomDto;
  onStart: () => void;
  onJoinAsStudent: () => void;
  onCardClick: () => void;
  isTeacher: boolean;
}) {
  const config = SUBJECT_CONFIG[cls.subject ?? ''] ?? DEFAULT_SUBJECT;
  const isLive = !!cls.activeSessionId;

  return (
    <div
      className="sq-card-hover"
      style={{
        background: color.surface, borderRadius: radius.card,
        border: isLive ? `1px solid ${color.emerald}` : `1px solid ${color.border}`,
        overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
        boxShadow: isLive ? `0 0 0 3px ${color.emeraldLight}, ${shadow.sm}` : shadow.sm,
      }}
      onClick={onCardClick}
    >
      {/* Header: tinted strip, flat (no gradient) */}
      <div
        style={{
          background: config.tint, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        <div
          style={{
            width: 46, height: 46, background: color.surface, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: config.accent, fontSize: 22, flexShrink: 0,
            border: `1px solid ${color.border}`,
          }}
        >
          {config.icon}
        </div>
        {cls.subject && (
          <span style={{ color: config.accent, fontWeight: 600, fontSize: 12.5, background: color.surface, padding: '4px 11px', borderRadius: 999, border: `1px solid ${color.border}` }}>
            {cls.subject}
          </span>
        )}
        {isLive && (
          <span
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              color: '#fff', background: color.emerald, fontWeight: 700, fontSize: 11.5,
              letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 999,
              boxShadow: `0 1px 4px ${color.emeraldLight}`,
            }}
          >
            <span className="sq-live-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
            LIVE
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: color.text, lineHeight: 1.35, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cls.name}
        </div>
        <div style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.5, marginBottom: 14, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {cls.description ?? 'Chưa có mô tả'}
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: color.textSecondary }}>
            <TeamOutlined style={{ color: color.textMuted, fontSize: 13 }} />
            <span className="sq-nums">{cls.studentCount}</span> học sinh
          </span>
          {cls.nextSchedule && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: color.textSecondary }}>
              <CalendarOutlined style={{ color: color.textMuted, fontSize: 13 }} />
              <span className="sq-nums">{cls.nextSchedule.scheduledDate}</span>
            </span>
          )}
        </div>

        <div style={{ height: 1, background: color.border, marginBottom: 14 }} />

        {/* CTA pinned to bottom */}
        {isTeacher ? (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="sq-press"
            style={{
              width: '100%', fontWeight: 600, fontSize: 13.5, height: 38, borderRadius: radius.control,
              ...(isLive ? { background: color.emerald, borderColor: color.emerald } : {}),
            }}
          >
            {isLive ? 'Tiếp tục buổi học' : 'Bắt đầu buổi học'}
          </Button>
        ) : isLive ? (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); onJoinAsStudent(); }}
            className="sq-press"
            style={{ width: '100%', height: 38, fontSize: 13.5, fontWeight: 600, borderRadius: radius.control, background: color.emerald, borderColor: color.emerald }}
          >
            Tham gia ngay
          </Button>
        ) : (
          <Button
            icon={<UserOutlined />}
            onClick={(e) => { e.stopPropagation(); onJoinAsStudent(); }}
            className="sq-press"
            style={{ width: '100%', height: 38, fontSize: 13.5, fontWeight: 600, borderRadius: radius.control, borderColor: color.primary, color: color.primary }}
          >
            Vào học
          </Button>
        )}
      </div>
    </div>
  );
}

function AddClassCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="sq-card-hover sq-focus"
      onClick={onClick}
      style={{
        background: color.surface, borderRadius: radius.card, border: `2px dashed ${color.border}`,
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: 232, gap: 10, padding: 24,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: color.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PlusOutlined style={{ color: color.primary, fontSize: 20 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: color.text, marginBottom: 2 }}>Tạo lớp mới</div>
        <div style={{ fontSize: 12, color: color.textMuted }}>Thêm môn học của bạn</div>
      </div>
    </button>
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

  // Silent background refresh — keeps the LIVE badge in sync without flashing the skeleton
  const refreshClasses = useCallback(async () => {
    try {
      const data = await classroomService.list();
      setClasses(data);
    } catch {
      /* ignore transient errors during polling */
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Poll every 15s while the page is visible, and refresh immediately when the tab regains focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshClasses();
    }, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshClasses(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshClasses]);

  async function handleCreate(values: { name: string; description?: string; subject?: string }) {
    setCreating(true);
    try {
      const created = await classroomService.create(values);
      setClasses((prev) => [created, ...prev]);
      setCreateOpen(false);
      form.resetFields();
      messageApi.success('Đã tạo lớp');
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
      messageApi.success(`Đã tham gia lớp ${result.classroomName}`);
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
    <PageContainer>
      {contextHolder}

      {/* Hero — dark ink panel, flat with ambient glow + grain (no AI gradient) */}
      <div
        style={{
          background: '#1e1b3a', borderRadius: radius.page, padding: '28px 32px',
          marginBottom: 28, position: 'relative', overflow: 'hidden',
        }}
      >
        <div className="sq-noise" />
        <div style={{ position: 'absolute', right: -100, top: -100, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.4), transparent 70%)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4, fontWeight: 500 }}>Xin chào,</div>
            <h1 style={{ color: '#fff', margin: '0 0 10px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {displayName || 'Người dùng'}
            </h1>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <HeroStat icon={<BookOutlined />} value={classes.length} label="lớp học" />
              {isTeacher && <HeroStat icon={<TeamOutlined />} value={totalStudents} label="học sinh" />}
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.82)', fontSize: 13 }}>
                <span className="sq-live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                Đang hoạt động
              </span>
            </div>
          </div>

          {isTeacher && (
            <Button
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              className="sq-press"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontWeight: 600, fontSize: 14, height: 40, borderRadius: radius.control }}
            >
              Tạo lớp mới
            </Button>
          )}
        </div>
      </div>

      <SectionHeader title="Lớp học của tôi" subtitle="Quản lý và tham gia các lớp học của bạn" />

      {/* Course grid */}
      {loading ? (
        <PageSkeleton variant="cards" />
      ) : classes.length === 0 && !isTeacher ? (
        <EmptyState
          icon={<BookOutlined />}
          title="Bạn chưa tham gia lớp nào"
          description="Nhập mã lớp do giáo viên cung cấp ở ô bên dưới để tham gia lớp học đầu tiên."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {classes.map((cls) => (
            <CourseCard
              key={cls.id}
              cls={cls}
              isTeacher={isTeacher}
              onCardClick={() => navigate(`/classes/${cls.id}`)}
              onStart={() => navigate(`/session/teacher/${cls.id}`)}
              onJoinAsStudent={() => navigate(`/session/student/${cls.id}`)}
            />
          ))}
          {isTeacher && <AddClassCard onClick={() => setCreateOpen(true)} />}
        </div>
      )}

      {/* Join with code — students only */}
      {!isTeacher && (
        <div style={{ marginTop: 28, padding: '20px 24px', background: color.surface, borderRadius: radius.card, border: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: color.text, marginBottom: 2 }}>Tham gia bằng mã lớp</div>
            <div style={{ fontSize: 13, color: color.textSecondary }}>Nhập mã do giáo viên cung cấp để tham gia lớp học</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              className="sq-mono"
              prefix={<SearchOutlined style={{ color: color.textMuted }} />}
              placeholder="VD: ABC123"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onPressEnter={handleJoin}
              style={{ width: 200, borderRadius: radius.control, height: 38, letterSpacing: '0.08em' }}
            />
            <Button
              type="primary"
              loading={joining}
              onClick={handleJoin}
              className="sq-press"
              style={{ height: 38, borderRadius: radius.control, fontWeight: 600 }}
            >
              Tham gia
            </Button>
          </div>
        </div>
      )}

      {/* Create class modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: color.primaryLight, color: color.primary, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlusOutlined style={{ fontSize: 14 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Tạo lớp học mới</span>
          </div>
        }
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        footer={null}
        width={480}
        styles={{ header: { borderBottom: `1px solid ${color.border}`, paddingBottom: 16 } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleCreate}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Tên lớp học</span>}
            rules={[{ required: true, message: 'Vui lòng nhập tên lớp' }]}
          >
            <Input placeholder="VD: Lập trình Web nâng cao" style={{ height: 40, borderRadius: radius.control }} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Mô tả</span>}>
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về khóa học" style={{ borderRadius: radius.control }} />
          </Form.Item>
          <Form.Item name="subject" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Môn học</span>}>
            <Input placeholder="VD: Frontend, Database, Architecture" style={{ height: 40, borderRadius: radius.control }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }} style={{ borderRadius: radius.control }}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={creating} className="sq-press" style={{ borderRadius: radius.control, fontWeight: 600 }}>
              Tạo lớp
            </Button>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
}

function HeroStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.82)', fontSize: 13 }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{icon}</span>
      <span className="sq-nums" style={{ fontWeight: 600 }}>{value}</span> {label}
    </span>
  );
}
