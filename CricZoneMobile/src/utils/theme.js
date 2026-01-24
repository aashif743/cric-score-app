// CricZone Theme - Matching the web app styling
export const colors = {
  // Primary colors
  primary: '#4f46e5',       // Indigo-600
  primaryLight: '#eef2ff',  // Indigo-50
  primaryDark: '#4338ca',   // Indigo-700

  // Secondary colors
  secondary: '#06b6d4',     // Cyan-500
  secondaryLight: '#ecfeff', // Cyan-50

  // Gradient colors
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',

  // Background colors
  background: '#f8fafc',    // Slate-50
  surface: '#ffffff',
  surfaceGray: '#f1f5f9',   // Slate-100
  cardBg: '#dee1e4',

  // Text colors
  textPrimary: '#1e293b',   // Slate-800
  textSecondary: '#64748b', // Slate-500
  textMuted: '#94a3b8',     // Slate-400
  textDark: '#1a202c',

  // Status colors
  success: '#22c55e',       // Green-500
  error: '#ef4444',         // Red-500
  warning: '#f59e0b',       // Amber-500
  info: '#3b82f6',          // Blue-500

  // Border colors
  border: '#e2e8f0',        // Slate-200
  borderLight: '#f1f5f9',   // Slate-100

  // Ball colors (for cricket scoring)
  ballRun: '#94a3b8',       // Slate
  ballBoundary: '#22c55e',  // Green
  ballWicket: '#ef4444',    // Red
  ballExtra: '#f59e0b',     // Amber
  ballBye: '#6366f1',       // Indigo

  // Accent colors
  accent: '#667eea',
  accentSecondary: '#764ba2',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 32,
};

export const fontWeights = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
};

export default {
  colors,
  spacing,
  borderRadius,
  fontSizes,
  fontWeights,
  shadows,
};
