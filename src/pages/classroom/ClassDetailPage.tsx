import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, Empty, Form, Input,
  Modal, Table, Tabs, Tag, TimePicker, Typography,
} from 'antd';
import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import {
  ArrowLeftOutlined, CalendarOutlined, PlayCircleOutlined,
  TeamOutlined, MessageOutlined, BookOutlined,
  CodeOutlined, DatabaseOutlined, ApartmentOutlined,
  ClockCircleOutlined, CheckCircleOutlined, PlusOutlined, SendOutlined,
} from '@ant-design/icons';
import { CLASSROOMS, POSTS, SCHEDULES } from '../../mock/classrooms';
import { STUDENTS } from '../../mock/students';
import type { Post, Schedule } from '../../types';
import RichTextEditor from '../../components/session/RichTextEditor';

const { Title, Text } = Typography;

interface SubjectStyle {
  gradient: string;
  icon: React.ReactNode;
}

const SUBJECT_STYLE: Record<string, SubjectStyle> = {
  Frontend: {
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    icon: <CodeOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
  Database: {
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
    icon: <DatabaseOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
  Architecture: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)',
    icon: <ApartmentOutlined style={{ fontSize: 28, color: '#fff' }} />,
  },
};

const DEFAULT_STYLE: SubjectStyle = {
  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  icon: <BookOutlined style={{ fontSize: 28, color: '#fff' }} />,
};

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const cls = CLASSROOMS.find((c) => c.id === id) ?? CLASSROOMS[0];
  const style = SUBJECT_STYLE[cls.subject] ?? DEFAULT_STYLE;

  // ── Local state for posts & schedules ──
  const [posts, setPosts] = useState<Post[]>(() => POSTS.filter((p) => p.classroomId === cls.id));
  const [schedules, setSchedules] = useState<Schedule[]>(() => SCHEDULES.filter((s) => s.classroomId === cls.id));

  // ── Post compose ──
  const [composing, setComposing] = useState(false);
  const [postHtml, setPostHtml] = useState('');

  function handlePostSubmit() {
    const stripped = postHtml.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;
    const newPost: Post = {
      id: `p${Date.now()}`,
      classroomId: cls.id,
      authorName: 'Nguyễn Thị Lan',
      authorRole: 'teacher',
      content: postHtml,
      createdAt: new Date().toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
    };
    setPosts((prev) => [newPost, ...prev]);
    setPostHtml('');
    setComposing(false);
  }

  // ── Schedule modal ──
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm] = Form.useForm<{
    title: string;
    date: Dayjs;
    startTime: Dayjs;
    endTime: Dayjs;
    description?: string;
  }>();

  function handleScheduleSubmit() {
    scheduleForm.validateFields().then((values) => {
      const newSchedule: Schedule = {
        id: `sch${Date.now()}`,
        classroomId: cls.id,
        title: values.title,
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm'),
        endTime: values.endTime.format('HH:mm'),
        description: values.description,
      };
      setSchedules((prev) => [...prev, newSchedule].sort((a, b) => a.date.localeCompare(b.date)));
      scheduleForm.resetFields();
      setScheduleOpen(false);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  const tabItems = [
    {
      key: 'feed',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageOutlined />
          <span>Bảng tin</span>
        </div>
      ),
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          {/* Compose box */}
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            {!composing ? (
              <div
                onClick={() => setComposing(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'text',
                }}
              >
                <Avatar
                  size={36}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  L
                </Avatar>
                <div
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#94a3b8',
                    fontSize: 14,
                    userSelect: 'none',
                  }}
                >
                  Thông báo gì đó cho lớp...
                </div>
              </div>
            ) : (
              <div>
                <RichTextEditor
                  onChange={setPostHtml}
                  placeholder="Thông báo gì đó cho lớp..."
                  minHeight={120}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <Button
                    onClick={() => { setComposing(false); setPostHtml(''); }}
                    style={{ borderRadius: 8 }}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handlePostSubmit}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      fontWeight: 600,
                      borderRadius: 8,
                    }}
                  >
                    Đăng bài
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Post list */}
          {posts.length === 0 ? (
            <Empty description="Chưa có bài đăng nào" style={{ padding: '32px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Avatar
                      size={36}
                      style={{
                        background: post.authorRole === 'teacher'
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'linear-gradient(135deg, #10b981, #059669)',
                        flexShrink: 0,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {post.authorName.charAt(0)}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{post.authorName}</Text>
                        {post.authorRole === 'teacher' && (
                          <Tag color="blue" style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0 }}>
                            Giáo viên
                          </Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>{post.createdAt}</Text>
                      </div>
                      {/* Render HTML content from RichTextEditor */}
                      <div
                        className="ck-content"
                        style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'schedule',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarOutlined />
          <span>Lịch học</span>
        </div>
      ),
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setScheduleOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                fontWeight: 600,
                borderRadius: 8,
              }}
            >
              Thêm buổi học
            </Button>
          </div>

          {schedules.length === 0 ? (
            <Empty description="Chưa có lịch học nào" style={{ padding: '32px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedules.map((s) => {
                const isPast = s.date < today;
                return (
                  <div
                    key={s.id}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      border: '1px solid #e2e8f0',
                      padding: '14px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      opacity: isPast ? 0.65 : 1,
                      borderLeft: `4px solid ${isPast ? '#e2e8f0' : '#6366f1'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: isPast ? '#f8fafc' : '#eef2ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isPast
                          ? <CheckCircleOutlined style={{ color: '#94a3b8', fontSize: 18 }} />
                          : <CalendarOutlined style={{ color: '#6366f1', fontSize: 18 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CalendarOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ClockCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>{s.startTime} – {s.endTime}</Text>
                          </div>
                        </div>
                        {s.description && (
                          <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>{s.description}</Text>
                        )}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isPast ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={() => navigate(`/session/teacher/${cls.id}`)}
                          style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none',
                            fontWeight: 600,
                            borderRadius: 8,
                          }}
                        >
                          Vào học
                        </Button>
                      ) : (
                        <>
                          <Tag color="default" style={{ borderRadius: 6, margin: 0 }}>Đã xong</Tag>
                          <Button
                            size="small"
                            onClick={() => navigate('/dashboard/sess1')}
                            style={{ borderRadius: 6, fontSize: 12, color: '#6366f1', borderColor: '#c7d2fe' }}
                          >
                            Xem kết quả →
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'members',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined />
          <span>Thành viên ({STUDENTS.length})</span>
        </div>
      ),
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          <Table
            dataSource={STUDENTS}
            rowKey="id"
            pagination={false}
            size="middle"
            style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}
            columns={[
              {
                title: 'Học sinh',
                key: 'name',
                render: (_, s) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar
                      size={34}
                      style={{ background: s.avatarColor, fontWeight: 600, fontSize: 13 }}
                    >
                      {s.name.charAt(0)}
                    </Avatar>
                    <Text style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{s.name}</Text>
                  </div>
                ),
              },
              {
                title: 'Vai trò',
                key: 'role',
                width: 120,
                render: (_, s) => (
                  <Tag
                    color={s.role === 'teacher' ? 'blue' : 'default'}
                    style={{ borderRadius: 20, padding: '0 10px', fontSize: 12 }}
                  >
                    {s.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                  </Tag>
                ),
              },
              {
                title: 'Trạng thái',
                key: 'status',
                width: 120,
                render: () => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Badge status="processing" color="#10b981" />
                    <Text style={{ fontSize: 13, color: '#10b981' }}>Online</Text>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Hero banner */}
      <div
        style={{
          background: style.gradient,
          borderRadius: 20,
          padding: '24px 28px 28px',
          marginBottom: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -50, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/classes')}
          style={{
            marginBottom: 16,
            color: 'rgba(255,255,255,0.85)',
            borderColor: 'rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          Quay lại
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              {style.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 2, fontWeight: 500 }}>
                {cls.subject}
              </div>
              <Title level={3} style={{ color: '#fff', margin: '0 0 4px', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
                {cls.name}
              </Title>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <TeamOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{cls.studentCount} học sinh</span>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <BookOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{cls.teacherName}</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => navigate(`/session/teacher/${cls.id}`)}
            style={{
              background: '#fff',
              color: '#6366f1',
              border: 'none',
              fontWeight: 700,
              borderRadius: 12,
              height: 44,
              paddingInline: 24,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            }}
          >
            Bắt đầu buổi học
          </Button>
        </div>
      </div>

      {/* Tabs card */}
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '0 24px 24px' } }}>
        <Tabs items={tabItems} defaultActiveKey="feed" />
      </Card>

      {/* Schedule creation modal */}
      <Modal
        title={
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Thêm buổi học mới
          </div>
        }
        open={scheduleOpen}
        onCancel={() => { setScheduleOpen(false); scheduleForm.resetFields(); }}
        onOk={handleScheduleSubmit}
        okText="Lưu lịch"
        cancelText="Hủy"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            fontWeight: 600,
          },
        }}
        width={480}
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="Tiêu đề buổi học"
            name="title"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="VD: Buổi 5: TypeScript nâng cao" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            label="Ngày học"
            name="date"
            rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
          >
            <DatePicker
              style={{ width: '100%', borderRadius: 8 }}
              format="DD/MM/YYYY"
              placeholder="Chọn ngày"
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              label="Giờ bắt đầu"
              name="startTime"
              rules={[{ required: true, message: 'Vui lòng chọn giờ' }]}
              style={{ flex: 1 }}
            >
              <TimePicker
                style={{ width: '100%', borderRadius: 8 }}
                format="HH:mm"
                minuteStep={5}
                placeholder="08:00"
              />
            </Form.Item>
            <Form.Item
              label="Giờ kết thúc"
              name="endTime"
              rules={[{ required: true, message: 'Vui lòng chọn giờ' }]}
              style={{ flex: 1 }}
            >
              <TimePicker
                style={{ width: '100%', borderRadius: 8 }}
                format="HH:mm"
                minuteStep={5}
                placeholder="10:00"
              />
            </Form.Item>
          </div>

          <Form.Item label="Mô tả (tùy chọn)" name="description">
            <Input.TextArea
              placeholder="Nội dung buổi học, tài liệu cần chuẩn bị..."
              rows={3}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
