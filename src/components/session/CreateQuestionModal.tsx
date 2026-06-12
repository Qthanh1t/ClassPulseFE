import { useState, useRef } from 'react';
import {
  Modal, Steps, Button, Radio, Input, Checkbox, Space,
  Typography, Card, Divider, Switch, Segmented, InputNumber, Tooltip, message,
} from 'antd';
import type { InputRef } from 'antd';
import {
  CheckSquareOutlined, FormOutlined, UnorderedListOutlined,
  PlusOutlined, DeleteOutlined, ClockCircleOutlined, FunctionOutlined,
} from '@ant-design/icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { QuestionType, CreateQuestionRequest } from '../../types/api';
import RichTextEditor from './RichTextEditor';

const { Text } = Typography;

const TEMPLATES: { type: QuestionType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'single',
    label: 'Trắc nghiệm (1 đáp án)',
    desc: 'Học sinh chọn 1 đáp án đúng',
    icon: <UnorderedListOutlined style={{ fontSize: 24, color: 'var(--sq-primary)' }} />,
  },
  {
    type: 'multiple',
    label: 'Trắc nghiệm (nhiều đáp án)',
    desc: 'Học sinh chọn tất cả đáp án đúng',
    icon: <CheckSquareOutlined style={{ fontSize: 24, color: 'var(--sq-emerald)' }} />,
  },
  {
    type: 'essay',
    label: 'Câu hỏi tự luận',
    desc: 'Học sinh trả lời bằng văn bản tự do',
    icon: <FormOutlined style={{ fontSize: 24, color: 'var(--sq-amber)' }} />,
  },
];

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

const PRESET_DURATIONS = [30, 60, 90, 120, 180];
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── LaTeX inline helpers ─────────────────────────────────────────────────────

type Segment = { text: string; isLatex: boolean; display: boolean };

function parseMixedLatex(text: string): Segment[] {
  const parts: Segment[] = [];
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isLatex: false, display: false });
    if (m[1] !== undefined) parts.push({ text: m[1], isLatex: true, display: true });
    else parts.push({ text: m[2], isLatex: true, display: false });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isLatex: false, display: false });
  return parts;
}

function KatexSpan({ latex, display }: { latex: string; display: boolean }) {
  try {
    const html = katex.renderToString(latex, { displayMode: display, throwOnError: true });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (e) {
    return (
      <span style={{ color: 'var(--sq-rose)', fontSize: 11, fontStyle: 'italic' }}>
        [Lỗi: {(e as Error).message.split('\n')[0]}]
      </span>
    );
  }
}

interface OptionRowProps {
  opt: Option;
  idx: number;
  selectedType: QuestionType;
  canRemove: boolean;
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
}

function OptionRow({ opt, idx, selectedType, canRemove, onToggle, onTextChange, onRemove }: OptionRowProps) {
  const inputRef = useRef<InputRef>(null);
  const hasLatex = opt.text.includes('$');
  const segments = hasLatex ? parseMixedLatex(opt.text) : [];

  const insertLatex = () => {
    const el = inputRef.current?.input;
    if (!el) return;
    const start = el.selectionStart ?? opt.text.length;
    const end = el.selectionEnd ?? opt.text.length;
    const selected = opt.text.slice(start, end);
    const formula = selected || 'x';
    const newText = `${opt.text.slice(0, start)}$${formula}$${opt.text.slice(end)}`;
    onTextChange(newText);
    setTimeout(() => {
      el.setSelectionRange(start + 1, start + 1 + formula.length);
      el.focus();
    }, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {selectedType === 'single' ? (
          <Radio checked={opt.isCorrect} onChange={onToggle} />
        ) : (
          <Checkbox checked={opt.isCorrect} onChange={onToggle} />
        )}
        <span style={{ fontWeight: 600, minWidth: 20, color: 'var(--sq-primary)', fontSize: 14 }}>
          {LABELS[idx] ?? String(idx + 1)}
        </span>
        <Input
          ref={inputRef}
          placeholder={`Nội dung lựa chọn ${LABELS[idx] ?? String(idx + 1)}`}
          value={opt.text}
          onChange={(e) => onTextChange(e.target.value)}
          style={{ flex: 1 }}
          suffix={
            <Tooltip title="Chèn công thức LaTeX ($...$)">
              <Button
                size="small"
                type="text"
                icon={<FunctionOutlined style={{ color: 'var(--sq-primary)', fontSize: 13 }} />}
                onClick={insertLatex}
                style={{ padding: '0 2px' }}
              />
            </Tooltip>
          }
        />
        {canRemove && (
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
        )}
      </div>
      {hasLatex && segments.length > 0 && (
        <div style={{
          marginLeft: 56,
          padding: '4px 10px',
          background: 'var(--sq-surface-2)',
          border: '1px solid var(--sq-border)',
          borderRadius: 6,
          fontSize: 13,
          lineHeight: '1.6',
        }}>
          {segments.map((seg, i) =>
            seg.isLatex
              ? <KatexSpan key={i} latex={seg.text} display={seg.display} />
              : <span key={i}>{seg.text}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (req: CreateQuestionRequest) => void;
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
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerPreset, setTimerPreset] = useState<number | 'custom'>(60);
  const [timerCustom, setTimerCustom] = useState<number>(60);

  const timerSeconds: number | null = timerEnabled
    ? (timerPreset === 'custom' ? timerCustom : timerPreset)
    : null;

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
    setTimerEnabled(false);
    setTimerPreset(60);
    setTimerCustom(60);
    onClose();
  };

  const handlePublish = () => {
    if (selectedType !== 'essay') {
      const filledOptions = options.filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        void message.error('Cần ít nhất 2 lựa chọn có nội dung.');
        return;
      }
      const hasCorrect = filledOptions.some((o) => o.isCorrect);
      if (!hasCorrect) {
        void message.error('Phải chọn ít nhất 1 đáp án đúng (click vào radio/checkbox bên cạnh đáp án đúng).');
        return;
      }
    }
    const req: CreateQuestionRequest = {
      type: selectedType,
      content,
      ...(timerSeconds !== null ? { timerSeconds } : {}),
      ...(selectedType !== 'essay' ? {
        options: options
          .filter((o) => o.text.trim())
          .map((o, i) => ({ label: LABELS[i] ?? String(i + 1), text: o.text, isCorrect: o.isCorrect })),
      } : {}),
    };
    handleClose();
    onSubmit(req);
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
                      border: selectedType === t.type ? '2px solid var(--sq-primary)' : '1px solid var(--sq-border)',
                      background: selectedType === t.type ? 'var(--sq-primary-light)' : '#fff',
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
              uploadPurpose="question_attachment"
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
                  <OptionRow
                    key={opt.id}
                    opt={opt}
                    idx={idx}
                    selectedType={selectedType}
                    canRemove={options.length > 2}
                    onToggle={() => toggleCorrect(opt.id)}
                    onTextChange={(text) =>
                      setOptions((prev) => prev.map((o) => (o.id === opt.id ? { ...o, text } : o)))
                    }
                    onRemove={() => removeOption(opt.id)}
                  />
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

          {/* Timer settings */}
          <Divider style={{ margin: '16px 0 12px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: timerEnabled ? 12 : 0 }}>
              <ClockCircleOutlined style={{ color: timerEnabled ? 'var(--sq-primary)' : 'var(--sq-text-secondary)' }} />
              <Text strong style={{ fontSize: 13, flex: 1 }}>Giới hạn thời gian</Text>
              <Switch
                checked={timerEnabled}
                onChange={setTimerEnabled}
                checkedChildren="Bật"
                unCheckedChildren="Tắt"
              />
            </div>

            {timerEnabled && (
              <div style={{ paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Segmented
                  value={timerPreset}
                  onChange={(v) => setTimerPreset(v as number | 'custom')}
                  options={[
                    ...PRESET_DURATIONS.map((s) => ({
                      value: s,
                      label: s < 60 ? `${s}s` : `${s / 60}p`,
                    })),
                    { value: 'custom', label: 'Tùy chỉnh' },
                  ]}
                />
                {timerPreset === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <InputNumber
                      min={10}
                      max={600}
                      value={timerCustom}
                      onChange={(v) => setTimerCustom(v ?? 60)}
                      style={{ width: 100 }}
                    />
                    <Text type="secondary" style={{ fontSize: 13 }}>giây</Text>
                  </div>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Câu hỏi sẽ tự kết thúc sau{' '}
                  <Text strong style={{ fontSize: 12 }}>
                    {timerPreset === 'custom'
                      ? `${timerCustom} giây`
                      : timerPreset < 60
                        ? `${timerPreset} giây`
                        : `${timerPreset / 60} phút`}
                  </Text>
                </Text>
              </div>
            )}
          </div>

          <Divider style={{ margin: '12px 0' }} />

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
