import { toast as sonnerToast, type ToastT } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { notificationSound } from "./notificationSound";

interface ToastOptions {
  duration?: number;
  icon?: React.ReactNode;
}

export const toast = {
  success: (message: string, opts?: ToastOptions) => {
    notificationSound.success();
    sonnerToast.success(message, {
      icon: opts?.icon ?? <CheckCircle className="w-5 h-5" />,
      duration: opts?.duration ?? 3000,
    });
  },
  error: (message: string, opts?: ToastOptions) => {
    notificationSound.error();
    sonnerToast.error(message, {
      icon: opts?.icon ?? <XCircle className="w-5 h-5" />,
      duration: opts?.duration ?? 4000,
    });
  },
  info: (message: string, opts?: ToastOptions) => {
    notificationSound.info();
    sonnerToast.info(message, {
      icon: opts?.icon ?? <Info className="w-5 h-5" />,
      duration: opts?.duration ?? 3000,
    });
  },
  warning: (message: string, opts?: ToastOptions) => {
    notificationSound.warning();
    sonnerToast.warning(message, {
      icon: opts?.icon ?? <AlertCircle className="w-5 h-5" />,
      duration: opts?.duration ?? 3000,
    });
  },
  loading: (message: string) => {
    return sonnerToast.loading(message);
  },
  dismiss: (id: string | number) => {
    sonnerToast.dismiss(id);
  },
};
