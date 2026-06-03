import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import ClassListPage from './pages/classroom/ClassListPage';
import ClassDetailPage from './pages/classroom/ClassDetailPage';
import TeacherSessionPage from './pages/session/TeacherSessionPage';
import StudentSessionPage from './pages/session/StudentSessionPage';
import TeacherDashboardPage from './pages/dashboard/TeacherDashboardPage';
import StudentReviewPage from './pages/dashboard/StudentReviewPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/admin/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuthStore } from './store/authStore';
import { authService } from './services/auth.service';

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    // Nếu đã có session từ sessionStorage thì không cần gọi refresh
    if (user) {
      setReady(true);
      return;
    }
    authService.refresh()
      .then((res) => setAuth(res.user, res.accessToken))
      .catch(() => clearAuth())
      .finally(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorPrimary: '#4f46e5',
          borderRadius: 8,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f7f6f3',
          colorBorder: '#e7e3dc',
          colorBorderSecondary: '#efece6',
          colorTextBase: '#1c1917',
          colorTextSecondary: '#57534e',
          colorSuccess: '#0ea672',
          colorWarning: '#e08c0b',
          colorError: '#e23d6d',
          boxShadow: '0 1px 2px rgba(28,25,23,0.05), 0 8px 24px rgba(79,70,229,0.06)',
        },
        components: {
          Layout: { siderBg: '#ffffff', headerBg: '#ffffff' },
          Menu: { itemBg: 'transparent', itemSelectedBg: '#eceafd', itemSelectedColor: '#4f46e5' },
          Card: { borderRadius: 14, boxShadow: '0 1px 2px rgba(28,25,23,0.05)' },
          Button: { borderRadius: 8, primaryShadow: 'none' },
          Tag: { borderRadius: 6 },
          Tabs: { inkBarColor: '#4f46e5', itemSelectedColor: '#4f46e5' },
          Progress: { defaultColor: '#4f46e5' },
          Statistic: { titleFontSize: 13 },
          Table: { borderRadius: 12 },
          Modal: { borderRadius: 16 },
        },
      }}
    >
      <AuthBootstrap>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/classes" element={<ClassListPage />} />
                <Route path="/classes/:id" element={<ClassDetailPage />} />
                <Route path="/dashboard/:sessionId" element={<TeacherDashboardPage />} />
                <Route path="/review/:sessionId" element={<StudentReviewPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              {/* Session pages dùng layout riêng (fullscreen) */}
              <Route path="/session/teacher/:id" element={<TeacherSessionPage />} />
              <Route path="/session/student/:id" element={<StudentSessionPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthBootstrap>
    </ConfigProvider>
  );
}
