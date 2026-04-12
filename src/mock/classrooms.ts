import type { Classroom, Post, Schedule } from '../types';

export const CLASSROOMS: Classroom[] = [
  {
    id: 'c1',
    name: 'Lập trình Web nâng cao',
    description: 'Khóa học chuyên sâu về React, TypeScript và các công nghệ frontend hiện đại.',
    teacherName: 'Nguyễn Thị Lan',
    studentCount: 8,
    nextSchedule: 'Thứ 2, 14/04 — 8:00',
    subject: 'Frontend',
  },
  {
    id: 'c2',
    name: 'Cơ sở dữ liệu',
    description: 'SQL nâng cao, thiết kế schema, tối ưu truy vấn và PostgreSQL.',
    teacherName: 'Nguyễn Thị Lan',
    studentCount: 6,
    nextSchedule: 'Thứ 3, 15/04 — 13:30',
    subject: 'Database',
  },
  {
    id: 'c3',
    name: 'Kiến trúc phần mềm',
    description: 'Design patterns, microservices, clean architecture và các nguyên tắc SOLID.',
    teacherName: 'Nguyễn Thị Lan',
    studentCount: 5,
    nextSchedule: 'Thứ 6, 18/04 — 9:00',
    subject: 'Architecture',
  },
];

export const POSTS: Post[] = [
  {
    id: 'p1',
    classroomId: 'c1',
    authorName: 'Nguyễn Thị Lan',
    authorRole: 'teacher',
    content: 'Chào mừng các bạn đến với lớp học! Buổi học tiếp theo chúng ta sẽ tìm hiểu về React Server Components và các pattern mới trong React 19. Các bạn hãy đọc trước tài liệu nhé.',
    createdAt: '2026-04-10 09:00',
  },
  {
    id: 'p2',
    classroomId: 'c1',
    authorName: 'Nguyễn Văn An',
    authorRole: 'student',
    content: 'Thầy/cô ơi, em có thể hỏi thêm về useCallback và useMemo được không ạ? Em vẫn chưa rõ khi nào nên dùng.',
    createdAt: '2026-04-10 10:30',
  },
  {
    id: 'p3',
    classroomId: 'c1',
    authorName: 'Nguyễn Thị Lan',
    authorRole: 'teacher',
    content: 'Bạn An hỏi rất hay! Buổi tới mình sẽ dành 15 phút đầu để giải thích rõ về memoization. Các bạn khác cũng nên note lại câu hỏi này.',
    createdAt: '2026-04-10 11:00',
  },
  {
    id: 'p4',
    classroomId: 'c1',
    authorName: 'Trần Thị Bình',
    authorRole: 'student',
    content: 'Em đã đọc tài liệu về RSC rồi ạ. Khá thú vị, nhưng em còn nhiều điểm chưa hiểu về streaming và Suspense.',
    createdAt: '2026-04-11 08:00',
  },
];

export const SCHEDULES: Schedule[] = [
  {
    id: 'sch1',
    classroomId: 'c1',
    title: 'Buổi 1: React Hooks nâng cao',
    date: '2026-04-07',
    startTime: '08:00',
    endTime: '10:00',
    description: 'useCallback, useMemo, useReducer, custom hooks',
  },
  {
    id: 'sch2',
    classroomId: 'c1',
    title: 'Buổi 2: State Management',
    date: '2026-04-09',
    startTime: '08:00',
    endTime: '10:00',
    description: 'Context API, Zustand, so sánh với Redux',
  },
  {
    id: 'sch3',
    classroomId: 'c1',
    title: 'Buổi 3: React 19 & RSC',
    date: '2026-04-14',
    startTime: '08:00',
    endTime: '10:00',
    description: 'React Server Components, Suspense, streaming SSR',
  },
  {
    id: 'sch4',
    classroomId: 'c1',
    title: 'Buổi 4: Performance Optimization',
    date: '2026-04-16',
    startTime: '08:00',
    endTime: '10:00',
    description: 'Code splitting, lazy loading, profiling',
  },
];
