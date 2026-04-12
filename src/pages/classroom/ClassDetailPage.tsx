import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, Col, Empty, Row, Space,
  Table, Tabs, Tag, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, PlayCircleOutlined,
  TeamOutlined, MessageOutlined, BookOutlined,
} from '@ant-design/icons';
import { CLASSROOMS, POSTS, SCHEDULES } from '../../mock/classrooms';
import { STUDENTS } from '../../mock/students';

const { Title, Text, Paragraph } = Typography;

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const cls = CLASSROOMS.find((c) => c.id === id) ?? CLASSROOMS[0];
  const posts = POSTS.filter((p) => p.classroomId === cls.id);
  const schedules = SCHEDULES.filter((s) => s.classroomId === cls.id);

  const tabItems = [
    {
      key: 'feed',
      label: (
        <Space>
          <MessageOutlined />
          Bảng tin
        </Space>
      ),
      children: (
        <div style={{ maxWidth: 680 }}>
          {posts.length === 0 ? (
            <Empty description="Chưa có bài đăng nào" />
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((post) => (
                <Card key={post.id} style={{ borderRadius: 10 }}>
                  <div className="flex items-start gap-3">
                    <Avatar
                      style={{
                        background: post.authorRole === 'teacher' ? '#1677ff' : '#52c41a',
                        flexShrink: 0,
                      }}
                    >
                      {post.authorName.charAt(0)}
                    </Avatar>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Text strong style={{ fontSize: 14 }}>{post.authorName}</Text>
                        {post.authorRole === 'teacher' && (
                          <Tag color="blue" style={{ fontSize: 11 }}>Giáo viên</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 12 }}>{post.createdAt}</Text>
                      </div>
                      <Paragraph style={{ margin: 0, fontSize: 14 }}>{post.content}</Paragraph>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'schedule',
      label: (
        <Space>
          <CalendarOutlined />
          Lịch học
        </Space>
      ),
      children: (
        <div style={{ maxWidth: 680 }}>
          <div className="flex flex-col gap-3">
            {schedules.map((s, idx) => {
              const isPast = idx < 2;
              return (
                <Card
                  key={s.id}
                  style={{
                    borderRadius: 10,
                    opacity: isPast ? 0.6 : 1,
                    borderLeft: isPast ? '4px solid #d9d9d9' : '4px solid #1677ff',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          background: isPast ? '#f5f5f5' : '#e6f4ff',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CalendarOutlined style={{ color: isPast ? '#bfbfbf' : '#1677ff', fontSize: 20 }} />
                      </div>
                      <div>
                        <Text strong>{s.title}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            {' · '}
                            {s.startTime} – {s.endTime}
                          </Text>
                        </div>
                        {s.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>{s.description}</Text>
                        )}
                      </div>
                    </div>
                    {!isPast && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={() => navigate(`/session/teacher/${cls.id}`)}
                      >
                        Vào học
                      </Button>
                    )}
                    {isPast && <Tag color="default">Đã kết thúc</Tag>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'members',
      label: (
        <Space>
          <TeamOutlined />
          Thành viên ({STUDENTS.length})
        </Space>
      ),
      children: (
        <div style={{ maxWidth: 680 }}>
          <Table
            dataSource={STUDENTS}
            rowKey="id"
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'Học sinh',
                key: 'name',
                render: (_, s) => (
                  <Space>
                    <Avatar style={{ background: s.avatarColor }}>{s.name.charAt(0)}</Avatar>
                    <Text>{s.name}</Text>
                  </Space>
                ),
              },
              {
                title: 'Vai trò',
                key: 'role',
                render: (_, s) => <Tag color={s.role === 'teacher' ? 'blue' : 'default'}>{s.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}</Tag>,
              },
              {
                title: 'Trạng thái',
                key: 'status',
                render: () => <Badge status="processing" text="Online" />,
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
          color: '#fff',
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/classes')}
          style={{ marginBottom: 12, color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }}
        >
          Quay lại
        </Button>
        <Row align="middle" justify="space-between">
          <Col>
            <div className="flex items-center gap-3 mb-2">
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOutlined style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <div>
                <Title level={3} style={{ color: '#fff', margin: 0 }}>{cls.name}</Title>
                <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{cls.teacherName} · {cls.studentCount} học sinh</Text>
              </div>
            </div>
          </Col>
          <Col>
            <Button
              size="large"
              icon={<PlayCircleOutlined />}
              style={{ background: '#fff', color: '#1677ff', border: 'none', fontWeight: 600 }}
              onClick={() => navigate(`/session/teacher/${cls.id}`)}
            >
              Bắt đầu buổi học
            </Button>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs items={tabItems} defaultActiveKey="feed" />
      </Card>
    </div>
  );
}
