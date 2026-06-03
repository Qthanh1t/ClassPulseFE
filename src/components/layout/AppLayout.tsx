import { useState } from 'react';
import { Layout, Avatar, Dropdown, Drawer } from 'antd';
import {
  BookOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { color } from '../../theme/tokens';

const { Sider, Header, Content } = Layout;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'classes', icon: <BookOutlined />, label: 'Lớp học', path: '/classes' },
];

const NAV_ADMIN: NavItem[] = [
  { key: 'admin', icon: <SafetyCertificateOutlined />, label: 'Quản trị', path: '/admin' },
];

const NAV_SECONDARY: NavItem[] = [
  { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt', path: '/profile' },
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
      aria-current={isActive ? 'page' : undefined}
      className={`sq-nav-item${isActive ? ' active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        fontFamily: 'inherit',
        background: isActive ? color.primaryLight : 'transparent',
        color: isActive ? color.primary : color.textSecondary,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

function Logo({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="sq-press"
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
        borderBottom: `1px solid ${color.border}`,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          background: color.primary,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(79,70,229,0.30)',
        }}
      >
        <BookOutlined style={{ color: '#fff', fontSize: 16 }} />
      </div>
      {!collapsed && (
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: color.text,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}
        >
          ClassPulse
        </span>
      )}
    </button>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const { compact } = useBreakpoint();

  const selectedKey = location.pathname.startsWith('/admin') ? 'admin' : 'classes';

  const displayName = user?.name ?? 'Người dùng';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel =
    user?.role === 'teacher' ? 'Giáo viên' : user?.role === 'admin' ? 'Admin' : 'Học sinh';

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    clearAuth();
    navigate('/login');
  }

  function go(path: string) {
    navigate(path);
  }

  // Shared navigation body — rendered inside the Sider (desktop) or Drawer (mobile).
  const navBody = (isCollapsed: boolean) => (
    <>
      <div style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!isCollapsed && (
          <div style={navGroupLabel}>Menu</div>
        )}
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={selectedKey === item.key}
            collapsed={isCollapsed}
            onClick={() => go(item.path)}
          />
        ))}
        {user?.role === 'admin' &&
          NAV_ADMIN.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              isActive={selectedKey === item.key}
              collapsed={isCollapsed}
              onClick={() => go(item.path)}
            />
          ))}
      </div>

      <div style={{ height: 1, background: color.border, margin: '0 10px' }} />

      <div style={{ padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!isCollapsed && <div style={navGroupLabel}>Khác</div>}
        {NAV_SECONDARY.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={location.pathname === item.path}
            collapsed={isCollapsed}
            onClick={() => go(item.path)}
          />
        ))}
      </div>
    </>
  );

  const userCard = (
    <div
      style={{
        background: color.surface2,
        borderRadius: 12,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: `1px solid ${color.border}`,
      }}
    >
      <Avatar
        size={32}
        src={user?.avatarUrl ?? undefined}
        style={{
          background: user?.avatarColor ?? color.primary,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {avatarLetter}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 11, color: color.textSecondary }}>{roleLabel}</div>
      </div>
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Desktop / tablet sidebar ── */}
      {!compact && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={232}
          collapsedWidth={72}
          style={{
            background: color.surface,
            borderRight: `1px solid ${color.border}`,
            position: 'fixed',
            height: '100vh',
            left: 0,
            top: 0,
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <Logo collapsed={collapsed} onClick={() => navigate('/classes')} />
          {navBody(collapsed)}

          <div style={{ position: 'absolute', bottom: 16, left: 10, right: 10 }}>
            {collapsed ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  size={34}
                  src={user?.avatarUrl ?? undefined}
                  style={{
                    background: user?.avatarColor ?? color.primary,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {avatarLetter}
                </Avatar>
              </div>
            ) : (
              userCard
            )}
          </div>
        </Sider>
      )}

      {/* ── Mobile drawer sidebar ── */}
      {compact && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={264}
          closable={false}
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
        >
          <Logo collapsed={false} onClick={() => navigate('/classes')} />
          <div style={{ flex: 1 }}>{navBody(false)}</div>
          <div style={{ padding: 12 }}>{userCard}</div>
        </Drawer>
      )}

      {/* ── Main area ── */}
      <Layout
        style={{
          marginLeft: compact ? 0 : collapsed ? 72 : 232,
          transition: 'margin-left 0.2s ease',
        }}
      >
        <Header
          style={{
            background: color.surface,
            borderBottom: `1px solid ${color.border}`,
            padding: compact ? '0 16px' : '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              aria-label="Mở menu"
              className="sq-press sq-focus"
              style={iconBtn}
              onClick={() => (compact ? setDrawerOpen(true) : setCollapsed(!collapsed))}
            >
              {compact ? <MenuOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            {compact && (
              <span style={{ fontSize: 16, fontWeight: 700, color: color.text, letterSpacing: '-0.02em' }}>
                ClassPulse
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button aria-label="Thông báo" className="sq-press sq-focus" style={iconBtn}>
              <BellOutlined />
            </button>

            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'profile') navigate('/profile');
                  else if (key === 'logout') handleLogout();
                },
              }}
              placement="bottomRight"
            >
              <div
                className="sq-focus"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: compact ? 3 : '4px 10px 4px 6px',
                  borderRadius: 10,
                  border: `1px solid ${color.border}`,
                  background: color.surface2,
                }}
              >
                <Avatar
                  size={28}
                  src={user?.avatarUrl ?? undefined}
                  style={{
                    background: user?.avatarColor ?? color.primary,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {avatarLetter}
                </Avatar>
                {!compact && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: color.text }}>{displayName}</span>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ background: color.bg, minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

const navGroupLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: color.textMuted,
  padding: '4px 10px 6px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const iconBtn: React.CSSProperties = {
  cursor: 'pointer',
  background: 'none',
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  height: 36,
  minWidth: 36,
  padding: '0 9px',
  fontSize: 16,
  color: color.textSecondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
