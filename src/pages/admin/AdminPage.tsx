import { useState, useEffect } from 'react';
import {
  Avatar, Badge, Button, Card, Col, Row, Select, Table, Tag, Input,
  Typography, Statistic, Popconfirm, message, Tabs,
} from 'antd';
import {
  UserOutlined, TeamOutlined, BookOutlined, PlayCircleOutlined,
  SearchOutlined, StopOutlined, CheckCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AdminStatsDto, AdminClassroomDto, UserDto } from '../../types/api';
import adminService from '../../services/admin.service';
import PageContainer from '../../components/ui/PageContainer';
import PageSkeleton from '../../components/ui/PageSkeleton';
import { color, radius } from '../../theme/tokens';

const { Text, Title } = Typography;
const { Search } = Input;

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <Card
      style={{ borderRadius: radius.card }}
      styles={{ body: { padding: '16px 20px' } }}
      className="sq-stat-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            background: `${color}18`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color, fontSize: 20 }}>{icon}</span>
        </div>
        <div>
          <Statistic value={value} valueStyle={{ fontSize: 26, fontWeight: 700, color: '#1c1917', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }} />
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </Text>
        </div>
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [classrooms, setClassrooms] = useState<AdminClassroomDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [classSearch, setClassSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string | undefined>(undefined);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, classRes, userRes] = await Promise.all([
        adminService.getStats(),
        adminService.listClassrooms({ limit: 100 }),
        adminService.listUsers({ limit: 100 }),
      ]);
      setStats(statsRes.data ?? null);
      setClassrooms(classRes.data ?? []);
      setUsers(userRes.data ?? []);
    } catch {
      message.error('Không thể tải dữ liệu admin');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleToggleActive(userId: string, currentActive: boolean | undefined) {
    try {
      const res = await adminService.updateUser(userId, { isActive: !currentActive });
      if (res.data) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...res.data! } : u)));
        message.success(currentActive ? 'Đã vô hiệu hóa tài khoản' : 'Đã kích hoạt tài khoản');
      }
    } catch {
      message.error('Cập nhật thất bại');
    }
  }

  async function handleChangeRole(userId: string, role: 'teacher' | 'student' | 'admin') {
    try {
      const res = await adminService.updateUser(userId, { role });
      if (res.data) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...res.data! } : u)));
        message.success('Đã cập nhật vai trò');
      }
    } catch {
      message.error('Cập nhật thất bại');
    }
  }

  const filteredClassrooms = classrooms.filter((c) =>
    !classSearch ||
    c.name.toLowerCase().includes(classSearch.toLowerCase()) ||
    c.teacher.name.toLowerCase().includes(classSearch.toLowerCase()),
  );

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = !userRoleFilter || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  const classroomColumns: ColumnsType<AdminClassroomDto> = [
    {
      title: 'Lớp học',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.archived && <Tag color="default" style={{ marginLeft: 6, fontSize: 11 }}>Lưu trữ</Tag>}
          {record.subject && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>{record.subject}</Text></div>
          )}
        </div>
      ),
    },
    {
      title: 'Giáo viên',
      key: 'teacher',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar
            size={24}
            src={record.teacher.avatarUrl ?? undefined}
            style={{ background: record.teacher.avatarColor ?? color.primary, fontSize: 11 }}
          >
            {record.teacher.name.charAt(0)}
          </Avatar>
          <Text style={{ fontSize: 13 }}>{record.teacher.name}</Text>
        </div>
      ),
    },
    {
      title: 'Học sinh',
      dataIndex: 'studentCount',
      key: 'studentCount',
      align: 'center',
      render: (v: number) => (
        <Tag color="blue" style={{ borderRadius: 20 }}>{v} HS</Tag>
      ),
    },
    {
      title: 'Mã lớp',
      dataIndex: 'joinCode',
      key: 'joinCode',
      render: (code: string) => (
        <Text code className="sq-mono" style={{ fontSize: 12, letterSpacing: 1 }}>{code}</Text>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(v).toLocaleDateString('vi-VN')}
        </Text>
      ),
    },
  ];

  const userColumns: ColumnsType<UserDto> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={32}
            src={record.avatarUrl ?? undefined}
            style={{ background: record.avatarColor ?? color.primary, fontSize: 13 }}
          >
            {record.name.charAt(0)}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{record.name}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record) => (
        <Select
          size="small"
          value={role}
          style={{ width: 110 }}
          options={[
            { value: 'teacher', label: 'Giáo viên' },
            { value: 'student', label: 'Học sinh' },
            { value: 'admin', label: 'Admin' },
          ]}
          onChange={(newRole) => handleChangeRole(record.id, newRole as 'teacher' | 'student' | 'admin')}
        />
      ),
    },
    {
      title: 'Trạng thái',
      key: 'isActive',
      align: 'center',
      render: (_, record) => (
        record.isActive !== false ? (
          <Badge status="success" text={<Text style={{ fontSize: 12 }}>Hoạt động</Text>} />
        ) : (
          <Badge status="error" text={<Text style={{ fontSize: 12, color: color.rose }}>Vô hiệu</Text>} />
        )
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(v).toLocaleDateString('vi-VN')}
        </Text>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title={record.isActive !== false ? 'Vô hiệu hóa tài khoản này?' : 'Kích hoạt tài khoản này?'}
          onConfirm={() => handleToggleActive(record.id, record.isActive !== false)}
          okText="Xác nhận"
          cancelText="Hủy"
          okButtonProps={{ danger: record.isActive !== false }}
        >
          <Button
            size="small"
            danger={record.isActive !== false}
            icon={record.isActive !== false ? <StopOutlined /> : <CheckCircleOutlined />}
          >
            {record.isActive !== false ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Quản trị hệ thống</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Quản lý người dùng và lớp học trên ClassPulse</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} className="sq-press">
          Làm mới
        </Button>
      </div>

      {/* Stats */}
      {loading && !stats ? (
        <PageSkeleton variant="table" />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<UserOutlined />}
                value={stats?.totalUsers ?? 0}
                label="Tổng người dùng"
                color={color.primary}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<TeamOutlined />}
                value={stats?.teacherCount ?? 0}
                label="Giáo viên"
                color="#0e7faa"
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<UserOutlined />}
                value={stats?.studentCount ?? 0}
                label="Học sinh"
                color={color.emerald}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<BookOutlined />}
                value={stats?.activeClassrooms ?? 0}
                label="Lớp đang hoạt động"
                color={color.amber}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<BookOutlined />}
                value={stats?.archivedClassrooms ?? 0}
                label="Lớp lưu trữ"
                color={color.textMuted}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <StatCard
                icon={<PlayCircleOutlined />}
                value={stats?.activeSessions ?? 0}
                label="Phiên đang diễn ra"
                color={color.rose}
              />
            </Col>
          </Row>

          <Tabs
            defaultActiveKey="classrooms"
            items={[
              {
                key: 'classrooms',
                label: (
                  <span>
                    <BookOutlined style={{ marginRight: 6 }} />
                    Lớp học ({classrooms.length})
                  </span>
                ),
                children: (
                  <Card style={{ borderRadius: 16 }}>
                    <div style={{ marginBottom: 16 }}>
                      <Search
                        placeholder="Tìm theo tên lớp hoặc giáo viên..."
                        prefix={<SearchOutlined style={{ color: color.textMuted }} />}
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        style={{ maxWidth: 360 }}
                        allowClear
                      />
                    </div>
                    <Table
                      dataSource={filteredClassrooms}
                      columns={classroomColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 'max-content' }}
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      loading={loading}
                    />
                  </Card>
                ),
              },
              {
                key: 'users',
                label: (
                  <span>
                    <UserOutlined style={{ marginRight: 6 }} />
                    Người dùng ({users.length})
                  </span>
                ),
                children: (
                  <Card style={{ borderRadius: 16 }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                      <Search
                        placeholder="Tìm theo tên hoặc email..."
                        prefix={<SearchOutlined style={{ color: color.textMuted }} />}
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        style={{ maxWidth: 320 }}
                        allowClear
                      />
                      <Select
                        placeholder="Lọc theo vai trò"
                        value={userRoleFilter}
                        onChange={setUserRoleFilter}
                        allowClear
                        style={{ width: 160 }}
                        options={[
                          { value: 'teacher', label: 'Giáo viên' },
                          { value: 'student', label: 'Học sinh' },
                          { value: 'admin', label: 'Admin' },
                        ]}
                      />
                    </div>
                    <Table
                      dataSource={filteredUsers}
                      columns={userColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 'max-content' }}
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      loading={loading}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </PageContainer>
  );
}
