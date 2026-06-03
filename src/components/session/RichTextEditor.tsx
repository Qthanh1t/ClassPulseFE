import { useState, useRef, useCallback, useEffect, useMemo, useId } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Autoformat,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  FontSize,
  List,
  Indent,
  IndentBlock,
  Alignment,
  Image,
  ImageCaption,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  ImageResize,
  FileRepository,
  Paragraph,
  PasteFromOffice,
  Link,
  GeneralHtmlSupport,
  Plugin,
  Widget,
  toWidget,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Modal, Input, Switch, Button, Tooltip, message } from 'antd';
import { FunctionOutlined, PaperClipOutlined } from '@ant-design/icons';

// ── Upload endpoints ─────────────────────────────────────────────────────────
const UPLOAD_IMAGE_URL = '/api/upload/image';
const UPLOAD_FILE_URL  = '/api/upload/file';

// ── Image upload adapter ─────────────────────────────────────────────────────
function createUploadAdapter(loader: { file: Promise<File | null> }) {
  return {
    upload: async (): Promise<{ default: string }> => {
      const file = await loader.file;
      if (!file) throw new Error('No file');
      try {
        const fd = new FormData();
        fd.append('upload', file);
        const res = await fetch(UPLOAD_IMAGE_URL, { method: 'POST', body: fd });
        if (res.ok) return { default: ((await res.json()) as { url: string }).url };
      } catch { /* fallback below */ }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const r = e.target?.result;
          if (typeof r === 'string') resolve({ default: r });
          else reject(new Error('read'));
        };
        reader.onerror = () => reject(new Error('read'));
        reader.readAsDataURL(file);
      });
    },
    abort: (): void => { /* intentional no-op */ },
  };
}

function UploadAdapterPlugin(editor: {
  plugins: { get(n: string): { createUploadAdapter: typeof createUploadAdapter } };
}) {
  editor.plugins.get('FileRepository').createUploadAdapter = createUploadAdapter;
}

// ────────────────────────────────────────────────────────────────────────────
// MathPlugin — custom CKEditor 5 plugin that stores LaTeX in the model and
// renders KaTeX directly onto the DOM via createRawElement, completely
// bypassing the model↔view data pipeline that was mangling the HTML.
// ────────────────────────────────────────────────────────────────────────────
function renderKatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, {
    output: 'html',
    displayMode,
    throwOnError: false,
  });
}

class MathPlugin extends Plugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static get requires(): any[] { return [Widget]; }
  static get pluginName(): string { return 'MathPlugin'; }

  init(): void {
    const { editor } = this;

    // 1. Register the model element
    editor.model.schema.register('mathFormula', {
      allowWhere: '$text',
      isObject: true,
      isInline: true,
      allowAttributes: ['latex', 'displayMode'],
    });

    // 2. Model → editing view  (what the user sees while editing)
    //
    //    toWidget() requires a ContainerElement — it rejects RawElement.
    //    We put a UIElement inside the ContainerElement by passing it as the
    //    children array argument, which avoids writer.insert() inside the
    //    callback (that call triggered GeneralHtmlSupport to recast the
    //    ContainerElement as a RawElement before toWidget saw it).
    //    UIElement is ideal here: CKEditor renders it once via toDomElement
    //    and never overwrites its innerHTML on subsequent view syncs.
    editor.conversion.for('editingDowncast').elementToElement({
      model: {
        name: 'mathFormula',
        attributes: ['latex', 'displayMode'],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view: (modelElement: any, { writer }: any) => {
        const latex       = String(modelElement.getAttribute('latex') ?? '');
        const displayMode = Boolean(modelElement.getAttribute('displayMode'));
        const style = displayMode
          ? 'display:block;text-align:center;margin:12px 0;overflow-x:auto;'
          : 'display:inline-block;vertical-align:middle;';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inner = writer.createUIElement('span', {}, function(this: any, domDocument: Document) {
          const el: HTMLElement = this.toDomElement(domDocument);
          el.innerHTML = renderKatex(latex, displayMode);
          return el;
        });

        // Pass inner as children array — avoids writer.insert() inside conversion
        const container = writer.createContainerElement(
          'span',
          {
            class: `sq-math ${displayMode ? 'sq-math-block' : 'sq-math-inline'}`,
            'data-latex': encodeURIComponent(latex),
            style,
          },
          [inner],
        );

        return toWidget(container, writer, { label: 'Công thức toán' });
      },
    });

    // 3. Model → data HTML  (what getData() / saved content returns)
    editor.conversion.for('dataDowncast').elementToElement({
      model: {
        name: 'mathFormula',
        attributes: ['latex', 'displayMode'],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view: (modelElement: any, { writer }: any) => {
        const latex       = String(modelElement.getAttribute('latex') ?? '');
        const displayMode = Boolean(modelElement.getAttribute('displayMode'));
        return writer.createRawElement(
          'span',
          {
            class: `sq-math ${displayMode ? 'sq-math-block' : 'sq-math-inline'}`,
            'data-latex': encodeURIComponent(latex),
          },
          (domElement: HTMLElement) => {
            domElement.style.cssText = displayMode
              ? 'display:block;text-align:center;margin:12px 0;overflow-x:auto;'
              : 'display:inline-block;vertical-align:middle;';
            domElement.innerHTML = renderKatex(latex, displayMode);
          },
        );
      },
    });

    // 4. Data HTML → model  (loads previously saved content back into the editor)
    editor.conversion.for('upcast').elementToElement({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view: (element: any) => element.name === 'span' && element.hasClass('sq-math'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: (viewElement: any, { writer }: any) => {
        const latex       = decodeURIComponent(viewElement.getAttribute('data-latex') ?? '');
        const displayMode = viewElement.hasClass('sq-math-block');
        return writer.createElement('mathFormula', { latex, displayMode });
      },
    });
  }
}

// ── Attachment type ──────────────────────────────────────────────────────────
export interface Attachment {
  name: string;
  url: string;
  size: string;
  ext: string;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onChange: (html: string) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  placeholder?: string;
  minHeight?: number;
  initialValue?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function RichTextEditor({
  onChange,
  onAttachmentsChange,
  placeholder = 'Nhập nội dung...',
  minHeight = 100,
  initialValue = '',
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef       = useRef<any>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  // Saved before the modal opens so we can restore the cursor position on insert.
  // When the Modal mounts it steals focus → CKEditor clears its selection → insertContent
  // has nowhere to insert → silently does nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedRangesRef  = useRef<any[]>([]);
  // useId gives a stable, unique id without calling Math.random() during render
  const rawId   = useId();
  const scopeId = `sq-ed-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  // ── Math modal ──
  const [mathOpen, setMathOpen] = useState(false);
  const [latex, setLatex]       = useState('');
  const [isBlock, setIsBlock]   = useState(false);

  // Derived synchronously — no useEffect needed, avoids cascading re-renders
  // Use throwOnError: true here so KaTeX throws a real Error with a descriptive
  // message instead of silently rendering an inline red span.
  const { mathPreview, mathError } = useMemo(() => {
    if (!latex.trim()) return { mathPreview: '', mathError: '' };
    try {
      const html = katex.renderToString(latex, {
        output: 'html',
        displayMode: isBlock,
        throwOnError: true,
      });
      return { mathPreview: html, mathError: '' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi LaTeX';
      return { mathPreview: '', mathError: msg };
    }
  }, [latex, isBlock]);

  // ── Debounced onChange (300 ms auto-save) ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleEditorChange = useCallback(
    (_evt: unknown, editor: { getData(): string }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const html = editor.getData();
        onChange(html === '<p></p>' ? '' : html);
      }, 300);
    },
    [onChange],
  );

  // ── Open math modal: snapshot selection BEFORE focus leaves the editor ──
  const handleOpenMath = useCallback(() => {
    if (editorRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const editor: any = editorRef.current;
      // Clone each range so position objects remain valid after focus moves away
      savedRangesRef.current = [...editor.model.document.selection.getRanges()].map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r.clone(),
      );
    }
    setMathOpen(true);
  }, []);

  // ── Insert math — creates a model element; MathPlugin downcasts it ──
  const handleInsertMath = useCallback(() => {
    if (!latex.trim() || mathError || !editorRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editor: any = editorRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.model.change((writer: any) => {
      // Restore the cursor position that existed before the modal stole focus
      if (savedRangesRef.current.length > 0) {
        writer.setSelection(savedRangesRef.current);
      } else {
        // Fallback: append to the last paragraph
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const root = editor.model.document.getRoot() as any;
        if (root?.childCount > 0) {
          writer.setSelection(root.getChild(root.childCount - 1), 'end');
        }
      }
      const el = writer.createElement('mathFormula', { latex, displayMode: isBlock });
      editor.model.insertContent(el);
    });
    setMathOpen(false);
    setLatex('');
  }, [latex, isBlock, mathError]);

  // ── Attachments (rendered outside the editor, non-editable) ──
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const next = prev.filter((_, i) => i !== index);
      onAttachmentsChange?.(next);
      return next;
    });
  }, [onAttachmentsChange]);

  const handleFileAttach = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'zip'];
    if (!allowed.includes(ext)) {
      message.error('Định dạng không hỗ trợ. Chấp nhận: PDF, DOCX, XLSX, PPTX, TXT, ZIP');
      return;
    }
    let url = '';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(UPLOAD_FILE_URL, { method: 'POST', body: fd });
      if (res.ok) url = ((await res.json()) as { url: string }).url;
    } catch { /* ignore */ }
    if (!url) url = URL.createObjectURL(file);

    const size = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / 1024 / 1024).toFixed(1)} MB`;

    setAttachments(prev => {
      const next = [...prev, { name: file.name, url, size, ext }];
      onAttachmentsChange?.(next);
      return next;
    });
  }, [onAttachmentsChange]);

  // ── Editor config ────────────────────────────────────────────────────────
  const editorConfig = useMemo(() => ({
    licenseKey: 'GPL',
    plugins: [
      Essentials, Autoformat,
      Bold, Italic, Underline, Strikethrough,
      FontSize,
      Paragraph,
      List,
      Indent, IndentBlock,
      Alignment,
      Image, ImageCaption, ImageStyle, ImageToolbar, ImageUpload, ImageResize,
      FileRepository,
      PasteFromOffice,
      Link,
      GeneralHtmlSupport,
      MathPlugin,
    ],
    extraPlugins: [UploadAdapterPlugin],
    toolbar: {
      items: [
        'fontSize', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'bulletedList', 'numberedList', 'indent', 'outdent', '|',
        'alignment', '|',
        'uploadImage', 'link', '|',
        'undo', 'redo',
      ],
    },
    fontSize: {
      options: [
        { title: 'Nhỏ',  model: 'sq-size-small',  view: { name: 'span', classes: 'sq-size-small'  } },
        { title: 'Vừa',  model: 'sq-size-normal',  view: { name: 'span', classes: 'sq-size-normal' } },
        { title: 'Lớn',  model: 'sq-size-large',   view: { name: 'span', classes: 'sq-size-large'  } },
      ],
    },
    image: {
      toolbar: [
        'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
        'toggleImageCaption', 'imageTextAlternative', '|',
        'resizeImage',
      ],
      resizeOptions: [
        { name: 'resizeImage:original', value: null as string | null, label: 'Gốc' },
        { name: 'resizeImage:50',       value: '50',                  label: '50%' },
        { name: 'resizeImage:75',       value: '75',                  label: '75%' },
      ],
      resizeUnit: '%' as const,
    },
    alignment: {
      options: ['left', 'center', 'right', 'justify'] as Array<'left' | 'center' | 'right' | 'justify'>,
    },
    indentBlock: { offset: 40, unit: 'px' },
    htmlSupport: {
      allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
    },
    placeholder,
  }), [placeholder]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        /* ── Container chrome ── */
        #${scopeId} .ck.ck-editor      { border:none; box-shadow:none !important; border-radius:0; }
        #${scopeId} .ck.ck-toolbar     { border:none !important; border-radius:0 !important; background:#f3f1ec; border-bottom:1px solid #e7e3dc !important; }
        #${scopeId} .ck-editor__main > .ck-editor__editable {
          min-height:${minHeight}px;
          border:none !important;
          box-shadow:none !important;
          border-radius:0 !important;
          padding:8px 12px;
          line-height:1.7;
          font-size:14px;
        }
        #${scopeId} .ck-editor__editable:focus { outline:none; }
        #${scopeId} .ck-powered-by { display:none !important; }

        /* ── Fix: Tailwind v4 preflight sets list-style:none; padding:0 ── */
        #${scopeId} .ck-editor__editable ul { list-style-type:disc    !important; padding-left:2em !important; }
        #${scopeId} .ck-editor__editable ol { list-style-type:decimal !important; padding-left:2em !important; }
        #${scopeId} .ck-editor__editable ul ul    { list-style-type:circle !important; }
        #${scopeId} .ck-editor__editable ul ul ul { list-style-type:square !important; }
        #${scopeId} .ck-editor__editable li { display:list-item !important; }

        /* ── Font size classes ── */
        #${scopeId} .ck-editor__editable .sq-size-small  { font-size:12px !important; }
        #${scopeId} .ck-editor__editable .sq-size-normal { font-size:14px !important; }
        #${scopeId} .ck-editor__editable .sq-size-large  { font-size:18px !important; }

        /* ── Math widget: give the widget a hover outline so users know it's selectable ── */
        #${scopeId} .ck-editor__editable .sq-math.ck-widget { outline:none; cursor:default; }
        #${scopeId} .ck-editor__editable .sq-math.ck-widget.ck-widget_selected { outline:2px solid #4f46e5; border-radius:3px; }
      `}</style>

      {/* Math modal */}
      <Modal
        title="Chèn công thức toán học"
        open={mathOpen}
        onCancel={() => { setMathOpen(false); setLatex(''); }}
        onOk={handleInsertMath}
        okText="Chèn vào"
        cancelText="Huỷ"
        okButtonProps={{
          disabled: !latex.trim() || !!mathError,
          style: { background: '#4f46e5', border: 'none' },
        }}
        width={520}
        destroyOnHidden
      >
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#57534e' }}>Inline</span>
          <Switch size="small" checked={isBlock} onChange={setIsBlock} />
          <span style={{ fontSize: 13, color: '#57534e' }}>Block (dòng riêng)</span>
        </div>

        <Input.TextArea
          value={latex}
          onChange={e => setLatex(e.target.value)}
          placeholder={`Ví dụ: \\frac{a}{b} + \\sqrt{c^2 + 1}`}
          autoSize={{ minRows: 2, maxRows: 6 }}
          style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 12 }}
          autoFocus
        />

        {/* Live preview */}
        <div style={{
          minHeight: 52,
          padding: '10px 14px',
          border: `1px solid ${mathError ? '#f1a8bd' : '#e7e3dc'}`,
          borderRadius: 8,
          background: mathError ? '#fceaef' : '#f3f1ec',
          overflowX: 'auto',
          transition: 'border-color 0.2s, background 0.2s',
        }}>
          {mathError
            ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#e23d6d', fontSize: 12, fontWeight: 600 }}>
                  Lỗi cú pháp LaTeX
                </span>
                <code style={{
                  color: '#be123c',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  fontFamily: 'monospace',
                }}>
                  {mathError}
                </code>
              </div>
            )
            : mathPreview
              ? <span dangerouslySetInnerHTML={{ __html: mathPreview }} />
              : <span style={{ color: '#a8a29e', fontSize: 13 }}>Xem trước công thức...</span>
          }
        </div>
      </Modal>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.zip"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFileAttach(f);
          e.target.value = '';
        }}
      />

      {/* ── Editor wrapper ── */}
      <div
        id={scopeId}
        style={{
          border: '1px solid #e7e3dc',
          borderRadius: 8,
          overflow: 'clip',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocus={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = '#4f46e5';
          el.style.boxShadow   = '0 0 0 2px rgba(79,70,229,0.15)';
        }}
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            const el = e.currentTarget as HTMLDivElement;
            el.style.borderColor = '#e7e3dc';
            el.style.boxShadow   = 'none';
          }
        }}
      >
        {/* Extension toolbar: Math + File attach */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '4px 8px',
          background: '#f3f1ec',
          borderBottom: '1px solid #e7e3dc',
        }}>
          <Tooltip title="Chèn công thức LaTeX / KaTeX" mouseEnterDelay={0.5}>
            <Button
              size="small"
              type="text"
              icon={<FunctionOutlined />}
              onClick={handleOpenMath}
              style={{ borderRadius: 4, fontSize: 12, color: '#57534e' }}
            >
              Math
            </Button>
          </Tooltip>
          <Tooltip title="Đính kèm file (PDF, DOCX, XLSX…)" mouseEnterDelay={0.5}>
            <Button
              size="small"
              type="text"
              icon={<PaperClipOutlined />}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 4, fontSize: 12, color: '#57534e' }}
            >
              Đính kèm
            </Button>
          </Tooltip>
        </div>

        {/* CKEditor */}
        <CKEditor
          editor={ClassicEditor}
          data={initialValue}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config={editorConfig as any}
          onReady={(editor) => {
            editorRef.current = editor;
            // Tab key: route to indent/outdent commands
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor as any).editing.view.document.on(
              'keydown',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (evt: any, data: any) => {
                if (data.keyCode !== 9) return; // only Tab
                const shift = data.shiftKey;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cmd = (editor as any).commands;
                if (!shift && cmd.get('indentList')?.isEnabled) {
                  editor.execute('indentList');  evt.stop(); data.preventDefault();
                } else if (shift && cmd.get('outdentList')?.isEnabled) {
                  editor.execute('outdentList'); evt.stop(); data.preventDefault();
                } else if (!shift && cmd.get('indent')?.isEnabled) {
                  editor.execute('indent');      evt.stop(); data.preventDefault();
                } else if (shift && cmd.get('outdent')?.isEnabled) {
                  editor.execute('outdent');     evt.stop(); data.preventDefault();
                }
              },
              { priority: 'high' },
            );
          }}
          onChange={handleEditorChange}
        />

        {/* Attachment list — outside editor, non-editable */}
        {attachments.length > 0 && (
          <div style={{
            borderTop: '1px solid #e7e3dc',
            padding: '8px 10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}>
            {attachments.map((att, i) => {
              const iconMap: Record<string, string> = {
                pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
                pptx: '📊', ppt: '📊', zip: '🗜️', txt: '📄',
              };
              const icon = iconMap[att.ext] ?? '📎';
              return (
                <div
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px 4px 6px',
                    border: '1px solid #e7e3dc',
                    borderRadius: 6,
                    background: '#f3f1ec',
                    fontSize: 12,
                    maxWidth: 260,
                  }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#4f46e5',
                      fontWeight: 500,
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={att.name}
                  >
                    {att.name}
                  </a>
                  <span style={{ color: '#a8a29e', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {att.size}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(i)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: '#a8a29e',
                      padding: '0 0 0 2px',
                      fontSize: 14,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    aria-label="Xoá đính kèm"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
