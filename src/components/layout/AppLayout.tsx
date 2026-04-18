import { useState } from 'react';
import { Layout, Avatar, Badge, Dropdown, Typography } from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  ReadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'classes', icon: <BookOutlined />, label: 'Lớp học', path: '/classes' },
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard', path: '/dashboard/sess1' },
];

const NAV_SECONDARY: NavItem[] = [
  { key: 'docs', icon: <ReadOutlined />, label: 'Tài liệu', path: '/classes' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt', path: '/classes' },
];

function NavButton({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`sq-nav-item${isActive ? ' active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontSize: 14,
        fontWeight: isActive ? 600 : 400,
        fontFamily: 'inherit',
        background: isActive ? '#eef2ff' : 'transparent',
        color: isActive ? '#6366f1' : '#64748b',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
    </button>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/dashboard') ? 'dashboard' : 'classes';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={232}
        collapsedWidth={64}
        style={{
          background: '#fff',
          borderRight: '1px solid #e2e8f0',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          zIndex: 200,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate('/classes')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            height: 64,
            width: '100%',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: '1px solid #e2e8f0',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(99,102,241,0.35)',
            }}
          >
            <BookOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          {!collapsed && (
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.3px',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
              }}
            >
              StudyQuest
            </span>
          )}
        </button>

        {/* Primary nav */}
        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!collapsed && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 10px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Menu
            </div>
          )}
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              isActive={selectedKey === item.key}
              collapsed={collapsed}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#e2e8f0', margin: '0 10px' }} />

        {/* Secondary nav */}
        <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!collapsed && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 10px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Khác
            </div>
          )}
          {NAV_SECONDARY.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              isActive={false}
              collapsed={collapsed}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>

        {/* User card at bottom */}
        {!collapsed && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 10,
              right: 10,
              background: '#f8fafc',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <Avatar
              size={32}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              L
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Nguyễn Thị Lan
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Giáo viên</div>
            </div>
          </div>
        )}

        {collapsed && (
          <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <Avatar
              size={32}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              L
            </Avatar>
          </div>
        )}
      </Sider>

      {/* ── Main area ── */}
      <Layout style={{ marginLeft: collapsed ? 64 : 232, transition: 'margin-left 0.2s ease' }}>
        {/* Header */}
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <button
            style={{
              cursor: 'pointer',
              background: 'none',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '5px 8px',
              fontSize: 15,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge count={2} size="small" offset={[-2, 2]}>
              <button
                style={{
                  background: 'none',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <BellOutlined />
              </button>
            </Badge>

            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
              }}
              placement="bottomRight"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 10px 4px 6px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <Avatar
                  size={28}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  L
                </Avatar>
                <Text style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>Nguyễn Thị Lan</Text>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            background: '#f8fafc',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
