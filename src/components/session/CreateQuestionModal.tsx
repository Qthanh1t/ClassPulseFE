import { useState } from 'react';
import {
  Modal, Steps, Button, Radio, Input, Checkbox, Space,
  Typography, Card, Divider,
} from 'antd';
import {
  CheckSquareOutlined, FormOutlined, UnorderedListOutlined,
  BoldOutlined, ItalicOutlined, UnderlineOutlined, PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { QuestionType } from '../../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

const TEMPLATES: { type: QuestionType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'single', label: 'Trắc nghiệm (1 đáp án)', desc: 'Học sinh chọn 1 đáp án đúng', icon: <UnorderedListOutlined style={{ fontSize: 24, color: '#1677ff' }} /> },
  { type: 'multiple', label: 'Trắc nghiệm (nhiều đáp án)', desc: 'Học sinh chọn tất cả đáp án đúng', icon: <CheckSquareOutlined style={{ fontSize: 24, color: '#52c41a' }} /> },
  { type: 'essay', label: 'Câu hỏi tự luận', desc: 'Học sinh trả lời bằng văn bản tự do', icon: <FormOutlined style={{ fontSize: 24, color: '#722ed1' }} /> },
];

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export default function CreateQuestionModal({ open, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<QuestionType>('single');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState<Option[]>([
    { id: '1', text: '', isCorrect: false },
    { id: '2', text: '', isCorrect: false },
    { id: '3', text: '', isCorrect: false },
    { id: '4', text: '', isCorrect: false },
  ]);

  const handleClose = () => {
    setStep(0);
    setSelectedType('single');
    setContent('');
    onClose();
  };

  const handlePublish = () => {
    handleClose();
    onSubmit();
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { id: String(Date.now()), text: '', isCorrect: false }]);
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const toggleCorrect = (id: string) => {
    setOptions((prev) =>
      prev.map((o) => {
        if (selectedType === 'single') {
          return { ...o, isCorrect: o.id === id };
        }
        return o.id === id ? { ...o, isCorrect: !o.isCorrect } : o;
      }),
    );
  };

  const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <Modal
      title="Tạo câu hỏi mới"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={620}
    >
      <Steps
        current={step}
        size="small"
        style={{ margin: '16px 0 24px' }}
        items={[
          { title: 'Chọn dạng câu hỏi' },
          { title: 'Soạn câu hỏi' },
        ]}
      />

      {/* Step 1: Choose template */}
      {step === 0 && (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            Chọn dạng câu hỏi phù hợp với nội dung muốn kiểm tra:
          </Text>
          <Radio.Group
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as QuestionType)}
            style={{ width: '100%' }}
          >
            <div className="flex flex-col gap-3">
              {TEMPLATES.map((t) => (
                <Radio key={t.type} value={t.type} style={{ width: '100%', margin: 0 }}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: selectedType === t.type ? '2px solid #1677ff' : '1px solid #d9d9d9',
                      background: selectedType === t.type ? '#e6f4ff' : '#fff',
                    }}
                    styles={{ body: { padding: '12px 16px' } }}
                  >
                    <div className="flex items-center gap-3">
                      {t.icon}
                      <div>
                        <Text strong>{t.label}</Text>
                        <div><Text type="secondary" style={{ fontSize: 13 }}>{t.desc}</Text></div>
                      </div>
                    </div>
                  </Card>
                </Radio>
              ))}
            </div>
          </Radio.Group>

          <div className="flex justify-end mt-4">
            <Button type="primary" onClick={() => setStep(1)}>Tiếp theo →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Write question */}
      {step === 1 && (
        <div>
          {/* Mini toolbar */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '6px 10px',
              background: '#fafafa',
              border: '1px solid #d9d9d9',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
            }}
          >
            {[BoldOutlined, ItalicOutlined, UnderlineOutlined].map((Icon, i) => (
              <Button key={i} size="small" icon={<Icon />} type="text" />
            ))}
          </div>

          <TextArea
            placeholder="Nhập nội dung câu hỏi..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{ borderRadius: '0 0 8px 8px', resize: 'none' }}
          />

          {/* Options (MCQ) */}
          {selectedType !== 'essay' && (
            <div style={{ marginTop: 16 }}>
              <Divider>
                <Text strong style={{ fontSize: 13 }}>Các lựa chọn</Text>
              </Divider>
              <Space direction="vertical" style={{ width: '100%' }}>
                {options.map((opt, idx) => (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedType === 'single' ? (
                      <Radio checked={opt.isCorrect} onChange={() => toggleCorrect(opt.id)} />
                    ) : (
                      <Checkbox checked={opt.isCorrect} onChange={() => toggleCorrect(opt.id)} />
                    )}
                    <Title level={5} style={{ margin: 0, minWidth: 20, color: '#1677ff' }}>
                      {LABELS[idx] ?? idx + 1}
                    </Title>
                    <Input
                      placeholder={`Lựa chọn ${LABELS[idx] ?? idx + 1}`}
                      value={opt.text}
                      onChange={(e) => setOptions((prev) => prev.map((o) => o.id === opt.id ? { ...o, text: e.target.value } : o))}
                      style={{ flex: 1 }}
                    />
                    {options.length > 2 && (
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeOption(opt.id)}
                      />
                    )}
                  </div>
                ))}
              </Space>

              {options.length < 6 && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={addOption}
                  style={{ marginTop: 8 }}
                >
                  Thêm lựa chọn
                </Button>
              )}
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedType === 'single' ? '● Chọn radio để đánh dấu đáp án đúng' : '☑ Tick checkbox để đánh dấu các đáp án đúng'}
                </Text>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <Button onClick={() => setStep(0)}>← Quay lại</Button>
            <Button type="primary" onClick={handlePublish}>
              Phát câu hỏi →
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
