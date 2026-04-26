import { Avatar, Button, Card, Col, Row, Tag, Typography } from 'antd';
import {
  BookOutlined, TeamOutlined, QuestionCircleOutlined,
  CalendarOutlined, EditOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const STATS = [
  { icon: <BookOutlined />, label: 'Lớp học', value: 3, color: '#6366f1', bg: '#eef2ff' },
  { icon: <CalendarOutlined />, label: 'Buổi học', value: 12, color: '#0ea5e9', bg: '#f0f9ff' },
  { icon: <QuestionCircleOutlined />, label: 'Câu hỏi đã tạo', value: 48, color: '#f59e0b', bg: '#fffbeb' },
  { icon: <TeamOutlined />, label: 'Học sinh', value: 19, color: '#10b981', bg: '#f0fdf4' },
];

export default function ProfilePage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      {/* Profile card */}
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <Avatar
            size={80}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              fontSize: 30,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            L
          </Avatar>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                Nguyễn Thị Lan
              </Title>
              <Tag
                icon={<SafetyCertificateOutlined />}
                color="blue"
                style={{ borderRadius: 20, padding: '0 10px', fontSize: 12 }}
              >
                Giáo viên
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>lan.nguyen@truong.edu.vn</Text>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Khoa Công nghệ Thông tin · Tham gia từ tháng 9/2025
              </Text>
            </div>
          </div>
          <Button
            icon={<EditOutlined />}
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', color: '#64748b' }}
          >
            Chỉnh sửa
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        {STATS.map((s, i) => (
          <Col key={i} xs={12} sm={6}>
            <Card
              className="sq-stat-card"
              style={{ borderRadius: 14, border: '1px solid #e2e8f0', textAlign: 'center' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: s.bg, color: s.color, fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{s.value}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
