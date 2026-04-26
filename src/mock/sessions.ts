import type { Session } from '../types';
import { QUESTIONS } from './questions';

export const LIVE_SESSION: Session = {
  id: 'sess1',
  classroomId: 'c1',
  classroomName: 'Lập trình Web nâng cao',
  teacherName: 'Nguyễn Thị Lan',
  date: '2026-04-14',
  questions: QUESTIONS,
  breakoutGroups: [
    {
      id: 'bg1',
      name: 'Nhóm 1',
      studentIds: ['s1', 's2', 's3'],
      task: 'Thảo luận: So sánh useCallback vs useMemo và cho ví dụ thực tế',
    },
    {
      id: 'bg2',
      name: 'Nhóm 2',
      studentIds: ['s4', 's5', 's6'],
      task: 'Thảo luận: Khi nào nên dùng Context API thay vì prop drilling?',
    },
    {
      id: 'bg3',
      name: 'Nhóm 3',
      studentIds: ['s7', 's8'],
      task: 'Thảo luận: Viết custom hook đơn giản để fetch dữ liệu',
    },
  ],
  silentStudentIds: ['s7'],
};
