import { Button, Typography } from 'antd';
import type { ConfidenceLevel } from '../../types/api';

const { Text } = Typography;

interface Props {
  value: ConfidenceLevel | null;
  onChange: (v: ConfidenceLevel) => void;
}

const OPTIONS: { value: ConfidenceLevel; label: string; color: string; activeColor: string; activeBg: string }[] = [
  { value: 'low', label: 'Thấp', color: 'var(--sq-rose)', activeColor: '#fff', activeBg: 'var(--sq-rose)' },
  { value: 'medium', label: 'Trung bình', color: 'var(--sq-amber)', activeColor: '#fff', activeBg: 'var(--sq-amber)' },
  { value: 'high', label: 'Cao', color: 'var(--sq-emerald)', activeColor: '#fff', activeBg: 'var(--sq-emerald)' },
];

export default function ConfidenceSelector({ value, onChange }: Props) {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
        Mức độ tự tin của bạn với câu trả lời này?
      </Text>
      <div style={{ display: 'flex', gap: 10 }}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                flex: 1,
                height: 40,
                background: active ? opt.activeBg : 'var(--sq-surface-2)',
                borderColor: active ? opt.activeBg : opt.color + '66',
                color: active ? opt.activeColor : opt.color,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
