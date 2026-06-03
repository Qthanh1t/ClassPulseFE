import { Button } from 'antd';
import { BookOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { color } from '../theme/tokens';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.bg,
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: color.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(79,70,229,0.30)',
          }}
        >
          <BookOutlined style={{ color: '#fff', fontSize: 28 }} />
        </div>
        <div className="sq-mono" style={{ fontSize: 52, fontWeight: 700, color: color.text, lineHeight: 1, letterSpacing: '-0.04em' }}>
          404
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: color.text, margin: '14px 0 8px' }}>
          Không tìm thấy trang
        </h1>
        <p style={{ fontSize: 14, color: color.textSecondary, lineHeight: 1.6, margin: '0 0 28px' }}>
          Trang bạn tìm không tồn tại hoặc đã được di chuyển. Hãy quay lại và thử lại nhé.
        </p>
        <Button
          type="primary"
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(user ? '/classes' : '/login')}
          className="sq-press"
          style={{ height: 46, borderRadius: 10, paddingInline: 24, fontWeight: 600 }}
        >
          {user ? 'Về danh sách lớp' : 'Về trang đăng nhập'}
        </Button>
      </div>
    </div>
  );
}
