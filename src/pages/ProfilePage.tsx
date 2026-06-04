import { useState, useEffect } from 'react';
import { Avatar, Button, Card, Col, Row, Tag, Typography, Modal, Form, Input, message, Upload } from 'antd';
import {
  BookOutlined, TeamOutlined, QuestionCircleOutlined,
  CalendarOutlined, EditOutlined, SafetyCertificateOutlined,
  UploadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { userService } from '../services/user.service';
import { useAuthStore } from '../store/authStore';
import type { UserDto } from '../types/api';
import PageContainer from '../components/ui/PageContainer';
import PageSkeleton from '../components/ui/PageSkeleton';
import { color, radius } from '../theme/tokens';

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

  const role = profile?.role ?? storeUser?.role ?? '';
  const isStudent = role === 'student';

  const stats = isStudent
    ? [
        { icon: <BookOutlined />, label: 'Lớp đã tham gia', value: profile?.stats?.classroomsCount ?? 0, color: color.primary, bg: color.primaryLight },
        { icon: <CalendarOutlined />, label: 'Buổi đã dự', value: profile?.stats?.sessionsCount ?? 0, color: '#0e7faa', bg: '#e3f1f8' },
        { icon: <QuestionCircleOutlined />, label: 'Câu đã trả lời', value: profile?.stats?.questionsAsked ?? 0, color: color.amber, bg: color.amberLight },
        { icon: <CheckCircleOutlined />, label: 'Trả lời đúng', value: profile?.stats?.studentsReached ?? 0, color: color.emerald, bg: color.emeraldLight },
      ]
    : [
        { icon: <BookOutlined />, label: 'Lớp học', value: profile?.stats?.classroomsCount ?? 0, color: color.primary, bg: color.primaryLight },
        { icon: <CalendarOutlined />, label: 'Buổi học', value: profile?.stats?.sessionsCount ?? 0, color: '#0e7faa', bg: '#e3f1f8' },
        { icon: <QuestionCircleOutlined />, label: 'Câu hỏi đã tạo', value: profile?.stats?.questionsAsked ?? 0, color: color.amber, bg: color.amberLight },
        { icon: <TeamOutlined />, label: 'Học sinh', value: profile?.stats?.studentsReached ?? 0, color: color.emerald, bg: color.emeraldLight },
      ];

  const displayName = profile?.name ?? storeUser?.name ?? '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[role] ?? '';

  if (loading) {
    return (
      <PageContainer maxWidth={800}>
        <PageSkeleton variant="detail" />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth={800}>
      {contextHolder}

      {/* Profile card */}
      <Card style={{ borderRadius: radius.card, border: `1px solid ${color.border}`, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={80}
              src={profile?.avatarUrl ?? undefined}
              style={{
                background: profile?.avatarColor ?? color.primary,
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
                  background: color.primary,
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
              <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: color.text }}>
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
            className="sq-press"
            style={{ borderRadius: 10, border: `1px solid ${color.border}`, color: color.textSecondary }}
          >
            Chỉnh sửa
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        {stats.map((s, i) => (
          <Col key={i} xs={12} sm={6}>
            <Card className="sq-stat-card" style={{ borderRadius: radius.card, border: `1px solid ${color.border}`, textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, color: s.color, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                {s.icon}
              </div>
              <div className="sq-nums" style={{ fontSize: 26, fontWeight: 700, color: color.text, lineHeight: 1.2 }}>{s.value}</div>
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
            <Input placeholder="#4f46e5" style={{ borderRadius: 10, height: 40 }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEditOpen(false)} style={{ borderRadius: 10 }}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              className="sq-press"
              style={{ borderRadius: 10, fontWeight: 600 }}
            >
              Lưu
            </Button>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
}
