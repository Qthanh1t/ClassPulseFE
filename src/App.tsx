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
import { useAuthStore } from './store/authStore';
import { authService } from './services/auth.service';

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
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
          colorPrimary: '#6366f1',
          borderRadius: 10,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f8fafc',
          colorBorder: '#e2e8f0',
          colorTextBase: '#0f172a',
          colorTextSecondary: '#64748b',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#f43f5e',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        },
        components: {
          Layout: { siderBg: '#ffffff', headerBg: '#ffffff' },
          Menu: { itemBg: 'transparent', itemSelectedBg: '#eef2ff', itemSelectedColor: '#6366f1' },
          Card: { borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
          Button: { borderRadius: 10 },
          Tag: { borderRadius: 6 },
          Tabs: { inkBarColor: '#6366f1', itemSelectedColor: '#6366f1' },
          Progress: { defaultColor: '#6366f1' },
          Statistic: { titleFontSize: 13 },
          Table: { borderRadius: 12 },
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
          </Routes>
        </BrowserRouter>
      </AuthBootstrap>
    </ConfigProvider>
  );
}
