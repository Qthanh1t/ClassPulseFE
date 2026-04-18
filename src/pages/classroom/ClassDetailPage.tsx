import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, Empty,
  Table, Tabs, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, PlayCircleOutlined,
  TeamOutlined, MessageOutlined, BookOutlined,
  CodeOutlined, DatabaseOutlined, ApartmentOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { CLASSROOMS, POSTS, SCHEDULES } from '../../mock/classrooms';
import { STUDENTS } from '../../mock/students';

const { Title, Text, Paragraph } = Typography;

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
  const posts = POSTS.filter((p) => p.classroomId === cls.id);
  const schedules = SCHEDULES.filter((s) => s.classroomId === cls.id);
  const style = SUBJECT_STYLE[cls.subject] ?? DEFAULT_STYLE;

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
                      <Paragraph style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                        {post.content}
                      </Paragraph>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedules.map((s, idx) => {
              const isPast = idx < 2;
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
                  <div style={{ flexShrink: 0 }}>
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
                      <Tag color="default" style={{ borderRadius: 6, margin: 0 }}>Đã xong</Tag>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
        {/* Decorative circles */}
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
    </div>
  );
}
