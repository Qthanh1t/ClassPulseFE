import { useState } from 'react';
import {
  Avatar, Badge, Button, Card, Divider, Segmented, Tag, Tooltip,
  Typography, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlusCircleOutlined,
  PlayCircleOutlined, StopOutlined, CheckCircleOutlined,
  DesktopOutlined, WarningOutlined, UsergroupAddOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { LIVE_SESSION } from '../../mock/sessions';
import { STUDENTS, TEACHER } from '../../mock/students';
import StudentStatusList from '../../components/session/StudentStatusList';
import LiveQuestionStats from '../../components/session/LiveQuestionStats';
import CreateQuestionModal from '../../components/session/CreateQuestionModal';
import BreakoutPanel from '../../components/session/BreakoutPanel';
import type { Question } from '../../types';
import heroImg from '../../assets/hero.png';

const { Text } = Typography;

type DemoState = 'idle' | 'running' | 'ended' | 'breakout';

const DEMO_LABELS: Record<DemoState, string> = {
  idle: 'Idle (Video)',
  running: 'Câu hỏi đang chạy',
  ended: 'Câu hỏi kết thúc',
  breakout: 'Breakout Room',
};

export default function TeacherSessionPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [demoState, setDemoState] = useState<DemoState>('idle');
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const session = LIVE_SESSION;
  const currentQuestion: Question = session.questions[activeQuestionIdx];

  const handlePublishQuestion = () => {
    setDemoState('running');
  };

  const handleEndQuestion = () => {
    setDemoState('ended');
  };

  const handleNextQuestion = () => {
    setActiveQuestionIdx((prev) => Math.min(prev + 1, session.questions.length - 1));
    setDemoState('idle');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      {/* Top bar */}
      <div
        style={{
          height: 56,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/classes/${id ?? 'c1'}`)}
            type="text"
          />
          <div
            style={{
              width: 28,
              height: 28,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlayCircleOutlined style={{ color: '#fff', fontSize: 14 }} />
          </div>
          <div>
            <Text strong style={{ fontSize: 15 }}>{session.classroomName}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Badge status="processing" />
              <Text type="secondary" style={{ fontSize: 12 }}>Đang diễn ra · {session.date}</Text>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Demo state switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Demo:</Text>
            <Segmented
              size="small"
              value={demoState}
              onChange={(v) => setDemoState(v as DemoState)}
              options={Object.entries(DEMO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
          <Divider type="vertical" />
          <Avatar size={28} style={{ background: '#1677ff' }}>L</Avatar>
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={() => navigate(`/dashboard/${session.id}`)}
          >
            Kết thúc buổi học
          </Button>
        </div>
      </div>

      {/* Silent student alert */}
      {session.silentStudentIds.length > 0 && demoState === 'running' && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message={`${session.silentStudentIds.length} học sinh chưa tương tác trong câu hỏi này`}
          closable
          style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #ffd591' }}
        />
      )}

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
        {/* LEFT: Student list */}
        <div
          style={{
            width: 220,
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <StudentStatusList
            students={STUDENTS}
            answers={demoState === 'idle' ? [] : currentQuestion.answers}
            silentStudentIds={demoState === 'running' ? session.silentStudentIds : []}
            currentQuestionId={demoState !== 'idle' ? currentQuestion.id : undefined}
          />
        </div>

        {/* CENTER: Main content zone */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

          {/* IDLE: Video / screen share placeholder */}
          {demoState === 'idle' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Card style={{ borderRadius: 12, flex: 1, overflow: 'hidden' }} styles={{ body: { padding: 0, height: '100%' } }}>
                <div style={{ position: 'relative', height: '100%', minHeight: 360 }}>
                  <img
                    src={heroImg}
                    alt="Screen share placeholder"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Overlay bar */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      padding: '24px 16px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Avatar size={36} style={{ background: '#1677ff' }}>L</Avatar>
                    <div>
                      <Text strong style={{ color: '#fff', display: 'block' }}>{TEACHER.name}</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DesktopOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                          Đang chia sẻ màn hình
                        </Text>
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <Badge status="processing" text={<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>LIVE</Text>} />
                    </div>
                  </div>
                </div>
              </Card>

              <div style={{ display: 'flex', gap: 8 }}>
                {STUDENTS.slice(0, 4).map((s) => (
                  <Card key={s.id} style={{ borderRadius: 8, flex: 1 }} styles={{ body: { padding: 8 } }}>
                    <div style={{ textAlign: 'center' }}>
                      <Avatar size={32} style={{ background: s.avatarColor, marginBottom: 4 }}>
                        {s.name.charAt(0)}
                      </Avatar>
                      <Text style={{ fontSize: 11, display: 'block' }} ellipsis>
                        {s.name.split(' ').pop()}
                      </Text>
                      <Badge status="processing" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* RUNNING: Question + live stats */}
          {demoState === 'running' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              {/* Question card */}
              <Card style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <Tag color="blue">
                      {currentQuestion.type === 'single' ? 'Trắc nghiệm 1 đáp án'
                        : currentQuestion.type === 'multiple' ? 'Trắc nghiệm nhiều đáp án'
                          : 'Tự luận'}
                    </Tag>
                    <Tag color="orange" style={{ marginLeft: 4 }}>Câu {activeQuestionIdx + 1}/{session.questions.length}</Tag>
                  </div>
                  <Button
                    danger
                    size="small"
                    icon={<StopOutlined />}
                    onClick={handleEndQuestion}
                  >
                    Kết thúc câu hỏi
                  </Button>
                </div>

                <div
                  dangerouslySetInnerHTML={{ __html: currentQuestion.content }}
                  style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, lineHeight: 1.6 }}
                />

                {currentQuestion.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentQuestion.options.map((opt) => (
                      <div
                        key={opt.id}
                        style={{
                          padding: '10px 14px',
                          border: `1px solid ${opt.isCorrect ? '#b7eb8f' : '#d9d9d9'}`,
                          borderRadius: 8,
                          background: opt.isCorrect ? '#f6ffed' : '#fafafa',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Tag color={opt.isCorrect ? 'success' : 'default'} style={{ minWidth: 28, textAlign: 'center' }}>
                          {opt.label}
                        </Tag>
                        <Text>{opt.text}</Text>
                        {opt.isCorrect && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Live stats */}
              <Card style={{ borderRadius: 12 }}>
                <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                  Thống kê thời gian thực
                </Text>
                <LiveQuestionStats question={currentQuestion} />
              </Card>
            </div>
          )}

          {/* ENDED: Full results */}
          {demoState === 'ended' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Card style={{ borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <Text strong style={{ fontSize: 15 }}>Kết quả câu {activeQuestionIdx + 1}</Text>
                  </div>
                  <Button type="primary" onClick={handleNextQuestion} disabled={activeQuestionIdx >= session.questions.length - 1}>
                    Câu tiếp theo →
                  </Button>
                </div>

                <div
                  dangerouslySetInnerHTML={{ __html: currentQuestion.content }}
                  style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}
                />

                <LiveQuestionStats question={currentQuestion} />
              </Card>
            </div>
          )}

          {/* BREAKOUT */}
          {demoState === 'breakout' && session.breakoutGroups && (
            <Card style={{ borderRadius: 12 }}>
              <BreakoutPanel
                groups={session.breakoutGroups}
                onClose={() => setDemoState('idle')}
              />
            </Card>
          )}
        </div>

        {/* RIGHT: Quick Actions */}
        <div
          style={{
            width: 200,
            background: '#fff',
            borderLeft: '1px solid #f0f0f0',
            flexShrink: 0,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Text strong style={{ fontSize: 13 }}>Hành động nhanh</Text>

          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            block
            onClick={() => setCreateOpen(true)}
            disabled={demoState === 'running'}
          >
            Tạo câu hỏi
          </Button>

          <Button
            icon={<UsergroupAddOutlined />}
            block
            onClick={() => setDemoState('breakout')}
          >
            Chia nhóm
          </Button>

          <Divider style={{ margin: '4px 0' }} />

          <Text type="secondary" style={{ fontSize: 12 }}>Câu hỏi trong buổi</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {session.questions.map((q, idx) => (
              <div
                key={q.id}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: idx === activeQuestionIdx && demoState !== 'idle' ? '#e6f4ff' : '#fafafa',
                  border: `1px solid ${idx === activeQuestionIdx && demoState !== 'idle' ? '#91caff' : '#f0f0f0'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => {
                  setActiveQuestionIdx(idx);
                  if (demoState !== 'breakout') setDemoState('running');
                }}
              >
                <Text style={{ fontSize: 12, color: '#8c8c8c', minWidth: 16 }}>{idx + 1}.</Text>
                <Text style={{ fontSize: 12 }} ellipsis>
                  {q.type === 'single' ? '●' : q.type === 'multiple' ? '☑' : '✏'}{' '}
                  Câu {idx + 1}
                </Text>
              </div>
            ))}
          </div>

          <Divider style={{ margin: '4px 0' }} />

          <Tooltip title="Xem kết quả tổng kết">
            <Button
              size="small"
              block
              onClick={() => navigate(`/dashboard/${session.id}`)}
            >
              Xem Dashboard
            </Button>
          </Tooltip>
        </div>
      </div>

      <CreateQuestionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handlePublishQuestion}
      />
    </div>
  );
}
