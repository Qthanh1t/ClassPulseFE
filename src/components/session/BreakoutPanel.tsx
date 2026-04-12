import { Avatar, Badge, Button, Card, Collapse, Input, Modal, Tag, Typography } from 'antd';
import { TeamOutlined, MessageOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { BreakoutGroup } from '../../types';
import { STUDENTS } from '../../mock/students';

const { Text, Title } = Typography;

interface Props {
  groups: BreakoutGroup[];
  onClose: () => void;
}

export default function BreakoutPanel({ groups, onClose }: Props) {
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');

  return (
    <div style={{ padding: '0 0 16px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ color: '#1677ff' }} />
          <Title level={5} style={{ margin: 0 }}>Breakout Rooms</Title>
          <Badge count={groups.length} color="#1677ff" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<MessageOutlined />}
            onClick={() => setBroadcastOpen(true)}
          >
            Thông báo cả lớp
          </Button>
          <Button size="small" danger onClick={onClose}>
            Kết thúc breakout
          </Button>
        </div>
      </div>

      <Collapse
        size="small"
        defaultActiveKey={groups.map((g) => g.id)}
        items={groups.map((group) => ({
          key: group.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>{group.name}</Text>
              <Tag color="blue">{group.studentIds.length} học sinh</Tag>
              <Badge status="processing" text={<Text style={{ fontSize: 12, color: '#52c41a' }}>Đang thảo luận</Text>} />
            </div>
          ),
          children: (
            <div>
              {/* Members */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {group.studentIds.map((sid) => {
                  const s = STUDENTS.find((st) => st.id === sid);
                  return s ? (
                    <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Avatar size={24} style={{ background: s.avatarColor, fontSize: 11 }}>
                        {s.name.charAt(0)}
                      </Avatar>
                      <Text style={{ fontSize: 12 }}>{s.name.split(' ').pop()}</Text>
                    </div>
                  ) : null;
                })}
              </div>

              {/* Task */}
              {group.task && (
                <Card
                  size="small"
                  style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8 }}
                  styles={{ body: { padding: '8px 12px' } }}
                >
                  <Text style={{ fontSize: 12 }}>
                    <span style={{ color: '#1677ff', fontWeight: 600 }}>Nhiệm vụ: </span>
                    {group.task}
                  </Text>
                </Card>
              )}
            </div>
          ),
        }))}
      />

      {/* Broadcast modal */}
      <Modal
        title={<><MessageOutlined style={{ color: '#1677ff', marginRight: 8 }} />Thông báo đến tất cả nhóm</>}
        open={broadcastOpen}
        onCancel={() => setBroadcastOpen(false)}
        onOk={() => setBroadcastOpen(false)}
        okText="Gửi thông báo"
      >
        <Input.TextArea
          rows={3}
          placeholder="VD: Còn 5 phút nữa, chuẩn bị báo cáo kết quả..."
          value={broadcastMsg}
          onChange={(e) => setBroadcastMsg(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
