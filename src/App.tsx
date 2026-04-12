import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ClassListPage from './pages/classroom/ClassListPage';
import ClassDetailPage from './pages/classroom/ClassDetailPage';
import TeacherSessionPage from './pages/session/TeacherSessionPage';
import StudentSessionPage from './pages/session/StudentSessionPage';
import TeacherDashboardPage from './pages/dashboard/TeacherDashboardPage';
import StudentReviewPage from './pages/dashboard/StudentReviewPage';

export default function App() {
  return (
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
  );
}
