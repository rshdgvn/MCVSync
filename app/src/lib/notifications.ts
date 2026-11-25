export type NotificationKind =
  | "offline"
  | "back-online"
  | "sync-success"
  | "sync-failed"
  | "system";

interface NotifyOptions {
  title?: string;
  body?: string;
}

const DEFAULTS: Record<NotificationKind, { title: string; body: string }> = {
  offline: {
    title: "You're offline",
    body: "Changes will sync once you're back online.",
  },
  "back-online": {
    title: "Back online",
    body: "Connection restored.",
  },
  "sync-success": {
    title: "Sync complete",
    body: "Your offline changes have been saved.",
  },
  "sync-failed": {
    title: "Sync failed",
    body: "Some offline changes were rejected. Review them in Sync Issues.",
  },
  system: {
    title: "MCVSync",
    body: "",
  },
};

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return "denied";
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export function notify(kind: NotificationKind, options: NotifyOptions = {}): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return;
  }

  const defaults = DEFAULTS[kind];

  new Notification(options.title ?? defaults.title, {
    body: options.body ?? defaults.body,
    icon: "/icons/icon-192.svg",
  });
}
