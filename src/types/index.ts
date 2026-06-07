export interface AccessibilityCommand {
  colorMode: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia' | null;
  darkMode: boolean | null;
  highContrast: boolean | null;
  brightness: number | null;   // 0.1 to 1.5
  warmTone: boolean | null;
  invertColors: boolean | null;
  zoom: 'center' | 'peripheral' | 'full' | null;
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
}

export const defaultFilterState: FilterState = {
  colorMode: null,
  darkMode: false,
  highContrast: false,
  brightness: null,
  warmTone: false,
  invertColors: false,
};
