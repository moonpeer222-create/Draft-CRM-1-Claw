import { toast as sonnerToast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { notificationSound } from "./notificationSound";

export const toast = {
  success: (message: string) => {
    notificationSound.success();
    sonnerToast.success(message, {
      icon: <CheckCircle className="w-5 h-5" />,
      duration: 3000,
    });
  },
  error: (message: string) => {
    notificationSound.error();
    sonnerToast.error(message, {
      icon: <XCircle className="w-5 h-5" />,
      duration: 4000,
    });
  },
  info: (message: string) => {
    notificationSound.info();
    sonnerToast.info(message, {
      icon: <Info className="w-5 h-5" />,
      duration: 3000,
    });
  },
  warning: (message: string) => {
    notificationSound.warning();
    sonnerToast.warning(message, {
      icon: <AlertCircle className="w-5 h-5" />,
      duration: 3000,
    });
  },
  loading: (message: string) => {
    return sonnerToast.loading(message);
  },
  dismiss: (id: string | number) => {
    sonnerToast.dismiss(id);
  },
};