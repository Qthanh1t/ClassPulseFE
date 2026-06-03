import { useBreakpoint } from '../../hooks/useBreakpoint';
import { pagePadding } from '../../theme/tokens';

/**
 * Page wrapper: constrains content width on large screens and applies
 * breakpoint-tuned padding so every AppLayout page breathes consistently.
 */
export default function PageContainer({
  children,
  maxWidth = 1200,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const { isMobile, isTablet } = useBreakpoint();
  return (
    <div style={{ padding: pagePadding(isMobile, isTablet) }}>
      <div style={{ maxWidth, margin: '0 auto' }}>{children}</div>
    </div>
  );
}
