import { color, radius } from '../../theme/tokens';

/**
 * Composed empty state — an icon medallion, a direct headline, supporting
 * copy and an optional call-to-action. Used in place of blank screens.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: compact ? '32px 20px' : '56px 24px',
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: color.primaryLight,
          color: color.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color.text }}>{title}</div>
      {description && (
        <div
          style={{
            fontSize: 13.5,
            color: color.textSecondary,
            marginTop: 6,
            maxWidth: 420,
            lineHeight: 1.55,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
