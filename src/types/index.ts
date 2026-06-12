export interface FilterIntensities {
  colorMode: number; // 0-1, severity of the color-blindness simulation
  darkMode: number; // 0-1
  highContrast: number; // 0-1
  warmTone: number; // 0-1
  invertColors: number; // 0-1
  blur: number; // 0-1, cataract / low-vision blur
  zoom: number; // 0-1, magnitude for whichever zoom mode is active
  dimOverlay: number; // 0-1, photophobia dimming strength
}

export const defaultIntensities: FilterIntensities = {
  colorMode: 1,
  darkMode: 1,
  highContrast: 1,
  warmTone: 1,
  invertColors: 1,
  blur: 0.5,
  zoom: 0.5,
  dimOverlay: 0.5,
};

export interface AccessibilityCommand {
  colorMode: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia' | null;
  darkMode: boolean | null;
  highContrast: boolean | null;
  brightness: number | null;
  warmTone: boolean | null;
  invertColors: boolean | null;
  blur: boolean | null;
  hemianopia: 'left' | 'right' | null;
  zoom: 'center' | 'peripheral' | 'full' | null;
  dimOverlay: boolean | null;
  boldText: boolean | null;
  reduceMotion: boolean | null;
  intensities: Partial<FilterIntensities> | null;
  reset: boolean;
  explanation: string;
}

export interface FilterState {
  colorMode: AccessibilityCommand['colorMode'];
  darkMode: boolean;
  highContrast: boolean;
  brightness: number | null;
  warmTone: boolean;
  invertColors: boolean;
  blur: boolean;
  hemianopia: 'left' | 'right' | null;
  zoom: AccessibilityCommand['zoom'];
  dimOverlay: boolean;
  boldText: boolean;
  reduceMotion: boolean;
  intensities: FilterIntensities;
}

export const defaultFilterState: FilterState = {
  colorMode: null,
  darkMode: false,
  highContrast: false,
  brightness: null,
  warmTone: false,
  invertColors: false,
  blur: false,
  hemianopia: null,
  zoom: null,
  dimOverlay: false,
  boldText: false,
  reduceMotion: false,
  intensities: defaultIntensities,
};
