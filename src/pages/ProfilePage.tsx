import { useState, useEffect } from 'react';
import { Avatar, Button, Card, Col, Row, Tag, Typography, Modal, Form, Input, message, Spin, Upload } from 'antd';
import {
  BookOutlined, TeamOutlined, QuestionCircleOutlined,
  CalendarOutlined, EditOutlined, SafetyCertificateOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { userService } from '../services/user.service';
import { useAuthStore } from '../store/authStore';
import type { UserDto } from '../types/api';

const { Title, Text } = Typography;

const ROLE_LABEL: Record<string, string> = {
  teacher: 'Giáo viên',
  student: 'Học sinh',
  admin: 'Admin',
};

export default function ProfilePage() {
  const { user: storeUser, setAuth, accessToken } = useAuthStore();
  const [messageApi, contextHolder] = message.useMessage();

  const [profile, setProfile] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    userService.getMe()
      .then(setProfile)
      .catch(() => messageApi.error('Không thể tải thông tin hồ sơ'))
      .finally(() => setLoading(false));
  }, [messageApi]);

  async function handleSave(values: { name: string; avatarColor?: string }) {
    setSaving(true);
    try {
      const updated = await userService.updateMe(values);
      setProfile(updated);
      if (storeUser && accessToken) setAuth({ ...storeUser, name: updated.name, avatarColor: updated.avatarColor }, accessToken);
      setEditOpen(false);
      messageApi.success('Cập nhật thành công!');
    } catch {
      messageApi.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const result = await userService.uploadAvatar(file);
      setProfile((prev) => prev ? { ...prev, avatarUrl: result.avatarUrl } : prev);
      if (storeUser && accessToken) setAuth({ ...storeUser, avatarUrl: result.avatarUrl }, accessToken);
      messageApi.success('Ảnh đại diện đã được cập nhật!');
    } catch {
      messageApi.error('Upload ảnh thất bại');
    } finally {
      setAvatarUploading(false);
    }
    return false; // prevent antd default upload
  }

  const stats = [
    { icon: <BookOutlined />, label: 'Lớp học', value: profile?.stats?.classroomsCount ?? 0, color: '#6366f1', bg: '#eef2ff' },
    { icon: <CalendarOutlined />, label: 'Buổi học', value: profile?.stats?.sessionsCount ?? 0, color: '#0ea5e9', bg: '#f0f9ff' },
    { icon: <QuestionCircleOutlined />, label: 'Câu hỏi đã tạo', value: profile?.stats?.questionsAsked ?? 0, color: '#f59e0b', bg: '#fffbeb' },
    { icon: <TeamOutlined />, label: 'Học sinh', value: profile?.stats?.studentsReached ?? 0, color: '#10b981', bg: '#f0fdf4' },
  ];

  const displayName = profile?.name ?? storeUser?.name ?? '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[profile?.role ?? storeUser?.role ?? ''] ?? '';

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      {contextHolder}

      {/* Profile card */}
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={80}
              src={profile?.avatarUrl ?? undefined}
              style={{
                background: profile?.avatarColor ?? 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                fontSize: 30,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {avatarLetter}
            </Avatar>
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              beforeUpload={handleAvatarUpload}
            >
              <Button
                icon={<UploadOutlined />}
                size="small"
                loading={avatarUploading}
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  borderRadius: '50%',
                  width: 24,
                  height: 24,
                  minWidth: 0,
                  padding: 0,
                  fontSize: 11,
                  border: '2px solid #fff',
                  background: '#6366f1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Upload>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                {displayName}
              </Title>
              <Tag
                icon={<SafetyCertificateOutlined />}
                color="blue"
                style={{ borderRadius: 20, padding: '0 10px', fontSize: 12 }}
              >
                {roleLabel}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>{profile?.email ?? storeUser?.email}</Text>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tham gia từ {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }) : ''}
              </Text>
            </div>
          </div>

          <Button
            icon={<EditOutlined />}
            onClick={() => {
              form.setFieldsValue({ name: profile?.name, avatarColor: profile?.avatarColor ?? '' });
              setEditOpen(true);
            }}
            style={{ borderRadius: 10, border: '1px solid #e2e8f0', color: '#64748b' }}
          >
            Chỉnh sửa
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        {stats.map((s, i) => (
          <Col key={i} xs={12} sm={6}>
            <Card className="sq-stat-card" style={{ borderRadius: 14, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, color: s.color, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{s.value}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Edit modal */}
      <Modal
        title="Chỉnh sửa hồ sơ"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={420}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Tên hiển thị</span>}
            rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
          >
            <Input style={{ borderRadius: 10, height: 40 }} />
          </Form.Item>
          <Form.Item
            name="avatarColor"
            label={<span style={{ fontWeight: 600, fontSize: 13 }}>Màu avatar (hex)</span>}
          >
            <Input placeholder="#6366f1" style={{ borderRadius: 10, height: 40 }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEditOpen(false)} style={{ borderRadius: 10 }}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              style={{ borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 }}
            >
              Lưu
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
