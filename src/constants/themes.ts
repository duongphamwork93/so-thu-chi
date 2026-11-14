export type ColorThemeId = 'emerald' | 'amber' | 'pink' | 'blue' | 'violet';

export interface ColorThemeOption {
  id: ColorThemeId;
  name: string;
  subtitle: string;
  swatchHex: string;
  secondaryHex: string;
  lightBgHex: string;
  themeColorHex: string;
  previewGradient: string;
}

export const COLOR_THEMES: ColorThemeOption[] = [
  {
    id: 'emerald',
    name: 'Bạc Hà Pastel',
    subtitle: 'Xanh mint dịu mát',
    swatchHex: '#66caa8',
    secondaryHex: '#bbeedb',
    lightBgHex: '#f4fcf9',
    themeColorHex: '#f2fcf8',
    previewGradient: 'from-emerald-400 via-teal-400 to-cyan-300',
  },
  {
    id: 'amber',
    name: 'Vàng Bơ Pastel',
    subtitle: 'Vàng kem ngọt ngào',
    swatchHex: '#ffc957',
    secondaryHex: '#ffecb3',
    lightBgHex: '#fffdf4',
    themeColorHex: '#fffdf2',
    previewGradient: 'from-amber-400 via-amber-300 to-yellow-200',
  },
  {
    id: 'pink',
    name: 'Hồng Phấn Pastel',
    subtitle: 'Hồng dâu sữa dễ thương',
    swatchHex: '#ff85b5',
    secondaryHex: '#ffcce0',
    lightBgHex: '#fff7fa',
    themeColorHex: '#fff5f9',
    previewGradient: 'from-pink-400 via-pink-300 to-rose-200',
  },
  {
    id: 'blue',
    name: 'Xanh Trời Pastel',
    subtitle: 'Xanh mây thanh lịch',
    swatchHex: '#75b1fc',
    secondaryHex: '#c7e0ff',
    lightBgHex: '#f5f9ff',
    themeColorHex: '#f4f9ff',
    previewGradient: 'from-blue-400 via-sky-300 to-cyan-300',
  },
  {
    id: 'violet',
    name: 'Tím Phấn Pastel',
    subtitle: 'Oải hương mộng mơ',
    swatchHex: '#b08dfc',
    secondaryHex: '#dfceff',
    lightBgHex: '#faf6ff',
    themeColorHex: '#f9f5ff',
    previewGradient: 'from-violet-400 via-purple-300 to-fuchsia-300',
  },
];

export const VALID_COLOR_THEME_IDS: ColorThemeId[] = COLOR_THEMES.map(t => t.id);

export function getColorThemeOption(id?: string): ColorThemeOption {
  return COLOR_THEMES.find(t => t.id === id) || COLOR_THEMES[0];
}
