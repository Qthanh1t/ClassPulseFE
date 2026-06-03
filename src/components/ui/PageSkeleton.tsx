import { color, radius } from '../../theme/tokens';

/**
 * Layout-shaped skeleton loaders (replace generic centered spinners).
 * `variant` picks a shape that roughly matches the page being loaded.
 */
function Block({ h, w = '100%', r = radius.card }: { h: number; w?: number | string; r?: number }) {
  return (
    <div
      className="sq-skeleton"
      style={{ height: h, width: w, borderRadius: r, background: color.surface2 }}
    />
  );
}

export default function PageSkeleton({
  variant = 'cards',
}: {
  variant?: 'cards' | 'detail' | 'table';
}) {
  if (variant === 'detail') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Block h={120} r={radius.page} />
        <Block h={36} w={220} r={radius.control} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <Block h={88} />
          <Block h={88} />
          <Block h={88} />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Block h={120} r={radius.page} />
        <Block h={48} r={radius.control} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} h={52} r={radius.control} />
        ))}
      </div>
    );
  }

  // cards
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Block h={132} r={radius.page} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} h={232} />
        ))}
      </div>
    </div>
  );
}
