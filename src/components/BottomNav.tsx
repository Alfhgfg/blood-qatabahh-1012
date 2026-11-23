import React from 'react';
import { Home, Users, Droplet, Hospital, BookOpen, Shield } from 'lucide-react';
import { ActivePage, UserRole } from '../types';

interface BottomNavProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  role: UserRole;
  urgentRequestsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activePage,
  onNavigate,
  role,
  urgentRequestsCount
}) => {
  const navItems = [
    {
      id: 'home' as ActivePage,
      label: 'الرئيسية',
      icon: Home
    },
    {
      id: 'donors' as ActivePage,
      label: 'المتبرعون',
      icon: Users
    },
    {
      id: 'requests' as ActivePage,
      label: 'طلبات الدم',
      icon: Droplet,
      badge: urgentRequestsCount > 0 ? urgentRequestsCount : null
    },
    {
      id: 'hospitals' as ActivePage,
      label: 'المستشفيات',
      icon: Hospital
    },
    {
      id: 'info' as ActivePage,
      label: 'معلومات التبرع',
      icon: BookOpen
    },
    // إخفاء وحماية رمز المسؤول من شريط التنقل العام لغير المسؤولين
    ...(role === 'admin'
      ? [
          {
            id: 'admin' as ActivePage,
            label: 'لوحة الإدارة',
            icon: Shield,
            adminOnly: true
          }
        ]
      : [])
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] pb-safe">
      <div className="max-w-xl mx-auto flex items-center justify-between gap-0.5 sm:gap-1 px-1 sm:px-2 py-1.5 sm:py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePage === item.id ||
            (item.id === 'home' && activePage === 'hospital-ad') ||
            (item.id === 'hospitals' && activePage === 'hospital-doctors') ||
            (item.id === 'admin' && activePage === 'districts');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-[48px] py-1 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'text-rose-700 font-bold bg-rose-50/70'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="relative shrink-0">
                <Icon
                  className={`w-[18px] h-[18px] min-[380px]:w-5 min-[380px]:h-5 sm:w-5.5 sm:h-5.5 transition-transform ${
                    isActive ? 'stroke-[2.3px] text-rose-700' : 'stroke-[1.8px] text-slate-500'
                  }`}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] min-[375px]:text-[10px] sm:text-[11px] leading-tight mt-1 w-full text-center truncate tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
