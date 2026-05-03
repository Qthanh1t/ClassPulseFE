import { useState } from 'react';
import { Button, Input, Typography, Tag, message } from 'antd';
import {
  BookOutlined, UserOutlined, TeamOutlined,
  CheckCircleFilled, BarChartOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, LockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

type RoleChoice = 'teacher' | 'student' | null;

const FEATURES = [
  { icon: <BarChartOutlined />, text: 'Dashboard thời gian thực theo từng câu hỏi' },
  { icon: <ClockCircleOutlined />, text: 'Phát hiện học sinh không trả lời câu hỏi' },
  { icon: <TeamOutlined />, text: 'Breakout room & micro task cho nhóm nhỏ' },
  { icon: <SafetyCertificateOutlined />, text: 'Trả lời kèm mức độ tự tin (Thấp / Trung bình / Cao)' },
];

const DEMO_CREDENTIALS = {
  teacher: { email: 'lan.nguyen@truong.edu.vn', password: 'demo1234' },
  student: { email: 'an.nguyen@truong.edu.vn', password: 'demo1234' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [role, setRole] = useState<RoleChoice>(null);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const getEmail = () =>
    (document.getElementById('login-email') as HTMLInputElement | null)?.value ?? '';
  const getPassword = () =>
    (document.getElementById('login-password') as HTMLInputElement | null)?.value ?? '';

  async function handleLogin() {
    if (!role) return;
    const email = getEmail().trim();
    const password = getPassword().trim();
    if (!email || !password) {
      messageApi.warning('Vui lòng nhập email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login({ email, password });
      setAuth(result.user, result.accessToken);
      navigate('/classes');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = axiosErr.response?.data?.error?.message ?? 'Email hoặc mật khẩu không đúng';
      messageApi.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    if (!role) return;
    const creds = DEMO_CREDENTIALS[role];
    const emailEl = document.getElementById('login-email') as HTMLInputElement | null;
    const pwEl = document.getElementById('login-password') as HTMLInputElement | null;
    if (emailEl) emailEl.value = creds.email;
    if (pwEl) pwEl.value = creds.password;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Outfit', sans-serif" }}>
      {contextHolder}

      {/* ── Left: Brand panel ── */}
      <div
        style={{
          flex: '0 0 480px',
          background: 'linear-gradient(145deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: 40, bottom: 120, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56, position: 'relative' }}>
          <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <BookOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>ClassPulse</span>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <Title level={2} style={{ color: '#fff', margin: '0 0 12px', fontSize: 32, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.5px' }}>
            Lớp học thông minh<br />dành cho nhóm nhỏ
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 1.6, display: 'block', marginBottom: 36 }}>
            Mô hình <strong style={{ color: '#e0e7ff' }}>Closed Feedback Loop</strong> — giáo viên đặt câu hỏi, học sinh trả lời kèm mức độ tự tin, hệ thống phân tích realtime.
          </Text>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e7ff', fontSize: 14, flexShrink: 0 }}>
                  {f.icon}
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5 }}>{f.text}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Login form ── */}
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <Title level={3} style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
            Chào mừng trở lại
          </Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 28, fontSize: 14 }}>
            Đăng nhập để bắt đầu
          </Text>

          {/* Role cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => { setRole('teacher'); }}
              style={{
                flex: 1, padding: '16px 12px', borderRadius: 12,
                border: `2px solid ${role === 'teacher' ? '#6366f1' : '#e2e8f0'}`,
                background: role === 'teacher' ? '#eef2ff' : '#fff',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>👩‍🏫</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: role === 'teacher' ? '#6366f1' : '#0f172a', marginBottom: 3 }}>Giáo viên</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Quản lý lớp & câu hỏi</div>
              {role === 'teacher' && <CheckCircleFilled style={{ color: '#6366f1', fontSize: 14, marginTop: 6, display: 'block' }} />}
            </button>

            <button
              onClick={() => { setRole('student'); }}
              style={{
                flex: 1, padding: '16px 12px', borderRadius: 12,
                border: `2px solid ${role === 'student' ? '#10b981' : '#e2e8f0'}`,
                background: role === 'student' ? '#f0fdf4' : '#fff',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🧑‍💻</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: role === 'student' ? '#10b981' : '#0f172a', marginBottom: 3 }}>Học sinh</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Tham gia & trả lời</div>
              {role === 'student' && <CheckCircleFilled style={{ color: '#10b981', fontSize: 14, marginTop: 6, display: 'block' }} />}
            </button>
          </div>

          {/* Fill demo creds */}
          {role && (
            <div style={{ marginBottom: 12, textAlign: 'right' }}>
              <Tag
                color="orange"
                style={{ cursor: 'pointer', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}
                onClick={fillDemo}
              >
                ⚡ Điền tài khoản demo
              </Tag>
            </div>
          )}

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Email</div>
              <Input
                id="login-email"
                size="large"
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder={role === 'teacher' ? 'giaovien@truong.edu.vn' : 'hocsinh@truong.edu.vn'}
                style={{ borderRadius: 10, borderColor: '#e2e8f0', height: 44 }}
                onPressEnter={handleLogin}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Mật khẩu</div>
              <Input.Password
                id="login-password"
                size="large"
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="••••••••"
                style={{ borderRadius: 10, borderColor: '#e2e8f0', height: 44 }}
                onPressEnter={handleLogin}
              />
            </div>
          </div>

          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            disabled={!role}
            onClick={handleLogin}
            style={{
              height: 48, borderRadius: 12, fontWeight: 700, fontSize: 15,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              boxShadow: role ? '0 4px 14px rgba(99,102,241,0.35)' : undefined,
            }}
          >
            {loading ? 'Đang đăng nhập...' : role ? 'Vào ClassPulse →' : 'Chọn vai trò để tiếp tục'}
          </Button>

          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 12 }}>
            Nhấn "Điền tài khoản demo" để tự động điền thông tin thử nghiệm
          </Text>
        </div>
      </div>
    </div>
  );
}
