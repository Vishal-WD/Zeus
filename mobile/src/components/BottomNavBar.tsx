import React from 'react';
import { MapPin, Zap, BatteryCharging, User, Navigation } from 'lucide-react';

export type TabType = 'map' | 'docks' | 'vehicle' | 'profile';

interface BottomNavBarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  batterySoc: number;
}

export default function BottomNavBar({
  activeTab,
  onChangeTab,
  batterySoc,
}: BottomNavBarProps) {
  const tabs = [
    {
      id: 'map' as TabType,
      label: 'Map',
      icon: Navigation,
    },
    {
      id: 'docks' as TabType,
      label: 'FastPorts',
      icon: Zap,
    },
    {
      id: 'vehicle' as TabType,
      label: 'My EV',
      icon: BatteryCharging,
      badge: `${batterySoc}%`,
    },
    {
      id: 'profile' as TabType,
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-slate-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-2 py-1.5 safe-area-bottom select-none">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all duration-200 relative ${
                isActive
                  ? 'text-emerald-600 font-extrabold scale-105'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.5px]' : 'stroke-2'
                  }`}
                />
                {tab.badge && (
                  <span
                    className={`absolute -top-1.5 -right-3 text-[9px] font-black px-1.5 py-0.2 rounded-full border shadow-xs ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
