import { color } from '../../theme/tokens';

/**
 * Section title + optional subtitle, with a slot for trailing actions.
 * Left-aligned, asymmetric — avoids the centered-everything look.
 */
export default function SectionHeader({
  title,
  subtitle,
  action,
  size = 'md',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            margin: 0,
            fontSize: size === 'lg' ? 22 : 17,
            fontWeight: 700,
            color: color.text,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontSize: 13.5, color: color.textSecondary, marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
