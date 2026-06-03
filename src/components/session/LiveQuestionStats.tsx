import { Progress, Typography, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { QuestionStatsDto, QuestionType } from '../../types/api';

const { Text } = Typography;

interface Props {
  stats: QuestionStatsDto;
  questionType: QuestionType;
}

export default function LiveQuestionStats({ stats, questionType }: Props) {
  const { totalStudents, answeredCount, correctCount } = stats;
  const wrongCount = answeredCount - correctCount;

  const optionChartData = stats.optionDistribution.map((d) => ({
    name: d.label,
    count: d.count,
    isCorrect: d.isCorrect,
    fullText: d.text,
  }));

  const confidenceData = [
    { name: 'Cao', count: stats.confidenceBreakdown.high, color: '#0ea672' },
    { name: 'TB', count: stats.confidenceBreakdown.medium, color: '#e08c0b' },
    { name: 'Thấp', count: stats.confidenceBreakdown.low, color: '#e23d6d' },
  ];

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Overall progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text strong style={{ fontSize: 13 }}>Tiến độ trả lời</Text>
          <Text style={{ fontSize: 13 }}>
            <span style={{ color: '#4f46e5', fontWeight: 600 }}>{answeredCount}</span>
            <span style={{ color: '#57534e' }}>/{totalStudents} học sinh</span>
          </Text>
        </div>
        <Progress
          percent={totalStudents > 0 ? Math.round((answeredCount / totalStudents) * 100) : 0}
          strokeColor="#4f46e5"
          size="small"
        />
      </div>

      {/* Correct / Wrong (only for MCQ) */}
      {questionType !== 'essay' && answeredCount > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              background: '#e7f6ef',
              border: '1px solid #a7e3cd',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircleOutlined style={{ color: '#0ea672', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, lineHeight: 1 }}>{correctCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đúng ({answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%)
              </Text>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: '#fceaef',
              border: '1px solid #f6c6d4',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CloseCircleOutlined style={{ color: '#e23d6d', fontSize: 18 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 20, lineHeight: 1 }}>{wrongCount}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sai ({answeredCount > 0 ? Math.round((wrongCount / answeredCount) * 100) : 0}%)
              </Text>
            </div>
          </div>
        </div>
      )}

      {/* Per-option breakdown with BarChart */}
      {questionType !== 'essay' && optionChartData.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            Phân bố đáp án
          </Text>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={optionChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <RechartTooltip
                formatter={(value: unknown, _name: unknown, props: { payload?: { fullText?: string } }) => [
                  `${String(value)} học sinh`,
                  props.payload?.fullText ?? '',
                ]}
                labelFormatter={(label) => `Đáp án ${label}`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {optionChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isCorrect ? '#0ea672' : '#ef6c8d'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            {optionChartData.map((opt) => {
              const pct = totalStudents > 0 ? Math.round((opt.count / totalStudents) * 100) : 0;
              return (
                <div key={opt.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: opt.isCorrect ? '#0ea672' : '#e7e3dc',
                      border: '1px solid',
                      borderColor: opt.isCorrect ? '#a7e3cd' : '#e7e3dc',
                      fontSize: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: opt.isCorrect ? '#0ea672' : '#57534e',
                      fontWeight: 600,
                    }}
                  />
                  <Text style={{ fontSize: 11, color: '#57534e' }}>
                    {opt.name}: {opt.count} ({pct}%)
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidence breakdown */}
      {answeredCount > 0 && (
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
            Mức độ tự tin
          </Text>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {confidenceData.map(({ name, count, color }) => (
              <Tooltip key={name} title={`${name}: ${count} học sinh`}>
                <div
                  style={{
                    flex: 1,
                    background: `${color}18`,
                    borderRadius: 8,
                    padding: '8px 4px',
                    textAlign: 'center',
                    border: `1px solid ${color}44`,
                    cursor: 'default',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 18, color }}>{count}</div>
                  <Text style={{ fontSize: 11, color }}>{name}</Text>
                </div>
              </Tooltip>
            ))}
          </div>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
            {confidenceData.map(({ name, count, color }) => (
              <div
                key={name}
                style={{
                  flex: count,
                  background: color,
                  minWidth: count > 0 ? 4 : 0,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
