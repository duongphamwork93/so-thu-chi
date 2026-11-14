import React from 'react';
import {
  Utensils,
  ShoppingCart,
  Car,
  Home,
  Baby,
  GraduationCap,
  ToyBrick,
  Stethoscope,
  HeartPulse,
  Coffee,
  ShoppingBag,
  Tv,
  Gift,
  PiggyBank,
  CreditCard,
  CircleEllipsis,
  Briefcase,
  Award,
  Laptop,
  TrendingUp,
  ShieldCheck,
  Receipt,
  Sparkles,
  Coins,
  Fuel,
  Pizza,
  Beer,
  Wine,
  Apple,
  Store,
  Package,
  Bus,
  Plane,
  Bike,
  Building,
  Key,
  BookOpen,
  Pill,
  Gamepad2,
  Film,
  Music,
  Camera,
  Dumbbell,
  Smile,
  Dog,
  Wallet,
  DollarSign,
  Smartphone,
  Zap,
  Droplets,
  Wrench,
  Wifi,
  Flame,
  Phone,
  Shirt,
  Footprints,
  Glasses,
  Scissors,
  HeartHandshake,
  Handshake,
  HandCoins,
  Landmark,
  Shield,
  ParkingCircle,
  Hammer,
  Sofa,
  Users,
  ArrowLeftRight,
  LucideIcon,
} from 'lucide-react';
import { CATEGORY_MAP } from '../constants/categories';
import { useFinance } from '../context/FinanceContext';

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  ShoppingCart,
  Car,
  Home,
  Baby,
  GraduationCap,
  ToyBrick,
  Stethoscope,
  HeartPulse,
  Coffee,
  ShoppingBag,
  Tv,
  Gift,
  PiggyBank,
  CreditCard,
  CircleEllipsis,
  Briefcase,
  Award,
  Laptop,
  TrendingUp,
  ShieldCheck,
  Receipt,
  Sparkles,
  Coins,
  Fuel,
  Pizza,
  Beer,
  Wine,
  Apple,
  Store,
  Package,
  Bus,
  Plane,
  Bike,
  Building,
  Key,
  BookOpen,
  Pill,
  Gamepad2,
  Film,
  Music,
  Camera,
  Dumbbell,
  Smile,
  Dog,
  Wallet,
  DollarSign,
  Smartphone,
  Zap,
  Droplets,
  Wrench,
  Wifi,
  Flame,
  Phone,
  Shirt,
  Footprints,
  Glasses,
  Scissors,
  HeartHandshake,
  Handshake,
  HandCoins,
  Landmark,
  Shield,
  ParkingCircle,
  Hammer,
  Sofa,
  Users,
  ArrowLeftRight,
};

export interface IconOption {
  name: string;
  label: string;
  group: 'food' | 'shopping' | 'travel' | 'living' | 'leisure' | 'work' | 'finance';
}

export const AVAILABLE_CATEGORY_ICONS: IconOption[] = [
  // Ẩm thực & Đồ uống
  { name: 'Utensils', label: 'Ăn uống', group: 'food' },
  { name: 'Coffee', label: 'Cà phê / Trà', group: 'food' },
  { name: 'Pizza', label: 'Ăn tiệm / Ăn tối', group: 'food' },
  { name: 'Beer', label: 'Bia / Nhậu', group: 'food' },
  { name: 'Apple', label: 'Trái cây / Thực phẩm', group: 'food' },

  // Mua sắm & Trang phục
  { name: 'ShoppingCart', label: 'Siêu thị / Chợ', group: 'shopping' },
  { name: 'ShoppingBag', label: 'Mua sắm cá nhân', group: 'shopping' },
  { name: 'Shirt', label: 'Quần áo', group: 'shopping' },
  { name: 'Footprints', label: 'Giầy dép', group: 'shopping' },
  { name: 'Glasses', label: 'Phụ kiện', group: 'shopping' },
  { name: 'Store', label: 'Cửa hàng tiện lợi', group: 'shopping' },
  { name: 'Package', label: 'Giao hàng / Ship', group: 'shopping' },

  // Đi lại & Xe cộ
  { name: 'Car', label: 'Ô tô / Taxi', group: 'travel' },
  { name: 'Bike', label: 'Xe máy / Grab', group: 'travel' },
  { name: 'Fuel', label: 'Xăng xe', group: 'travel' },
  { name: 'ParkingCircle', label: 'Gửi xe / Cầu đường', group: 'travel' },
  { name: 'Wrench', label: 'Sửa chữa, bảo dưỡng', group: 'travel' },
  { name: 'Shield', label: 'Bảo hiểm xe', group: 'travel' },
  { name: 'Bus', label: 'Xe buýt / Công cộng', group: 'travel' },
  { name: 'Plane', label: 'Máy bay / Du lịch', group: 'travel' },

  // Nhà cửa & Dịch vụ sinh hoạt
  { name: 'Home', label: 'Nhà ở / Tiền thuê', group: 'living' },
  { name: 'Sofa', label: 'Mua sắm đồ đạc', group: 'living' },
  { name: 'Hammer', label: 'Sửa chữa nhà cửa', group: 'living' },
  { name: 'Zap', label: 'Tiền điện', group: 'living' },
  { name: 'Droplets', label: 'Tiền nước', group: 'living' },
  { name: 'Flame', label: 'Tiền gas', group: 'living' },
  { name: 'Wifi', label: 'Internet / Wifi', group: 'living' },
  { name: 'Phone', label: 'Điện thoại cố định', group: 'living' },
  { name: 'Baby', label: 'Con nhỏ / Bỉm sữa', group: 'living' },
  { name: 'GraduationCap', label: 'Học phí / Giáo dục', group: 'living' },
  { name: 'BookOpen', label: 'Sách vở / Học hành', group: 'living' },
  { name: 'ToyBrick', label: 'Đồ chơi cho bé', group: 'living' },
  { name: 'Dog', label: 'Thú cưng', group: 'living' },

  // Sức khỏe, Làm đẹp & Giải trí
  { name: 'HeartPulse', label: 'Sức khỏe / Khám bệnh', group: 'leisure' },
  { name: 'Stethoscope', label: 'Khám chữa bệnh', group: 'leisure' },
  { name: 'Pill', label: 'Thuốc men', group: 'leisure' },
  { name: 'Dumbbell', label: 'Thể thao / Gym', group: 'leisure' },
  { name: 'Scissors', label: 'Làm đẹp', group: 'leisure' },
  { name: 'Sparkles', label: 'Mỹ phẩm / Làm đẹp', group: 'leisure' },
  { name: 'Tv', label: 'Truyền hình / Xem phim', group: 'leisure' },
  { name: 'Film', label: 'Phim ảnh / Ca nhạc', group: 'leisure' },
  { name: 'Gamepad2', label: 'Vui chơi giải trí', group: 'leisure' },
  { name: 'Music', label: 'Âm nhạc', group: 'leisure' },
  { name: 'Camera', label: 'Nhiếp ảnh', group: 'leisure' },
  { name: 'Smile', label: 'Chăm sóc bản thân', group: 'leisure' },
  { name: 'Handshake', label: 'Giao lưu, quan hệ', group: 'leisure' },
  { name: 'HeartHandshake', label: 'Hiếu hỉ / Thăm hỏi', group: 'leisure' },

  // Tiền tệ & Ngân hàng
  { name: 'Wallet', label: 'Ví tiền', group: 'finance' },
  { name: 'Briefcase', label: 'Lương / Công việc', group: 'finance' },
  { name: 'Coins', label: 'Tiền mặt / Tiêu vặt', group: 'finance' },
  { name: 'TrendingUp', label: 'Đầu tư / Lãi', group: 'finance' },
  { name: 'PiggyBank', label: 'Tiết kiệm', group: 'finance' },
  { name: 'Gift', label: 'Quà biếu / Cưới xin', group: 'finance' },
  { name: 'CreditCard', label: 'Thẻ / Trả góp', group: 'finance' },
  { name: 'ArrowLeftRight', label: 'Phí chuyển khoản', group: 'finance' },
  { name: 'HandCoins', label: 'Cho vay / Thu nợ', group: 'finance' },
  { name: 'Landmark', label: 'Ngân hàng', group: 'finance' },
  { name: 'Users', label: 'Quỹ nhóm', group: 'finance' },
  { name: 'Smartphone', label: 'Điện thoại di động', group: 'work' },
  { name: 'Laptop', label: 'Làm thêm online', group: 'work' },
  { name: 'CircleEllipsis', label: 'Mục khác', group: 'finance' },
];

interface CategoryIconProps {
  catKey?: string;
  iconName?: string;
  color?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBackground?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  catKey,
  iconName: directIconName,
  color: directColor,
  name: directName,
  size = 'md',
  className = '',
  showBackground = true,
}) => {
  let contextCategoryMap: Record<string, any> | undefined;
  try {
    const finance = useFinance();
    contextCategoryMap = finance?.categoryMap;
  } catch {
    // Outside provider fallback
  }

  const lookupCat = catKey ? (contextCategoryMap?.[catKey] || CATEGORY_MAP[catKey]) : undefined;
  const finalColor = directColor || lookupCat?.color || '#64748B';
  const finalIconName = directIconName || lookupCat?.iconName || 'CircleEllipsis';
  const finalName = directName || lookupCat?.name || 'Khác';

  const IconComponent = ICON_MAP[finalIconName] || CircleEllipsis;

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size];

  const iconSizes = {
    sm: 15,
    md: 20,
    lg: 24,
  }[size];

  if (!showBackground) {
    return <IconComponent size={iconSizes} style={{ color: finalColor }} className={className} />;
  }

  return (
    <div
      className={`rounded-2xl flex items-center justify-center shrink-0 transition-transform ${sizeClasses} ${className}`}
      style={{
        backgroundColor: `${finalColor}18`,
        color: finalColor,
      }}
      title={finalName}
    >
      <IconComponent size={iconSizes} strokeWidth={2.2} />
    </div>
  );
};
