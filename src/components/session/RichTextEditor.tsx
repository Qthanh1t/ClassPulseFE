import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Button, Divider, Select, Tooltip } from 'antd';
import {
  BoldOutlined, ItalicOutlined, UnderlineOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined,
} from '@ant-design/icons';

interface Props {
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  initialValue?: string;
}

type SizeValue = 'paragraph' | 'h3' | 'h2' | 'h1';

const SIZE_OPTIONS: { value: SizeValue; label: string }[] = [
  { value: 'paragraph', label: 'Thường' },
  { value: 'h3', label: 'Lớn vừa' },
  { value: 'h2', label: 'Lớn' },
  { value: 'h1', label: 'Rất lớn' },
];

export default function RichTextEditor({
  onChange,
  placeholder = 'Nhập nội dung...',
  minHeight = 100,
  initialValue = '',
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialValue,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  if (!editor) return null;

  // ── Toolbar helper ──
  const ToolbarBtn = ({
    active,
    onClick,
    title,
    icon,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    icon: React.ReactNode;
  }) => (
    <Tooltip title={title} mouseEnterDelay={0.6}>
      <Button
        size="small"
        type={active ? 'primary' : 'text'}
        icon={icon}
        onMouseDown={(e) => {
          e.preventDefault(); // prevent editor blur
          onClick();
        }}
        style={{
          borderRadius: 4,
          padding: '0 6px',
        }}
      />
    </Tooltip>
  );

  // Current size value for the Select
  const currentSize: SizeValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'paragraph';

  const handleSizeChange = (val: SizeValue) => {
    if (val === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = val === 'h1' ? 1 : val === 'h2' ? 2 : 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  return (
    <div
      className="sq-editor"
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1677ff';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
      }}
      onBlur={(e) => {
        // only reset if focus left the entire container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#d9d9d9';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 8px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          flexWrap: 'wrap',
        }}
      >
        {/* Format */}
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Đậm (Ctrl+B)"
          icon={<BoldOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Nghiêng (Ctrl+I)"
          icon={<ItalicOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Gạch chân (Ctrl+U)"
          icon={<UnderlineOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Gạch ngang"
          icon={<StrikethroughOutlined />}
        />

        <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />

        {/* Size */}
        <Select
          size="small"
          value={currentSize}
          style={{ width: 94 }}
          options={SIZE_OPTIONS}
          onMouseDown={(e) => e.preventDefault()}
          onChange={handleSizeChange}
        />

        <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />

        {/* Lists */}
        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Danh sách gạch đầu dòng"
          icon={<UnorderedListOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Danh sách đánh số"
          icon={<OrderedListOutlined />}
        />

        <Divider type="vertical" style={{ height: 16, margin: '0 4px' }} />

        {/* Alignment */}
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Canh trái"
          icon={<AlignLeftOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Canh giữa"
          icon={<AlignCenterOutlined />}
        />
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Canh phải"
          icon={<AlignRightOutlined />}
        />
      </div>

      {/* ── Editor area ── */}
      <div style={{ position: 'relative' }}>
        {editor.isEmpty && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 12,
              color: '#bfbfbf',
              fontSize: 14,
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1.7,
            }}
          >
            {placeholder}
          </div>
        )}
        <EditorContent
          editor={editor}
          style={{ minHeight, padding: '8px 12px', fontSize: 14, cursor: 'text' }}
        />
      </div>
    </div>
  );
}
