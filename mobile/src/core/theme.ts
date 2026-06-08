// theme.ts — design tokens converted from colors_and_type.css

export const colors = {
  // Ink (cool neutral)
  ink950: '#070d18',
  ink900: '#0e1726',
  ink800: '#1b2638',
  ink700: '#2c3a52',
  ink600: '#44516a',
  ink500: '#5a6677',
  ink400: '#7a869a',
  ink300: '#a6b0bf',
  ink200: '#d5dae3',
  ink150: '#e3e7ee',
  ink100: '#e8ebf1',
  ink75:  '#eef0f5',
  ink50:  '#f3f5f8',

  // Paper
  paper:   '#faf9f6',
  paper2:  '#ffffff',
  paper3:  '#f5f3ee',

  // Copper (accent)
  copper900: '#4f3208',
  copper700: '#7a5012',
  copper600: '#9a6b1f',
  copper500: '#b6862f',
  copper300: '#d9b677',
  copper100: '#f0e1bf',
  copper50:  '#f7eed7',
  copper25:  '#faf3e3',

  // Semantic
  green700: '#155c3b',
  green600: '#1f7a4d',
  green100: '#d6ead9',
  green50:  '#ebf5ec',

  red700:   '#8c2828',
  red600:   '#b43a3a',
  red100:   '#f4d6d6',
  red50:    '#faeaea',

  amber700: '#8a6310',
  amber600: '#b68a1f',
  amber100: '#f3e3b5',
  amber50:  '#faf2d7',

  blue700:  '#1f4a85',
  blue600:  '#2962ab',
  blue100:  '#d4e0f0',
  blue50:   '#eaf0f8',
};

export const lightTheme = {
  bgApp:       colors.paper,
  bgSurface:   colors.paper2,
  bgSunken:    colors.paper3,
  bgHover:     colors.ink50,
  bgSelected:  colors.copper25,
  bgOverlay:   'rgba(14, 23, 38, 0.40)',

  fg1:         colors.ink900,
  fg2:         colors.ink700,
  fg3:         colors.ink500,
  fg4:         colors.ink400,
  fgDisabled:  colors.ink300,
  fgOnInk:     '#fafaf7',
  fgOnCopper:  '#ffffff',
  fgLink:      colors.copper700,

  border1:     colors.ink100,
  border2:     colors.ink200,
  borderStrong: colors.ink700,
  borderFocus: colors.copper600,

  accent:      colors.copper600,
  accentLight: colors.copper50,
  success:     colors.green600,
  successBg:   colors.green50,
  danger:      colors.red600,
  dangerBg:    colors.red50,
  warning:     colors.amber600,
  warningBg:   colors.amber50,
  info:        colors.blue600,
  infoBg:      colors.blue50,

  tabBarBg:    colors.paper2,
  tabBarBorder: colors.ink100,
};

export const darkTheme: typeof lightTheme = {
  bgApp:       '#0e1726',
  bgSurface:   '#1b2638',
  bgSunken:    '#101d2e',
  bgHover:     '#1f2e42',
  bgSelected:  '#2a2010',
  bgOverlay:   'rgba(0, 0, 0, 0.60)',

  fg1:         '#f0f2f5',
  fg2:         '#c0c8d8',
  fg3:         '#8090a8',
  fg4:         '#6070880',
  fgDisabled:  '#44516a',
  fgOnInk:     '#fafaf7',
  fgOnCopper:  '#ffffff',
  fgLink:      colors.copper300,

  border1:     '#233044',
  border2:     '#2c3a52',
  borderStrong: '#4a5a70',
  borderFocus: colors.copper500,

  accent:      colors.copper500,
  accentLight: '#3a2a0a',
  success:     '#22c55e',
  successBg:   '#142a1a',
  danger:      '#ef4444',
  dangerBg:    '#2a1212',
  warning:     '#f59e0b',
  warningBg:   '#2a2010',
  info:        '#60a5fa',
  infoBg:      '#102040',

  tabBarBg:    '#1b2638',
  tabBarBorder: '#233044',
};

export const spacing = {
  0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 12, 6: 16,
  7: 20, 8: 24, 9: 32, 10: 40, 11: 48, 12: 64,
};

export const radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 22, pill: 999,
};

export const fontSize = {
  micro: 11, small: 12, code: 12.5, body: 13,
  bodyLg: 15, h3: 15, h2: 18, h1: 22,
  display2: 30, display1: 40,
};

export const fontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold: '600' as const,
  bold:    '700' as const,
};

export type Theme = typeof lightTheme;
