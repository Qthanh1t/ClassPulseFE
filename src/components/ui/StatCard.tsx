import { color, radius } from '../../theme/tokens';

/**
 * Metric card: icon medallion + label + tabular value. Flat surface with a
 * thin border; elevation only appears on hover (see .sq-stat-card).
 */
export default function StatCard({
  title,
  value,
  icon,
  accent = color.primary,
  tint = color.primaryLight,
  suffix,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  tint?: string;
  suffix?: string;
}) {
  return (
    <div
      className="sq-stat-card"
      style={{
        background: color.surface,
        borderRadius: radius.card,
        border: `1px solid ${color.border}`,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background: tint,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 21,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            color: color.textMuted,
            fontWeight: 600,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </div>
        <div
          className="sq-nums"
          style={{ fontSize: 23, fontWeight: 700, color: color.text, lineHeight: 1.15 }}
        >
          {value}
          {suffix && (
            <span style={{ fontSize: 14, fontWeight: 500, color: color.textSecondary, marginLeft: 2 }}>
              {suffix}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
