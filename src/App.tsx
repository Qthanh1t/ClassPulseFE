import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AppLayout from './components/layout/AppLayout';
import ClassListPage from './pages/classroom/ClassListPage';
import ClassDetailPage from './pages/classroom/ClassDetailPage';
import TeacherSessionPage from './pages/session/TeacherSessionPage';
import StudentSessionPage from './pages/session/StudentSessionPage';
import TeacherDashboardPage from './pages/dashboard/TeacherDashboardPage';
import StudentReviewPage from './pages/dashboard/StudentReviewPage';

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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/classes" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/classes" element={<ClassListPage />} />
            <Route path="/classes/:id" element={<ClassDetailPage />} />
            <Route path="/dashboard/:sessionId" element={<TeacherDashboardPage />} />
            <Route path="/review/:sessionId" element={<StudentReviewPage />} />
          </Route>
          {/* Session pages dùng layout riêng (fullscreen) */}
          <Route path="/session/teacher/:id" element={<TeacherSessionPage />} />
          <Route path="/session/student/:id" element={<StudentSessionPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
