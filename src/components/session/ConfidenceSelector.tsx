import { Button, Typography } from 'antd';
import type { ConfidenceLevel } from '../../types';

const { Text } = Typography;

interface Props {
  value: ConfidenceLevel | null;
  onChange: (v: ConfidenceLevel) => void;
}

const OPTIONS: { value: ConfidenceLevel; label: string; color: string; activeColor: string; activeBg: string }[] = [
  { value: 'low', label: 'Thấp', color: '#ff4d4f', activeColor: '#fff', activeBg: '#ff4d4f' },
  { value: 'medium', label: 'Trung bình', color: '#fa8c16', activeColor: '#fff', activeBg: '#fa8c16' },
  { value: 'high', label: 'Cao', color: '#52c41a', activeColor: '#fff', activeBg: '#52c41a' },
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
                background: active ? opt.activeBg : '#fafafa',
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
