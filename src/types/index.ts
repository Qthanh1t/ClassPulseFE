export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatarColor?: string;
}

export interface Classroom {
  id: string;
  name: string;
  description: string;
  teacherName: string;
  studentCount: number;
  nextSchedule?: string;
  subject: string;
}

export interface Post {
  id: string;
  classroomId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface Schedule {
  id: string;
  classroomId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export type QuestionType = 'single' | 'multiple' | 'essay';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface StudentAnswer {
  studentId: string;
  selectedOptions: string[]; // option ids, empty = no answer
  essayText?: string;
  confidence: ConfidenceLevel | null;
  answeredAt?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  answers: StudentAnswer[]; // mock answers from students
}

export type SessionState = 'idle' | 'question_running' | 'question_ended' | 'breakout_active';

export interface BreakoutGroup {
  id: string;
  name: string;
  studentIds: string[];
  task?: string;
}

export interface Session {
  id: string;
  classroomId: string;
  classroomName: string;
  teacherName: string;
  date: string;
  questions: Question[];
  breakoutGroups?: BreakoutGroup[];
  silentStudentIds: string[];
}
