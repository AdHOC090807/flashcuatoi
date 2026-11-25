import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { useToastStore } from '@/store/useToastStore';
import { cn } from '@/lib/utils';

export function ToastContainer() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 right-4 z-[60] flex max-w-sm flex-col gap-2 md:bottom-6"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'success'
            ? CheckCircle2
            : toast.variant === 'error'
              ? XCircle
              : toast.variant === 'warning'
                ? AlertTriangle
                : Info;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-card p-3.5 text-card-foreground shadow-lg',
              toast.variant === 'error' && 'border-destructive/50',
              toast.variant === 'success' && 'border-emerald-500/50',
              toast.variant === 'warning' && 'border-amber-500/50'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-5 w-5 shrink-0',
                toast.variant === 'success' && 'text-emerald-600 dark:text-emerald-400',
                toast.variant === 'error' && 'text-destructive',
                toast.variant === 'warning' && 'text-amber-600 dark:text-amber-400',
                (!toast.variant || toast.variant === 'default') && 'text-primary'
              )}
            />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
