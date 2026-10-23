import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border text-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-[#0A3D3F] text-white border-[#2D7A77]'
              : toast.type === 'warning'
              ? 'bg-[#5A4100] text-[#FFF1CC] border-[#F0D58A]'
              : 'bg-[#0E1B1F] text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-[#F5B942] shrink-0 mt-0.5" />
          )}
          {toast.type === 'warning' && (
            <AlertCircle className="w-5 h-5 text-[#F5B942] shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-[#5E9A97] shrink-0 mt-0.5" />
          )}

          <div className="flex-1 leading-snug">{toast.message}</div>

          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-white/60 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
