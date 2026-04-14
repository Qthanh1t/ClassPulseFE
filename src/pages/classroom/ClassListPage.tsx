import { useState } from 'react';
import {
  Button, Card, Col, Row, Typography, Tag, Modal, Form,
  Input, Space, Avatar, Badge, Dropdown,
} from 'antd';
import {
  PlusOutlined, TeamOutlined, CalendarOutlined,
  BookOutlined, PlayCircleOutlined, UserOutlined, DownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CLASSROOMS } from '../../mock/classrooms';
import type { Classroom } from '../../types';

const { Title, Text, Paragraph } = Typography;

const SUBJECT_COLORS: Record<string, string> = {
  Frontend: 'blue',
  Database: 'green',
  Architecture: 'purple',
};

export default function ClassListPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [classes] = useState<Classroom[]>(CLASSROOMS);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Title level={4} style={{ margin: 0 }}>Lớp học của tôi</Title>
          <Text type="secondary">Quản lý và tham gia các lớp học</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Tạo lớp mới
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {classes.map((cls) => (
          <Col key={cls.id} xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: 20 } }}
              onClick={() => navigate(`/classes/${cls.id}`)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BookOutlined style={{ color: '#fff', fontSize: 20 }} />
                </div>
                <Tag color={SUBJECT_COLORS[cls.subject] ?? 'default'}>{cls.subject}</Tag>
              </div>

              {/* Name & desc */}
              <Title level={5} style={{ margin: '0 0 4px' }}>{cls.name}</Title>
              <Paragraph
                type="secondary"
                style={{ fontSize: 13, margin: '0 0 12px' }}
                ellipsis={{ rows: 2 }}
              >
                {cls.description}
              </Paragraph>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4">
                <Space size={4}>
                  <TeamOutlined style={{ color: '#8c8c8c' }} />
                  <Text type="secondary" style={{ fontSize: 13 }}>{cls.studentCount} học sinh</Text>
                </Space>
                {cls.nextSchedule && (
                  <Space size={4}>
                    <CalendarOutlined style={{ color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>{cls.nextSchedule}</Text>
                  </Space>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
                <div className="flex items-center gap-2">
                  <Avatar size={24} style={{ background: '#1677ff', fontSize: 12 }}>L</Avatar>
                  <Text style={{ fontSize: 13 }}>{cls.teacherName}</Text>
                </div>
                <Dropdown.Button
                  type="primary"
                  size="small"
                  icon={<DownOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/session/teacher/${cls.id}`);
                  }}
                  menu={{
                    items: [
                      {
                        key: 'student',
                        label: 'Vào học (học sinh)',
                        icon: <UserOutlined />,
                        onClick: ({ domEvent }) => {
                          domEvent.stopPropagation();
                          navigate(`/session/student/${cls.id}`);
                        },
                      },
                    ],
                  }}
                >
                  <PlayCircleOutlined /> Bắt đầu (GV)
                </Dropdown.Button>
              </div>
            </Card>
          </Col>
        ))}

        {/* Add class placeholder card */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            hoverable
            style={{
              borderRadius: 12,
              border: '2px dashed #d9d9d9',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
            }}
            styles={{ body: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 } }}
            onClick={() => setOpen(true)}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: '2px dashed #d9d9d9',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlusOutlined style={{ color: '#bfbfbf', fontSize: 20 }} />
            </div>
            <Text type="secondary">Tạo lớp mới</Text>
          </Card>
        </Col>
      </Row>

      {/* Joined via code */}
      <div className="mt-8">
        <Title level={5} style={{ marginBottom: 12 }}>Tham gia bằng mã lớp</Title>
        <Space.Compact style={{ width: 320 }}>
          <Input placeholder="Nhập mã lớp (VD: ABC123)" />
          <Button type="primary">Tham gia</Button>
        </Space.Compact>
      </div>

      {/* Create class modal */}
      <Modal
        title="Tạo lớp học mới"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={480}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Tên lớp học" required>
            <Input placeholder="VD: Lập trình Web nâng cao" />
          </Form.Item>
          <Form.Item label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về khóa học..." />
          </Form.Item>
          <Form.Item label="Môn học">
            <Input placeholder="VD: Frontend, Database, ..." />
          </Form.Item>
          <div className="flex justify-end gap-2 mt-2">
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button type="primary" onClick={() => setOpen(false)}>Tạo lớp</Button>
          </div>
        </Form>
      </Modal>

      {/* Online indicator */}
      <div className="mt-8 flex items-center gap-2">
        <Badge status="processing" />
        <Text type="secondary" style={{ fontSize: 13 }}>8 học sinh đang online</Text>
      </div>
    </div>
  );
}
