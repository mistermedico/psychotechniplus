import { useWindowDimensions } from 'react-native';
import { Platform } from 'react-native';

export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;
export const SIDEBAR_WIDTH = 220;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= BREAKPOINTS.md;
  const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
  const isDesktop = width >= BREAKPOINTS.lg;
  const isWeb = Platform.OS === 'web';
  const showSidebar = isWeb && isWide;
  const hPad = isDesktop ? 24 : 16;
  const numCols = isDesktop ? 4 : isTablet ? 3 : 2;
  return {
    width,
    height,
    isWide,
    isTablet,
    isDesktop,
    isWeb,
    showSidebar,
    sidebarWidth: showSidebar ? SIDEBAR_WIDTH : 0,
    hPad,
    numCols,
  };
}
