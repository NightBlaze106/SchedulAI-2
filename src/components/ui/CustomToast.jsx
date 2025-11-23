import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
};

const STYLES = {
  success: "bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
  error: "bg-red-950/90 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  warning: "bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
};

export default function CustomToast({ notification, onClose }) {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000); // Auto-hide after 4 seconds
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const Icon = ICONS[notification.type] || ICONS.success;
  const style = STYLES[notification.type] || STYLES.success;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-right-10 fade-in duration-300">
      <div className={cn(
        "flex items-start gap-3 p-4 pr-10 rounded-xl border backdrop-blur-md min-w-[300px] max-w-md",
        style
      )}>
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-bold text-sm uppercase tracking-wider mb-1">
            {notification.type === 'error' ? 'System Alert' : 'Notification'}
          </h4>
          <p className="text-sm opacity-90 font-medium leading-relaxed">
            {notification.message}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}