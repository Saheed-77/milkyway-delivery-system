import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CreditCard, Info, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/api/queries";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/services";

const ICONS: Record<AppNotification["kind"], typeof Bell> = {
  order: Package,
  payment: CreditCard,
  delivery: Truck,
  system: Info,
};

const seenKey = (userId: string) => `milkyway.notifications.seen.${userId}`;

export function NotificationBell() {
  const { profile } = useAuth();
  const { data = [] } = useNotifications();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string>("");

  useEffect(() => {
    if (!profile) return;
    try {
      setSeen(localStorage.getItem(seenKey(profile.id)) ?? "");
    } catch {
      setSeen("");
    }
  }, [profile]);

  const unread = data.filter((n) => n.created_at > seen).length;

  const markSeen = () => {
    if (!profile || !data[0]) return;
    const latest = data[0].created_at;
    setSeen(latest);
    try {
      localStorage.setItem(seenKey(profile.id), latest);
    } catch {
      // ignore
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) markSeen();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`}>
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          {unread > 0 && (
            <button className="text-xs font-semibold text-primary hover:underline" onClick={markSeen}>
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {data.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {data.map((n) => {
                const Icon = ICONS[n.kind];
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60", n.created_at > seen && "bg-primary-soft/40")}>
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
