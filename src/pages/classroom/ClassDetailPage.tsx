import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar, Button, Card, Dropdown, Empty, Form, Input,
  Modal, Popconfirm, Spin, Table, Tabs, Tag, TimePicker, Tooltip, Typography, Upload, message,
} from 'antd';
import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd';
import {
  ArrowLeftOutlined, CalendarOutlined, PlayCircleOutlined,
  TeamOutlined, MessageOutlined, BookOutlined,
  CodeOutlined, DatabaseOutlined, ApartmentOutlined,
  ClockCircleOutlined, CheckCircleOutlined, PlusOutlined, SendOutlined,
  FolderOpenOutlined, DownloadOutlined, UploadOutlined, PaperClipOutlined,
  DeleteOutlined, EditOutlined, MoreOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { classroomService } from '../../services/classroom.service';
import { postService } from '../../services/post.service';
import { scheduleService } from '../../services/schedule.service';
import { documentService } from '../../services/document.service';
import { useAuthStore } from '../../store/authStore';
import type { ClassroomDto, PostDto, ScheduleDto, MemberDto, DocumentDto } from '../../types/api';
import RichTextEditor from '../../components/session/RichTextEditor';

const { Title, Text } = Typography;

interface SubjectStyle { gradient: string; icon: React.ReactNode }

const SUBJECT_STYLE: Record<string, SubjectStyle> = {
  Frontend: { gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', icon: <CodeOutlined style={{ fontSize: 28, color: '#fff' }} /> },
  Database: { gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)', icon: <DatabaseOutlined style={{ fontSize: 28, color: '#fff' }} /> },
  Architecture: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)', icon: <ApartmentOutlined style={{ fontSize: 28, color: '#fff' }} /> },
};
const DEFAULT_STYLE: SubjectStyle = {
  gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  icon: <BookOutlined style={{ fontSize: 28, color: '#fff' }} />,
};

const FILE_ICON: Record<string, string> = {
  pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
  pptx: '📊', ppt: '📊', zip: '🗜️', txt: '📄',
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ClassDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [messageApi, contextHolder] = message.useMessage();

  // ── Data state ──
  const [cls, setCls] = useState<ClassroomDto | null>(null);
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [documents, setDocuments] = useState<DocumentDto[]>([]);

  // ── Loading state ──
  const [clsLoading, setClsLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);

  // ── Post compose ──
  const [composing, setComposing] = useState(false);
  const [postHtml, setPostHtml] = useState('');
  const [postFiles, setPostFiles] = useState<UploadFile[]>([]);
  const [posting, setPosting] = useState(false);

  // ── Post edit ──
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostHtml, setEditPostHtml] = useState('');
  const [editPostSaving, setEditPostSaving] = useState(false);

  // ── Schedule modal (create + edit) ──
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleDto | null>(null);
  const [scheduleForm] = Form.useForm<{
    title: string;
    date: Dayjs;
    startTime: Dayjs;
    endTime: Dayjs;
    description?: string;
  }>();

  // ── Class edit / delete / regen ──
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editClassSaving, setEditClassSaving] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [editClassForm] = Form.useForm<{ name: string; description?: string; subject?: string }>();

  // ── Doc upload ──
  const docFileRef = useRef<HTMLInputElement>(null);
  const [docUploading, setDocUploading] = useState(false);

  const isTeacher = user?.role === 'teacher';

  // ── Load classroom ──
  useEffect(() => {
    classroomService.get(id)
      .then(setCls)
      .catch(() => messageApi.error('Không thể tải thông tin lớp'))
      .finally(() => setClsLoading(false));
  }, [id, messageApi]);

  // ── Load posts ──
  const loadPosts = useCallback(() => {
    setPostsLoading(true);
    postService.list(id)
      .then(({ posts: data }) => setPosts(data))
      .catch(() => messageApi.error('Không thể tải bài đăng'))
      .finally(() => setPostsLoading(false));
  }, [id, messageApi]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── Load schedules ──
  const loadSchedules = useCallback(() => {
    setSchedulesLoading(true);
    scheduleService.list(id)
      .then(setSchedules)
      .catch(() => messageApi.error('Không thể tải lịch học'))
      .finally(() => setSchedulesLoading(false));
  }, [id, messageApi]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // ── Load members (lazy) ──
  const loadMembers = useCallback(() => {
    if (members.length > 0) return;
    setMembersLoading(true);
    classroomService.getMembers(id)
      .then(setMembers)
      .catch(() => messageApi.error('Không thể tải danh sách thành viên'))
      .finally(() => setMembersLoading(false));
  }, [id, members.length, messageApi]);

  // ── Load documents (lazy) ──
  const loadDocuments = useCallback(() => {
    if (documents.length > 0) return;
    setDocsLoading(true);
    documentService.list(id)
      .then(({ documents: data }) => setDocuments(data))
      .catch(() => messageApi.error('Không thể tải tài liệu'))
      .finally(() => setDocsLoading(false));
  }, [id, documents.length, messageApi]);

  // ── Submit post ──
  async function handlePostSubmit() {
    const stripped = postHtml.replace(/<[^>]*>/g, '').trim();
    if (!stripped && postFiles.length === 0) return;
    setPosting(true);
    try {
      const created = await postService.create(id, { content: postHtml });
      if (postFiles.length > 0) {
        const rawFiles = postFiles.map((f) => f.originFileObj as File).filter(Boolean);
        if (rawFiles.length > 0) {
          const uploaded = await postService.addAttachments(id, created.id, rawFiles);
          created.attachments = uploaded;
        }
      }
      setPosts((prev) => [created, ...prev]);
      setPostHtml('');
      setPostFiles([]);
      setComposing(false);
      messageApi.success('Đã đăng bài!');
    } catch {
      messageApi.error('Đăng bài thất bại');
    } finally {
      setPosting(false);
    }
  }

  // ── Update post ──
  async function handleUpdatePost(postId: string) {
    const stripped = editPostHtml.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;
    setEditPostSaving(true);
    try {
      const updated = await postService.update(id, postId, { content: editPostHtml });
      setPosts((prev) => prev.map((p) => p.id === postId ? updated : p));
      setEditingPostId(null);
      messageApi.success('Đã cập nhật bài đăng!');
    } catch {
      messageApi.error('Cập nhật bài đăng thất bại');
    } finally {
      setEditPostSaving(false);
    }
  }

  // ── Delete post ──
  async function handleDeletePost(postId: string) {
    try {
      await postService.remove(id, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      messageApi.success('Đã xóa bài đăng');
    } catch {
      messageApi.error('Xóa bài đăng thất bại');
    }
  }

  // ── Submit schedule (create + edit) ──
  async function handleScheduleSubmit() {
    try {
      const values = await scheduleForm.validateFields();
      setScheduleSaving(true);
      const body = {
        title: values.title,
        scheduledDate: values.date.format('YYYY-MM-DD'),
        startTime: values.startTime.format('HH:mm:ss'),
        endTime: values.endTime.format('HH:mm:ss'),
        description: values.description,
      };
      if (editingSchedule) {
        const updated = await scheduleService.update(id, editingSchedule.id, body);
        setSchedules((prev) =>
          prev.map((s) => s.id === editingSchedule.id ? updated : s)
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
        );
        messageApi.success('Đã cập nhật buổi học!');
      } else {
        const created = await scheduleService.create(id, body);
        setSchedules((prev) => [...prev, created].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)));
        messageApi.success('Đã thêm lịch học!');
      }
      scheduleForm.resetFields();
      setScheduleOpen(false);
      setEditingSchedule(null);
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      messageApi.error(editingSchedule ? 'Cập nhật buổi học thất bại' : 'Thêm lịch học thất bại');
    } finally {
      setScheduleSaving(false);
    }
  }

  // ── Delete schedule ──
  async function handleDeleteSchedule(scheduleId: string) {
    try {
      await scheduleService.remove(id, scheduleId);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      messageApi.success('Đã xóa buổi học');
    } catch {
      messageApi.error('Xóa buổi học thất bại');
    }
  }

  function openEditSchedule(s: ScheduleDto) {
    scheduleForm.setFieldsValue({
      title: s.title,
      date: dayjs(s.scheduledDate),
      startTime: dayjs(`2000-01-01 ${s.startTime}`),
      endTime: dayjs(`2000-01-01 ${s.endTime}`),
      description: s.description ?? undefined,
    });
    setEditingSchedule(s);
    setScheduleOpen(true);
  }

  // ── Update class ──
  async function handleUpdateClass(values: { name: string; description?: string; subject?: string }) {
    setEditClassSaving(true);
    try {
      const updated = await classroomService.update(id, values);
      setCls(updated);
      setEditClassOpen(false);
      messageApi.success('Đã cập nhật lớp học!');
    } catch {
      messageApi.error('Cập nhật lớp học thất bại');
    } finally {
      setEditClassSaving(false);
    }
  }

  // ── Delete class ──
  async function handleDeleteClass() {
    try {
      await classroomService.remove(id);
      messageApi.success('Đã xóa lớp học');
      navigate('/classes');
    } catch {
      messageApi.error('Xóa lớp học thất bại');
    }
  }

  // ── Regenerate join code ──
  async function handleRegenCode() {
    setRegenLoading(true);
    try {
      const { joinCode: newCode } = await classroomService.regenerateJoinCode(id);
      setCls((prev) => prev ? { ...prev, joinCode: newCode } : prev);
      messageApi.success('Đã tạo mã mới!');
    } catch {
      messageApi.error('Tạo mã mới thất bại');
    } finally {
      setRegenLoading(false);
    }
  }

  // ── Upload document ──
  async function handleDocFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setDocUploading(true);
    try {
      const uploaded = await documentService.upload(id, files);
      setDocuments((prev) => [...uploaded, ...prev]);
      messageApi.success(`Đã tải lên ${uploaded.length} tài liệu!`);
    } catch {
      messageApi.error('Tải lên tài liệu thất bại');
    } finally {
      setDocUploading(false);
      e.target.value = '';
    }
  }

  // ── Delete document ──
  async function handleDeleteDoc(docId: string) {
    try {
      await documentService.remove(id, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      messageApi.success('Đã xóa tài liệu');
    } catch {
      messageApi.error('Xóa tài liệu thất bại');
    }
  }

  // ── Kick member ──
  async function handleKickMember(studentId: string) {
    try {
      await classroomService.kickMember(id, studentId);
      setMembers((prev) => prev.filter((m) => m.id !== studentId));
      messageApi.success('Đã xóa thành viên');
    } catch {
      messageApi.error('Xóa thành viên thất bại');
    }
  }

  const style = SUBJECT_STYLE[cls?.subject ?? ''] ?? DEFAULT_STYLE;
  const today = new Date().toISOString().slice(0, 10);

  const tabItems = [
    {
      key: 'feed',
      label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MessageOutlined /><span>Bảng tin</span></div>,
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          {/* Compose box */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: 16 }}>
            {!composing ? (
              <div onClick={() => setComposing(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'text' }}>
                <Avatar size={36} src={user?.avatarUrl ?? undefined} style={{ background: user?.avatarColor ?? 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0, fontSize: 14, fontWeight: 600 }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, padding: '8px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 14, userSelect: 'none' }}>
                  Thông báo gì đó cho lớp...
                </div>
              </div>
            ) : (
              <div>
                <RichTextEditor onChange={setPostHtml} placeholder="Thông báo gì đó cho lớp..." minHeight={120} />
                <div style={{ marginTop: 8 }}>
                  <Upload
                    fileList={postFiles}
                    onChange={({ fileList }) => setPostFiles(fileList)}
                    beforeUpload={() => false}
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.zip"
                    showUploadList={{ showPreviewIcon: false, showDownloadIcon: false, showRemoveIcon: true }}
                  >
                    <Button icon={<PaperClipOutlined />} size="small" style={{ borderRadius: 6, color: '#6366f1', borderColor: '#c7d2fe' }}>
                      Đính kèm file
                    </Button>
                  </Upload>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                  <Button onClick={() => { setComposing(false); setPostHtml(''); setPostFiles([]); }} style={{ borderRadius: 8 }}>Hủy</Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={posting}
                    onClick={handlePostSubmit}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, borderRadius: 8 }}
                  >
                    Đăng bài
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Post list */}
          {postsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : posts.length === 0 ? (
            <Empty description="Chưa có bài đăng nào" style={{ padding: '32px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {posts.map((post) => {
                const canManage = isTeacher || user?.id === post.author.id;
                const isEditing = editingPostId === post.id;

                return (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Avatar
                        size={36}
                        src={(post.author as { avatarUrl?: string }).avatarUrl ?? undefined}
                        style={{
                          background: post.author.role === 'teacher' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)',
                          flexShrink: 0, fontSize: 14, fontWeight: 600,
                        }}
                      >
                        {post.author.name.charAt(0)}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{post.author.name}</Text>
                          {post.author.role === 'teacher' && (
                            <Tag color="blue" style={{ fontSize: 11, borderRadius: 20, padding: '0 8px', margin: 0 }}>Giáo viên</Tag>
                          )}
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                            {new Date(post.createdAt).toLocaleString('vi-VN')}
                          </Text>
                          {canManage && !isEditing && (
                            <Dropdown
                              menu={{
                                items: [
                                  { key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined /> },
                                  {
                                    key: 'delete',
                                    label: (
                                      <Popconfirm
                                        title="Xóa bài đăng này?"
                                        onConfirm={() => handleDeletePost(post.id)}
                                        okText="Xóa"
                                        cancelText="Hủy"
                                        okButtonProps={{ danger: true }}
                                      >
                                        <span style={{ color: '#f43f5e' }}>Xóa bài</span>
                                      </Popconfirm>
                                    ),
                                    icon: <DeleteOutlined style={{ color: '#f43f5e' }} />,
                                  },
                                ],
                                onClick: ({ key }) => {
                                  if (key === 'edit') {
                                    setEditPostHtml(post.content);
                                    setEditingPostId(post.id);
                                  }
                                },
                              }}
                              trigger={['click']}
                            >
                              <Button type="text" size="small" icon={<MoreOutlined />} style={{ color: '#94a3b8' }} onClick={(e) => e.stopPropagation()} />
                            </Dropdown>
                          )}
                        </div>

                        {isEditing ? (
                          <div>
                            <RichTextEditor
                              key={post.id}
                              initialValue={post.content}
                              onChange={setEditPostHtml}
                              minHeight={100}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                              <Button size="small" onClick={() => setEditingPostId(null)} style={{ borderRadius: 6 }}>Hủy</Button>
                              <Button
                                size="small"
                                type="primary"
                                loading={editPostSaving}
                                onClick={() => handleUpdatePost(post.id)}
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 6 }}
                              >
                                Lưu
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="ck-content" style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: post.content }} />
                        )}

                        {!isEditing && post.attachments.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {post.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 8px', border: '1px solid #c7d2fe', borderRadius: 6, background: '#eef2ff', fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}
                              >
                                <span style={{ fontSize: 14 }}>{FILE_ICON[att.fileExt] ?? '📎'}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{att.fileName}</span>
                                <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 2 }}>{formatBytes(att.fileSizeBytes)}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'schedule',
      label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarOutlined /><span>Lịch học</span></div>,
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          {isTeacher && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditingSchedule(null); scheduleForm.resetFields(); setScheduleOpen(true); }}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, borderRadius: 8 }}
              >
                Thêm buổi học
              </Button>
            </div>
          )}

          {schedulesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : schedules.length === 0 ? (
            <Empty description="Chưa có lịch học nào" style={{ padding: '32px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedules.map((s) => {
                const isPast = s.scheduledDate < today;
                return (
                  <div key={s.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: isPast ? 0.65 : 1, borderLeft: `4px solid ${isPast ? '#e2e8f0' : '#6366f1'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: isPast ? '#f8fafc' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isPast ? <CheckCircleOutlined style={{ color: '#94a3b8', fontSize: 18 }} /> : <CalendarOutlined style={{ color: '#6366f1', fontSize: 18 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 3 }}>{s.title}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CalendarOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(s.scheduledDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </Text>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ClockCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>{s.startTime} – {s.endTime}</Text>
                          </div>
                        </div>
                        {s.description && <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>{s.description}</Text>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!isPast ? (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={() => navigate(`/session/teacher/${id}`)}
                          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, borderRadius: 8 }}
                        >
                          Vào học
                        </Button>
                      ) : (
                        <>
                          <Tag color="default" style={{ borderRadius: 6, margin: 0 }}>Đã xong</Tag>
                          {s.sessionId && (
                            <Button size="small" onClick={() => navigate(`/dashboard/${s.sessionId}`)} style={{ borderRadius: 6, fontSize: 12, color: '#6366f1', borderColor: '#c7d2fe' }}>
                              Xem kết quả →
                            </Button>
                          )}
                        </>
                      )}
                      {isTeacher && (
                        <>
                          <Tooltip title="Chỉnh sửa">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => openEditSchedule(s)}
                              style={{ color: '#6366f1' }}
                            />
                          </Tooltip>
                          <Tooltip title="Xóa">
                            <Popconfirm
                              title="Xóa buổi học này?"
                              onConfirm={() => handleDeleteSchedule(s.id)}
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'members',
      label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TeamOutlined /><span>Thành viên{members.length > 0 ? ` (${members.length})` : ''}</span></div>,
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          {membersLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : (
            <Table
              dataSource={members}
              rowKey="id"
              pagination={false}
              size="middle"
              style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}
              locale={{ emptyText: <Empty description="Chưa có thành viên" /> }}
              columns={[
                {
                  title: 'Thành viên',
                  key: 'name',
                  render: (_, m) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={34} style={{ background: m.avatarColor ?? '#6366f1', fontWeight: 600, fontSize: 13 }}>
                        {m.name.charAt(0)}
                      </Avatar>
                      <Text style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{m.name}</Text>
                    </div>
                  ),
                },
                {
                  title: 'Vai trò',
                  key: 'role',
                  width: 120,
                  render: (_, m) => (
                    <Tag color={m.role === 'teacher' ? 'blue' : 'default'} style={{ borderRadius: 20, padding: '0 10px', fontSize: 12 }}>
                      {m.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                    </Tag>
                  ),
                },
                {
                  title: 'Ngày tham gia',
                  key: 'joinedAt',
                  width: 140,
                  render: (_, m) => (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {new Date(m.joinedAt).toLocaleDateString('vi-VN')}
                    </Text>
                  ),
                },
                ...(isTeacher ? [{
                  title: '',
                  key: 'action',
                  width: 48,
                  render: (_: unknown, m: MemberDto) => m.role === 'student' ? (
                    <Tooltip title="Xóa thành viên">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleKickMember(m.id)}
                      />
                    </Tooltip>
                  ) : null,
                }] : []),
              ]}
            />
          )}
        </div>
      ),
    },
    {
      key: 'docs',
      label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FolderOpenOutlined /><span>Tài liệu</span></div>,
      children: (
        <div style={{ maxWidth: 640, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Tài liệu lớp học</Text>
              <div><Text type="secondary" style={{ fontSize: 12 }}>Tài liệu từ bài đăng và tải lên trực tiếp</Text></div>
            </div>
            {isTeacher && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={docUploading}
                onClick={() => docFileRef.current?.click()}
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600, borderRadius: 8 }}
              >
                Tải lên
              </Button>
            )}
          </div>

          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
          ) : documents.length === 0 ? (
            <Empty description="Chưa có tài liệu nào" style={{ padding: '32px 0' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {FILE_ICON[doc.fileExt] ?? '📎'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{formatBytes(doc.fileSizeBytes)}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(doc.uploadedAt).toLocaleDateString('vi-VN')}
                      </Text>
                      <Tag
                        color={doc.source === 'post' ? 'blue' : 'green'}
                        style={{ fontSize: 11, borderRadius: 4, margin: 0, padding: '0 6px' }}
                      >
                        {doc.source === 'post' ? 'Đăng bài' : 'Tải lên trực tiếp'}
                      </Tag>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <Tooltip title="Tải xuống">
                      <Button size="small" type="text" icon={<DownloadOutlined />} href={doc.url} target="_blank" style={{ color: '#6366f1' }} />
                    </Tooltip>
                    {isTeacher && doc.source === 'direct' && (
                      <Tooltip title="Xóa">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDoc(doc.id)} />
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  if (clsLoading) {
    return (
      <div style={{ padding: '28px 32px', display: 'flex', justifyContent: 'center', paddingTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!cls) {
    return (
      <div style={{ padding: '28px 32px' }}>
        <Empty description="Không tìm thấy lớp học" />
        <Button onClick={() => navigate('/classes')} style={{ marginTop: 16 }}>Quay lại</Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      {contextHolder}

      {/* Hero banner */}
      <div style={{ background: style.gradient, borderRadius: 20, padding: '24px 28px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -50, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/classes')}
          style={{ marginBottom: 16, color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', borderRadius: 8, fontWeight: 500 }}
        >
          Quay lại
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, background: 'rgba(255,255,255,0.18)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              {style.icon}
            </div>
            <div>
              {cls.subject && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 2, fontWeight: 500 }}>{cls.subject}</div>}
              <Title level={3} style={{ color: '#fff', margin: '0 0 4px', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{cls.name}</Title>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <TeamOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{cls.studentCount} học sinh</span>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <BookOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }} />
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{cls.teacher.name}</span>
                </div>
                {isTeacher && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      Mã: {cls.joinCode}
                    </span>
                    <Tooltip title="Tạo mã mới">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={regenLoading}
                        onClick={handleRegenCode}
                        style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      />
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={() => navigate(isTeacher ? `/session/teacher/${cls.id}` : `/session/student/${cls.id}`)}
              style={{ background: '#fff', color: '#6366f1', border: 'none', fontWeight: 700, borderRadius: 12, height: 44, paddingInline: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
            >
              {isTeacher ? 'Bắt đầu buổi học' : 'Vào học'}
            </Button>
            {isTeacher && (
              <Dropdown
                menu={{
                  items: [
                    { key: 'edit', label: 'Chỉnh sửa lớp', icon: <EditOutlined /> },
                    { key: 'regen', label: 'Tạo mã tham gia mới', icon: <ReloadOutlined /> },
                    { type: 'divider' },
                    {
                      key: 'delete',
                      label: (
                        <Popconfirm
                          title="Xóa lớp học này?"
                          description="Tất cả dữ liệu lớp sẽ bị xóa vĩnh viễn."
                          onConfirm={handleDeleteClass}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                        >
                          <span style={{ color: '#f43f5e' }}>Xóa lớp học</span>
                        </Popconfirm>
                      ),
                      icon: <DeleteOutlined style={{ color: '#f43f5e' }} />,
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'edit') {
                      editClassForm.setFieldsValue({ name: cls.name, description: cls.description ?? '', subject: cls.subject ?? '' });
                      setEditClassOpen(true);
                    }
                    if (key === 'regen') handleRegenCode();
                  },
                }}
                trigger={['click']}
              >
                <Button
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 10, height: 44, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  <MoreOutlined style={{ fontSize: 18 }} />
                </Button>
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      {/* Tabs card */}
      <Card
        style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
        styles={{ body: { padding: '0 24px 24px' } }}
      >
        <Tabs
          items={tabItems}
          defaultActiveKey="feed"
          onChange={(key) => {
            if (key === 'members') loadMembers();
            if (key === 'docs') loadDocuments();
          }}
        />
      </Card>

      {/* Schedule modal (create + edit) */}
      <Modal
        title={
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            {editingSchedule ? 'Chỉnh sửa buổi học' : 'Thêm buổi học mới'}
          </div>
        }
        open={scheduleOpen}
        onCancel={() => { setScheduleOpen(false); setEditingSchedule(null); scheduleForm.resetFields(); }}
        onOk={handleScheduleSubmit}
        okText={editingSchedule ? 'Lưu thay đổi' : 'Lưu lịch'}
        cancelText="Hủy"
        confirmLoading={scheduleSaving}
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 } }}
        width={480}
      >
        <Form form={scheduleForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="Tiêu đề buổi học" name="title" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
            <Input placeholder="VD: Buổi 5: TypeScript nâng cao" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item label="Ngày học" name="date" rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}>
            <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item label="Giờ bắt đầu" name="startTime" rules={[{ required: true, message: 'Bắt buộc' }]} style={{ flex: 1 }}>
              <TimePicker style={{ width: '100%', borderRadius: 8 }} format="HH:mm" minuteStep={5} placeholder="08:00" />
            </Form.Item>
            <Form.Item label="Giờ kết thúc" name="endTime" rules={[{ required: true, message: 'Bắt buộc' }]} style={{ flex: 1 }}>
              <TimePicker style={{ width: '100%', borderRadius: 8 }} format="HH:mm" minuteStep={5} placeholder="10:00" />
            </Form.Item>
          </div>
          <Form.Item label="Mô tả (tùy chọn)" name="description">
            <Input.TextArea placeholder="Nội dung buổi học, tài liệu cần chuẩn bị..." rows={3} style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit class modal */}
      <Modal
        title={<div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Chỉnh sửa lớp học</div>}
        open={editClassOpen}
        onCancel={() => { setEditClassOpen(false); editClassForm.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={editClassForm} layout="vertical" style={{ marginTop: 8 }} onFinish={handleUpdateClass}>
          <Form.Item name="name" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Tên lớp học</span>} rules={[{ required: true, message: 'Vui lòng nhập tên lớp' }]}>
            <Input style={{ height: 40, borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Mô tả</span>}>
            <Input.TextArea rows={3} style={{ borderRadius: 10 }} />
          </Form.Item>
          <Form.Item name="subject" label={<span style={{ fontWeight: 600, fontSize: 13 }}>Môn học</span>}>
            <Input placeholder="VD: Frontend, Database, ..." style={{ height: 40, borderRadius: 10 }} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => { setEditClassOpen(false); editClassForm.resetFields(); }} style={{ borderRadius: 10 }}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={editClassSaving}
              style={{ borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', fontWeight: 600 }}
            >
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Hidden file input */}
      <input
        ref={docFileRef}
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.zip"
        multiple
        style={{ display: 'none' }}
        onChange={handleDocFileChange}
      />
    </div>
  );
}
