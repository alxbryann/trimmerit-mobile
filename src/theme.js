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
