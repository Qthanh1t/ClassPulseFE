import { useState, useEffect } from 'react';
import {
  Avatar, Button, Select, Table, Tag, Input, Typography, Popconfirm, message, Tabs, Alert,
} from 'antd';
import {
  UserOutlined, TeamOutlined, BookOutlined, PlayCircleOutlined, ReadOutlined,
  SearchOutlined, StopOutlined, CheckCircleOutlined, ReloadOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AdminStatsDto, AdminClassroomDto, UserDto } from '../../types/api';
import adminService from '../../services/admin.service';
import PageContainer from '../../components/ui/PageContainer';
import PageSkeleton from '../../components/ui/PageSkeleton';
import SectionHeader from '../../components/ui/SectionHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import { color, radius } from '../../theme/tokens';

const { Text } = Typography;
const { Search } = Input;

// Sky accent for the "teacher" metric — kept in the warm-neutral family by pairing
// a single desaturated blue with a low-alpha tint, consistent with the token ramp.
const SKY = '#0e7faa';

function StatusPill({ active }: { active: boolean }) {
  const c = active ? color.emerald : color.rose;
  const tint = active ? color.emeraldLight : color.roseLight;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        borderRadius: radius.pill,
        background: tint,
        color: c,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
      {active ? 'Hoạt động' : 'Vô hiệu'}
    </span>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [classrooms, setClassrooms] = useState<AdminClassroomDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedParts, setFailedParts] = useState<string[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string | undefined>(undefined);

  async function loadData() {
    setLoading(true);
    // allSettled so a single failing endpoint degrades that one section instead of
    // blanking the whole page (cross-boundary resilience).
    const [statsRes, classRes, userRes] = await Promise.allSettled([
      adminService.getStats(),
      adminService.listClassrooms({ limit: 100 }),
      adminService.listUsers({ limit: 100 }),
    ]);

    const failed: string[] = [];
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data ?? null);
    else failed.push('thống kê');
    if (classRes.status === 'fulfilled') setClassrooms(classRes.value.data ?? []);
    else failed.push('danh sách lớp');
    if (userRes.status === 'fulfilled') setUsers(userRes.value.data ?? []);
    else failed.push('danh sách người dùng');

    setFailedParts(failed);
    if (failed.length === 3) message.error('Không thể tải dữ liệu admin');
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleToggleActive(userId: string, currentActive: boolean) {
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
          {record.archived && (
            <Tag style={{ marginLeft: 6, fontSize: 11, borderRadius: radius.tag }}>Lưu trữ</Tag>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size={26}
            src={record.teacher.avatarUrl ?? undefined}
            style={{ background: record.teacher.avatarColor ?? color.primary, fontSize: 12 }}
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
      sorter: (a, b) => a.studentCount - b.studentCount,
      render: (v: number) => (
        <Tag
          style={{
            borderRadius: radius.pill,
            background: color.primaryLight,
            color: color.primary,
            border: 'none',
            fontWeight: 600,
          }}
        >
          {v} HS
        </Tag>
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
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
            size={34}
            src={record.avatarUrl ?? undefined}
            style={{ background: record.avatarColor ?? color.primary, fontSize: 14 }}
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
      filters: [
        { text: 'Giáo viên', value: 'teacher' },
        { text: 'Học sinh', value: 'student' },
        { text: 'Admin', value: 'admin' },
      ],
      onFilter: (value, record) => record.role === value,
      render: (role: string, record) => (
        <Select
          size="small"
          value={role}
          variant="filled"
          style={{ width: 116 }}
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
      render: (_, record) => <StatusPill active={record.isActive !== false} />,
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
      render: (_, record) => {
        const active = record.isActive !== false;
        return (
          <Popconfirm
            title={active ? 'Vô hiệu hóa tài khoản này?' : 'Kích hoạt tài khoản này?'}
            onConfirm={() => handleToggleActive(record.id, active)}
            okText="Xác nhận"
            cancelText="Hủy"
            okButtonProps={{ danger: active }}
          >
            <Button
              size="small"
              danger={active}
              icon={active ? <StopOutlined /> : <CheckCircleOutlined />}
            >
              {active ? 'Vô hiệu hóa' : 'Kích hoạt'}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const tableWrap: React.CSSProperties = {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.card,
    padding: 16,
  };

  return (
    <PageContainer>
      <SectionHeader
        size="lg"
        title="Quản trị hệ thống"
        subtitle="Quản lý người dùng và lớp học trên ClassPulse"
        action={
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} className="sq-press">
            Làm mới
          </Button>
        }
      />

      {failedParts.length > 0 && failedParts.length < 3 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 20, borderRadius: radius.control }}
          message={`Một phần dữ liệu chưa tải được: ${failedParts.join(', ')}.`}
          action={<Button size="small" onClick={loadData}>Thử lại</Button>}
        />
      )}

      {loading && !stats ? (
        <PageSkeleton variant="table" />
      ) : (
        <>
          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard
              title="Tổng người dùng"
              value={stats?.totalUsers ?? 0}
              icon={<UserOutlined />}
              accent={color.primary}
              tint={color.primaryLight}
            />
            <StatCard
              title="Giáo viên"
              value={stats?.teacherCount ?? 0}
              icon={<TeamOutlined />}
              accent={SKY}
              tint={`${SKY}1f`}
            />
            <StatCard
              title="Học sinh"
              value={stats?.studentCount ?? 0}
              icon={<ReadOutlined />}
              accent={color.emerald}
              tint={color.emeraldLight}
            />
            <StatCard
              title="Lớp hoạt động"
              value={stats?.activeClassrooms ?? 0}
              icon={<BookOutlined />}
              accent={color.amber}
              tint={color.amberLight}
            />
            <StatCard
              title="Lớp lưu trữ"
              value={stats?.archivedClassrooms ?? 0}
              icon={<InboxOutlined />}
              accent={color.textMuted}
              tint={color.surface2}
            />
            <StatCard
              title="Phiên đang diễn ra"
              value={stats?.activeSessions ?? 0}
              icon={<PlayCircleOutlined />}
              accent={color.rose}
              tint={color.roseLight}
            />
          </div>

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
                  <div style={tableWrap}>
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
                      size="middle"
                      scroll={{ x: 'max-content' }}
                      pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyState
                            compact
                            icon={<BookOutlined />}
                            title={classSearch ? 'Không tìm thấy lớp học' : 'Chưa có lớp học nào'}
                            description={classSearch ? 'Thử từ khóa khác.' : undefined}
                          />
                        ),
                      }}
                    />
                  </div>
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
                  <div style={tableWrap}>
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
                        style={{ width: 170 }}
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
                      size="middle"
                      scroll={{ x: 'max-content' }}
                      pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
                      loading={loading}
                      locale={{
                        emptyText: (
                          <EmptyState
                            compact
                            icon={<UserOutlined />}
                            title={userSearch || userRoleFilter ? 'Không tìm thấy người dùng' : 'Chưa có người dùng nào'}
                            description={userSearch || userRoleFilter ? 'Thử điều chỉnh bộ lọc.' : undefined}
                          />
                        ),
                      }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </PageContainer>
  );
}
