import type { User } from '../types';

export const STUDENTS: User[] = [
  { id: 's1', name: 'Nguyễn Văn An', role: 'student', avatarColor: '#1677ff' },
  { id: 's2', name: 'Trần Thị Bình', role: 'student', avatarColor: '#52c41a' },
  { id: 's3', name: 'Lê Minh Cường', role: 'student', avatarColor: '#fa8c16' },
  { id: 's4', name: 'Phạm Thị Dung', role: 'student', avatarColor: '#eb2f96' },
  { id: 's5', name: 'Hoàng Văn Em', role: 'student', avatarColor: '#722ed1' },
  { id: 's6', name: 'Vũ Thị Phương', role: 'student', avatarColor: '#13c2c2' },
  { id: 's7', name: 'Đặng Văn Giang', role: 'student', avatarColor: '#f5222d' },
  { id: 's8', name: 'Bùi Thị Hoa', role: 'student', avatarColor: '#fadb14' },
];

export const TEACHER: User = {
  id: 't1',
  name: 'Nguyễn Thị Lan',
  role: 'teacher',
  avatarColor: '#1677ff',
};
