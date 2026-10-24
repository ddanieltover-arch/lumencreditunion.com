// Push Notification Service for Transfers, KYC decisions, and Loan updates

export type NotificationType = 'TRANSFER' | 'KYC_DECISION' | 'LOAN_UPDATE' | 'CARD_ALERT' | 'SYSTEM';

interface NotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return 'denied';
  }
}

export function getPushPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function sendWebPushNotification({
  title,
  body,
  type,
  data = {},
}: NotificationPayload): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    // If not yet granted, try requesting
    const permission = await requestPushPermission();
    if (permission !== 'granted') {
      return false;
    }
  }

  try {
    // If service worker is ready, use registration.showNotification (standard PWA Web Push)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `lumenfield-${type.toLowerCase()}-${Date.now()}`,
          data: {
            ...data,
            type,
            timestamp: Date.now(),
          },
        });
        return true;
      }
    }

    // Fallback to standard Window Notification API
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    return true;
  } catch (err) {
    console.warn('[Lumenfield Web Push] Notification delivery notice:', err);
    return false;
  }
}

// Convenience dispatchers
export async function notifyTransferExecuted(recipient: string, amountFormatted: string, isIncoming = false) {
  return sendWebPushNotification({
    title: isIncoming ? 'Funds Received' : 'Transfer Completed',
    body: isIncoming
      ? `You received ${amountFormatted} from ${recipient}.`
      : `Your transfer of ${amountFormatted} to ${recipient} has settled on the ledger.`,
    type: 'TRANSFER',
  });
}

export async function notifyKycDecision(status: 'APPROVED' | 'REJECTED', reason?: string) {
  return sendWebPushNotification({
    title: status === 'APPROVED' ? 'Identity Verification Approved' : 'Identity Verification Update',
    body:
      status === 'APPROVED'
        ? 'Your KYC documents have been verified. Full wallet capabilities are now unlocked.'
        : `Your KYC submission requires attention: ${reason || 'Please re-upload clearer identity documents.'}`,
    type: 'KYC_DECISION',
  });
}

export async function notifyLoanDecision(status: 'APPROVED' | 'REJECTED', amountFormatted: string) {
  return sendWebPushNotification({
    title: status === 'APPROVED' ? 'Loan Application Approved' : 'Loan Application Status',
    body:
      status === 'APPROVED'
        ? `Congratulations! Your loan of ${amountFormatted} has been approved and funded to your wallet.`
        : 'Your loan application could not be approved at this time based on underwriting criteria.',
    type: 'LOAN_UPDATE',
  });
}
