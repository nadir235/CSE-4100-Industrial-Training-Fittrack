import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const bp: Breakpoint = width >= 1024 ? 'desktop' : width >= 700 ? 'tablet' : 'mobile';
  return {
    width,
    height,
    bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
    /** number of columns for card grids */
    columns: bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1,
  };
}
