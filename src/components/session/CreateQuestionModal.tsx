import { useState } from 'react';
import {
  Modal, Steps, Button, Radio, Input, Checkbox, Space,
  Typography, Card, Divider,
} from 'antd';
import {
  CheckSquareOutlined, FormOutlined, UnorderedListOutlined,
  PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { QuestionType } from '../../types';
import RichTextEditor from './RichTextEditor';

const { Text, Title } = Typography;

const TEMPLATES: { type: QuestionType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'single',
    label: 'Trắc nghiệm (1 đáp án)',
    desc: 'Học sinh chọn 1 đáp án đúng',
    icon: <UnorderedListOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
  },
  {
    type: 'multiple',
    label: 'Trắc nghiệm (nhiều đáp án)',
    desc: 'Học sinh chọn tất cả đáp án đúng',
    icon: <CheckSquareOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
  },
  {
    type: 'essay',
    label: 'Câu hỏi tự luận',
    desc: 'Học sinh trả lời bằng văn bản tự do',
    icon: <FormOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
  },
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
    setOptions([
      { id: '1', text: '', isCorrect: false },
      { id: '2', text: '', isCorrect: false },
      { id: '3', text: '', isCorrect: false },
      { id: '4', text: '', isCorrect: false },
    ]);
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
      width={660}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      <Steps
        current={step}
        size="small"
        style={{ margin: '16px 0 24px' }}
        items={[
          { title: 'Chọn dạng câu hỏi' },
          { title: 'Soạn nội dung' },
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map((t) => (
                <Radio key={t.type} value={t.type} style={{ width: '100%', margin: 0 }}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: selectedType === t.type ? '2px solid #1677ff' : '1px solid #d9d9d9',
                      background: selectedType === t.type ? '#e6f4ff' : '#fff',
                      marginLeft: 8,
                    }}
                    styles={{ body: { padding: '10px 14px' } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {t.icon}
                      <div>
                        <Text strong>{t.label}</Text>
                        <div>
                          <Text type="secondary" style={{ fontSize: 13 }}>{t.desc}</Text>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Radio>
              ))}
            </div>
          </Radio.Group>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="primary" onClick={() => setStep(1)}>Tiếp theo →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Write question */}
      {step === 1 && (
        <div>
          {/* Question content editor */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              Nội dung câu hỏi
            </Text>
            <RichTextEditor
              key={`question-editor-${open}`}
              onChange={setContent}
              placeholder="Nhập nội dung câu hỏi tại đây..."
              minHeight={100}
              initialValue={content}
            />
          </div>

          {/* Options (MCQ) */}
          {selectedType !== 'essay' && (
            <div>
              <Divider>
                <Text strong style={{ fontSize: 13 }}>Các lựa chọn</Text>
              </Divider>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {options.map((opt, idx) => (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedType === 'single' ? (
                      <Radio checked={opt.isCorrect} onChange={() => toggleCorrect(opt.id)} />
                    ) : (
                      <Checkbox checked={opt.isCorrect} onChange={() => toggleCorrect(opt.id)} />
                    )}
                    <Title level={5} style={{ margin: 0, minWidth: 20, color: '#1677ff' }}>
                      {LABELS[idx] ?? String(idx + 1)}
                    </Title>
                    <Input
                      placeholder={`Nội dung lựa chọn ${LABELS[idx] ?? String(idx + 1)}`}
                      value={opt.text}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o)),
                        )
                      }
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
                  style={{ marginTop: 10 }}
                >
                  Thêm lựa chọn
                </Button>
              )}
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedType === 'single'
                    ? '● Click radio để đánh dấu đáp án đúng'
                    : '☑ Tick checkbox để đánh dấu các đáp án đúng'}
                </Text>
              </div>
            </div>
          )}

          <Divider style={{ margin: '16px 0 12px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setStep(0)}>← Quay lại</Button>
            <Button
              type="primary"
              onClick={handlePublish}
              disabled={!content.trim()}
            >
              🚀 Phát câu hỏi
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
