import { BeneficiaryKey, CustomMember, MemberNames } from '../types/finance';

export interface BeneficiaryOption {
  key: BeneficiaryKey;
  label: string;
  name: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  avatarText: string;
  avatar: string;
  description: string;
  isCustom?: boolean;
}

const CUSTOM_MEMBER_PALETTES = [
  {
    color: '#06B6D4', // Cyan
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    color: '#6366F1', // Indigo
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    color: '#F43F5E', // Rose
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
    textColor: 'text-rose-700 dark:text-rose-300',
  },
  {
    color: '#10B981', // Emerald
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    color: '#D97706', // Amber Dark
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
];

export const BASE_BENEFICIARIES: BeneficiaryOption[] = [
  {
    key: 'family',
    label: 'Chung (Cả nhà)',
    name: 'Chung',
    shortLabel: 'Chung',
    color: '#0D9488', // Teal
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-200 dark:border-teal-800',
    textColor: 'text-teal-700 dark:text-teal-300',
    avatarText: '🏠',
    avatar: '🏠',
    description: 'Sinh hoạt chung cả nhà',
  },
  {
    key: 'child1',
    label: 'Con 1',
    name: 'Con 1',
    shortLabel: 'Con 1',
    color: '#F59E0B', // Amber
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    textColor: 'text-amber-700 dark:text-amber-300',
    avatarText: '👶',
    avatar: '👶',
    description: 'Chi tiêu riêng Con 1',
  },
  {
    key: 'child2',
    label: 'Con 2',
    name: 'Con 2',
    shortLabel: 'Con 2',
    color: '#EC4899', // Pink
    bgColor: 'bg-pink-50 dark:bg-pink-950/40',
    borderColor: 'border-pink-200 dark:border-pink-800',
    textColor: 'text-pink-700 dark:text-pink-300',
    avatarText: '👶',
    avatar: '👶',
    description: 'Chi tiêu riêng Con 2',
  },
  {
    key: 'both_children',
    label: 'Cả 2 con (Chia đôi 50/50)',
    name: 'Cả 2 con (Chia đôi)',
    shortLabel: '2 Con',
    color: '#F97316', // Orange
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800',
    textColor: 'text-orange-700 dark:text-orange-300',
    avatarText: '🧒👶',
    avatar: '🧒👶',
    description: 'Tự động chia đôi 50/50 cho 2 con',
  },
  {
    key: 'me',
    label: 'Bản thân',
    name: 'Bản thân',
    shortLabel: 'Bản thân',
    color: '#8B5CF6', // Violet
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-200 dark:border-violet-800',
    textColor: 'text-violet-700 dark:text-violet-300',
    avatarText: '👩',
    avatar: '👩',
    description: 'Cá nhân tôi',
  },
  {
    key: 'spouse',
    label: 'Chồng',
    name: 'Chồng',
    shortLabel: 'Chồng',
    color: '#3B82F6', // Blue
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-700 dark:text-blue-300',
    avatarText: '👨',
    avatar: '👨',
    description: 'Chi riêng cho chồng',
  },
];

export function getBeneficiaries(
  memberNames?: MemberNames,
  customMembers?: CustomMember[]
): BeneficiaryOption[] {
  const meLabel = memberNames?.me?.trim() || 'Bản thân';
  const spouseLabel = memberNames?.spouse?.trim() || 'Chồng';
  const child1Label = memberNames?.child1?.trim() || 'Con 1';
  const child2Label = memberNames?.child2?.trim() || 'Con 2';

  const baseList = BASE_BENEFICIARIES.map(b => {
    let name = b.name;
    let label = b.label;
    let shortLabel = b.shortLabel;

    if (b.key === 'me') {
      name = meLabel;
      label = meLabel;
      shortLabel = meLabel;
    } else if (b.key === 'spouse') {
      name = spouseLabel;
      label = spouseLabel;
      shortLabel = spouseLabel;
    } else if (b.key === 'child1') {
      name = child1Label;
      label = child1Label;
      shortLabel = child1Label;
    } else if (b.key === 'child2') {
      name = child2Label;
      label = child2Label;
      shortLabel = child2Label;
    } else if (b.key === 'both_children') {
      name = `Cả 2 con (Chia đôi)`;
      label = `Cả 2 con (${child1Label} & ${child2Label} chia đôi)`;
      shortLabel = 'Cả 2 con';
    } else if (b.key === 'family') {
      name = 'Chung';
      label = 'Chung (Cả nhà)';
      shortLabel = 'Chung';
    }

    return {
      ...b,
      label,
      name,
      shortLabel,
      avatar: b.avatarText,
    };
  });

  const extraList: BeneficiaryOption[] = (customMembers || [])
    .filter(m => m && m.id && m.name?.trim())
    .map((m, idx) => {
      const palette = CUSTOM_MEMBER_PALETTES[idx % CUSTOM_MEMBER_PALETTES.length];
      const cleanName = m.name.trim();
      const avatar = m.avatar?.trim() || '👤';
      return {
        key: m.id,
        label: cleanName,
        name: cleanName,
        shortLabel: cleanName,
        color: palette.color,
        bgColor: palette.bgColor,
        borderColor: palette.borderColor,
        textColor: palette.textColor,
        avatarText: avatar,
        avatar,
        description: `Chi tiêu riêng cho ${cleanName}`,
        isCustom: true,
      };
    });

  return [...baseList, ...extraList];
}
