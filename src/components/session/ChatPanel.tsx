import { useState, useRef, useEffect } from 'react';
import { Avatar, Button, Input, Typography } from 'antd';
import { SendOutlined, CloseOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatarColor: string;
  avatarUrl?: string;
  content: string;
  time: string;
  isTeacher?: boolean;
}

interface Props {
  messages: ChatMessage[];
  currentUser: {
    id: string;
    name: string;
    avatarColor: string;
    isTeacher?: boolean;
  };
  onSend: (text: string) => void;
  onClose: () => void;
  height?: string | number;
}

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'c1',
    senderId: 't1',
    senderName: 'Nguyễn Thị Lan',
    avatarColor: '#4f46e5',
    content: 'Chào cả lớp! Hôm nay chúng ta sẽ ôn tập React Hooks nhé.',
    time: '14:00',
    isTeacher: true,
  },
  {
    id: 'c2',
    senderId: 's2',
    senderName: 'Trần Thị Bình',
    avatarColor: '#0ea672',
    content: 'Thầy ơi, useEffect chạy mấy lần ạ?',
    time: '14:02',
  },
  {
    id: 'c3',
    senderId: 't1',
    senderName: 'Nguyễn Thị Lan',
    avatarColor: '#4f46e5',
    content: 'useEffect chạy sau mỗi render, điều khiển bằng dependency array nhé!',
    time: '14:03',
    isTeacher: true,
  },
  {
    id: 'c4',
    senderId: 's4',
    senderName: 'Phạm Thị Dung',
    avatarColor: '#e23d6d',
    content: '👍 Em hiểu rồi ạ, cảm ơn thầy!',
    time: '14:04',
  },
  {
    id: 'c5',
    senderId: 's1',
    senderName: 'Nguyễn Văn An',
    avatarColor: '#4f46e5',
    content: 'Thầy ơi, custom hook khác component ở chỗ nào vậy ạ?',
    time: '14:06',
  },
];

function getNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatPanel({ messages, currentUser, onSend, onClose, height = '100%' }: Props) {
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    onSend(text);
    setInputText('');
  };

  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid #e7e3dc',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e7e3dc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 14 }}>💬 Chat</Text>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg) => {
          const isSelf = msg.senderId === currentUser.id;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isSelf ? 'row-reverse' : 'row',
                gap: 8,
                alignItems: 'flex-end',
              }}
            >
              {!isSelf && (
                <Avatar
                  size={28}
                  src={msg.avatarUrl ?? undefined}
                  style={{ background: msg.avatarColor, flexShrink: 0, fontSize: 12 }}
                >
                  {msg.senderName.charAt(0)}
                </Avatar>
              )}
              <div style={{ maxWidth: '72%' }}>
                {!isSelf && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: msg.isTeacher ? '#4f46e5' : '#57534e',
                      display: 'block',
                      marginBottom: 2,
                      fontWeight: msg.isTeacher ? 600 : 400,
                    }}
                  >
                    {msg.senderName.split(' ').slice(-1)[0]}
                    {msg.isTeacher && ' (GV)'}
                  </Text>
                )}
                <div
                  style={{
                    background: isSelf ? '#4f46e5' : msg.isTeacher ? '#eceafd' : '#f3f1ec',
                    color: isSelf ? '#fff' : '#1c1917',
                    padding: '7px 11px',
                    borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: 13,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#a8a29e',
                    display: 'block',
                    marginTop: 2,
                    textAlign: isSelf ? 'right' : 'left',
                  }}
                >
                  {msg.time}
                </Text>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid #e7e3dc',
          display: 'flex',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <Input
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onPressEnter={handleSend}
          style={{ borderRadius: 20, fontSize: 13 }}
          size="small"
        />
        <Button
          type="primary"
          shape="circle"
          size="small"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!inputText.trim()}
        />
      </div>
    </div>
  );
}

export { getNow };
