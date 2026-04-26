/** trimmerit — Editorial Premium palette */
export const colors = {
  // Ink scale
  ink:        '#0a0a0a',
  ink2:       '#141210',
  ink3:       '#1a1613',
  ink4:       '#221c17',

  // Paper / text
  paper:      '#f2efe7',
  paperDim:   '#dcd5c3',

  // Champagne accent (replaces acid)
  champagne:    '#c8a96a',
  champagneDim: '#8a7454',
  champagneSoft:'rgba(200,169,106,0.08)',
  champagneGlow:'rgba(200,169,106,0.04)',

  // Semantic
  terracota:  '#b85e4c',
  olivo:      '#6d7a5a',

  // Muted paper tints
  muted:      'rgba(242,239,231,0.55)',
  muted2:     'rgba(242,239,231,0.35)',
  muted3:     'rgba(242,239,231,0.22)',

  // Borders
  border:       'rgba(242,239,231,0.12)',
  borderStrong: 'rgba(242,239,231,0.22)',

  // Legacy aliases used across the codebase
  black:       '#0a0a0a',
  dark:        '#141210',
  dark2:       '#1a1613',
  dark3:       '#221c17',
  gray:        '#2a2520',
  grayMid:     '#6a6058',
  grayLight:   'rgba(242,239,231,0.55)',
  white:       '#f2efe7',
  acid:        '#c8a96a',       // remap acid → champagne for legacy code
  acidDim:     '#8a7454',
  acidSoft:    'rgba(200,169,106,0.08)',
  acidGlow:    'rgba(200,169,106,0.04)',
  danger:      '#b85e4c',
  dangerSoft:  'rgba(184,94,76,0.10)',
  overlay:     'rgba(10,10,10,0.92)',
  card:        '#141210',
  cardBorder:  'rgba(242,239,231,0.12)',
};

export const lightColors = {
  ink:        '#f4f1ea',
  ink2:       '#ede9e0',
  ink3:       '#e6e1d6',
  ink4:       '#ddd8cc',

  paper:      '#0f0d0b',
  paperDim:   'rgba(10,10,10,0.55)',

  champagne:    '#9a7a3a',
  champagneDim: '#b8986a',
  champagneSoft:'rgba(154,122,58,0.08)',
  champagneGlow:'rgba(154,122,58,0.04)',

  terracota:  '#b85e4c',
  olivo:      '#6d7a5a',

  muted:      'rgba(10,10,10,0.55)',
  muted2:     'rgba(10,10,10,0.35)',
  muted3:     'rgba(10,10,10,0.22)',

  border:       'rgba(10,10,10,0.09)',
  borderStrong: 'rgba(10,10,10,0.16)',

  black:       '#f4f1ea',
  dark:        '#ede9e0',
  dark2:       '#e6e1d6',
  dark3:       '#ddd8cc',
  gray:        '#ccc8be',
  grayMid:     'rgba(10,10,10,0.45)',
  grayLight:   'rgba(10,10,10,0.55)',
  white:       '#0f0d0b',
  acid:        '#9a7a3a',
  acidDim:     '#b8986a',
  acidSoft:    'rgba(154,122,58,0.08)',
  acidGlow:    'rgba(154,122,58,0.04)',
  danger:      '#b85e4c',
  dangerSoft:  'rgba(184,94,76,0.10)',
  overlay:     'rgba(244,241,234,0.92)',
  card:        '#ede9e0',
  cardBorder:  'rgba(10,10,10,0.09)',
};

/** Sharp-corner editorial — no rounding except pill */
export const radii = {
  xs:   0,
  sm:   0,
  md:   0,
  lg:   0,
  xl:   0,
  pill: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  acid: {
    shadowColor: '#c8a96a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 6,
  },
};

/** Font family names after useFonts in App.js */
export const fonts = {
  display:      'PlayfairDisplay_800ExtraBold_Italic',
  displayMed:   'PlayfairDisplay_500Medium_Italic',
  displayReg:   'PlayfairDisplay_400Regular_Italic',
  body:         'Inter_400Regular',
  bodySemi:     'Inter_500Medium',
  bodyBold:     'Inter_600SemiBold',
  mono:         'DMMono_400Regular',
  monoLight:    'DMMono_300Light',
  // legacy aliases
  bodyBoldLeg:  'Inter_600SemiBold',
};
