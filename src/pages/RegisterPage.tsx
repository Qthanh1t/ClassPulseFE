import { useState } from 'react';
import { Button, Input, message } from 'antd';
import {
  BookOutlined, UserOutlined, MailOutlined, TeamOutlined,
  CheckCircleFilled, BarChartOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, LockOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { color } from '../theme/tokens';

type RoleChoice = 'teacher' | 'student' | null;

const FEATURES = [
  { icon: <BarChartOutlined />, text: 'Dashboard thời gian thực theo từng câu hỏi' },
  { icon: <ClockCircleOutlined />, text: 'Phát hiện học sinh không trả lời câu hỏi' },
  { icon: <TeamOutlined />, text: 'Breakout room & micro task cho nhóm nhỏ' },
  { icon: <SafetyCertificateOutlined />, text: 'Trả lời kèm mức độ tự tin (thấp / trung bình / cao)' },
];

interface FieldErrors {
  role?: string;
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { isMobile, isTablet } = useBreakpoint();
  const showBrandPanel = !isMobile && !isTablet;

  const [role, setRole] = useState<RoleChoice>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!role) next.role = 'Vui lòng chọn vai trò';
    if (!name.trim()) next.name = 'Nhập họ và tên';
    else if (name.trim().length > 100) next.name = 'Họ tên không quá 100 ký tự';
    if (!email.trim()) next.email = 'Nhập email của bạn';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Nhập mật khẩu';
    else if (password.length < 8) next.password = 'Mật khẩu tối thiểu 8 ký tự';
    else if (password.length > 100) next.password = 'Mật khẩu không quá 100 ký tự';
    if (!confirm) next.confirm = 'Nhập lại mật khẩu';
    else if (confirm !== password) next.confirm = 'Mật khẩu nhập lại không khớp';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await authService.register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: role!,
      });
      setAuth(result.user, result.accessToken);
      messageApi.success('Tạo tài khoản thành công');
      navigate('/classes');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'EMAIL_TAKEN') {
        setErrors((e) => ({ ...e, email: 'Email này đã được đăng ký' }));
      } else {
        messageApi.error(axiosErr.response?.data?.error?.message ?? 'Đăng ký thất bại, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: color.bg }}>
      {contextHolder}

      {/* ── Left: Brand panel (desktop only) ── */}
      {showBrandPanel && (
        <div
          style={{
            flex: '0 0 460px',
            background: '#1e1b3a',
            display: 'flex',
            flexDirection: 'column',
            padding: '48px 44px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="sq-noise" />
          {/* soft ambient accent glow, not a 45° gradient */}
          <div
            style={{
              position: 'absolute', right: -120, top: -80, width: 360, height: 360,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.45), transparent 70%)',
            }}
          />
          <div
            style={{
              position: 'absolute', left: -100, bottom: -60, width: 320, height: 320,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.18), transparent 70%)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56, position: 'relative' }}>
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.18)' }}>
              <BookOutlined style={{ color: '#fff', fontSize: 20 }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>ClassPulse</span>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <h1 style={{ color: '#fff', margin: '0 0 14px', fontSize: 34, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
              Tạo tài khoản<br />và bắt đầu tương tác
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.66)', fontSize: 15, lineHeight: 1.6, margin: '0 0 36px', maxWidth: 360 }}>
              Tham gia <strong style={{ color: '#cfcafe', fontWeight: 600 }}>ClassPulse</strong> để dạy và học trong cùng một phiên realtime: câu hỏi, video, breakout và dashboard tức thì.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfcafe', fontSize: 15, flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13.5 }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            Đồ án tốt nghiệp · Nền tảng tương tác realtime
          </div>
        </div>
      )}

      {/* ── Right: Register form ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 20px' : '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile brand mark */}
          {!showBrandPanel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ width: 38, height: 38, background: color.primary, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
                <BookOutlined style={{ color: '#fff', fontSize: 18 }} />
              </div>
              <span style={{ fontSize: 20, fontWeight: 700, color: color.text, letterSpacing: '-0.03em' }}>ClassPulse</span>
            </div>
          )}

          <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: color.text, textAlign: 'center' }}>
            Tạo tài khoản mới
          </h2>
          <p style={{ textAlign: 'center', margin: '0 0 28px', fontSize: 14, color: color.textSecondary }}>
            Chọn vai trò và điền thông tin để bắt đầu
          </p>

          {/* Role cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: errors.role ? 6 : 22 }}>
            <RoleCard
              emoji="👩‍🏫"
              title="Giáo viên"
              subtitle="Quản lý lớp & câu hỏi"
              active={role === 'teacher'}
              accent={color.primary}
              activeBg={color.primaryLight}
              onClick={() => { setRole('teacher'); setErrors((e) => ({ ...e, role: undefined })); }}
            />
            <RoleCard
              emoji="🧑‍💻"
              title="Học sinh"
              subtitle="Tham gia & trả lời"
              active={role === 'student'}
              accent={color.emerald}
              activeBg={color.emeraldLight}
              onClick={() => { setRole('student'); setErrors((e) => ({ ...e, role: undefined })); }}
            />
          </div>
          {errors.role && <FieldError msg={errors.role} center />}

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: '22px 0' }}>
            <div>
              <Label>Họ và tên</Label>
              <Input
                size="large"
                value={name}
                status={errors.name ? 'error' : undefined}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }}
                prefix={<UserOutlined style={{ color: color.textMuted }} />}
                placeholder="Nguyễn Văn A"
                style={{ borderRadius: 8, height: 44 }}
                onPressEnter={handleRegister}
              />
              {errors.name && <FieldError msg={errors.name} />}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                size="large"
                value={email}
                status={errors.email ? 'error' : undefined}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: undefined })); }}
                prefix={<MailOutlined style={{ color: color.textMuted }} />}
                placeholder={role === 'teacher' ? 'giaovien@truong.edu.vn' : 'hocsinh@truong.edu.vn'}
                style={{ borderRadius: 8, height: 44 }}
                onPressEnter={handleRegister}
              />
              {errors.email && <FieldError msg={errors.email} />}
            </div>
            <div>
              <Label>Mật khẩu</Label>
              <Input.Password
                size="large"
                value={password}
                status={errors.password ? 'error' : undefined}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((x) => ({ ...x, password: undefined })); }}
                prefix={<LockOutlined style={{ color: color.textMuted }} />}
                placeholder="Tối thiểu 8 ký tự"
                style={{ borderRadius: 8, height: 44 }}
                onPressEnter={handleRegister}
              />
              {errors.password && <FieldError msg={errors.password} />}
            </div>
            <div>
              <Label>Nhập lại mật khẩu</Label>
              <Input.Password
                size="large"
                value={confirm}
                status={errors.confirm ? 'error' : undefined}
                onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined })); }}
                prefix={<LockOutlined style={{ color: color.textMuted }} />}
                placeholder="••••••••"
                style={{ borderRadius: 8, height: 44 }}
                onPressEnter={handleRegister}
              />
              {errors.confirm && <FieldError msg={errors.confirm} />}
            </div>
          </div>

          <Button
            type="primary"
            block
            size="large"
            loading={loading}
            onClick={handleRegister}
            className="sq-press"
            icon={!loading ? <ArrowRightOutlined /> : undefined}
            iconPosition="end"
            style={{
              height: 48, borderRadius: 10, fontWeight: 600, fontSize: 15,
              boxShadow: '0 4px 14px rgba(79,70,229,0.28)',
            }}
          >
            {loading ? 'Đang tạo tài khoản' : 'Tạo tài khoản'}
          </Button>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: color.textSecondary }}>
            Đã có tài khoản?{' '}
            <Link to="/login" style={{ color: color.primary, fontWeight: 600 }}>
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  emoji, title, subtitle, active, accent, activeBg, onClick,
}: {
  emoji: string; title: string; subtitle: string; active: boolean;
  accent: string; activeBg: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="sq-press sq-focus"
      aria-pressed={active}
      style={{
        flex: 1, padding: '16px 12px', borderRadius: 12,
        border: `1.5px solid ${active ? accent : color.border}`,
        background: active ? activeBg : color.surface,
        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: active ? accent : color.text, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 11, color: color.textMuted }}>{subtitle}</div>
      {active && <CheckCircleFilled style={{ color: accent, fontSize: 14, marginTop: 6, display: 'block' }} />}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: color.text, marginBottom: 5 }}>{children}</div>;
}

function FieldError({ msg, center }: { msg: string; center?: boolean }) {
  return (
    <div style={{ fontSize: 12, color: color.rose, marginTop: 5, textAlign: center ? 'center' : 'left' }}>
      {msg}
    </div>
  );
}
