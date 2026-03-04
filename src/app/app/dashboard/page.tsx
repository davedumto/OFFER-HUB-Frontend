"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth-store";
import { useModeStore } from "@/stores/mode-store";
import { WalletAddress } from "@/components/ui/WalletAddress";
import { Icon, ICON_PATHS, LoadingSpinner } from "@/components/ui/Icon";
import { getFreelancerActivities, type FreelancerActivity } from "@/lib/api/freelancer";
import { getClientActivities, type ClientActivity } from "@/lib/api/client";

type Activity = FreelancerActivity | ClientActivity;

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const { mode } = useModeStore();
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchActivities = useCallback(async (force = false) => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Debounce: skip if fetched less than 2 seconds ago (unless forced)
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 2000) {
      return;
    }
    lastFetchRef.current = now;

    setIsLoading(true);
    try {
      // Fetch based on current mode
      const data = mode === "client"
        ? await getClientActivities(token)
        : await getFreelancerActivities(token);
      setActivities(data);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token, mode]);

  // Fetch data on mount and mode change
  useEffect(() => {
    if (!mounted) return;
    fetchActivities(true);
  }, [mounted, fetchActivities]);

  // Refetch data when user navigates back to this page
  useEffect(() => {
    if (!mounted) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchActivities();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, fetchActivities]);

  const formatBalance = (balance: string | undefined) => {
    if (!balance) return "$0.00";
    const num = parseFloat(balance);
    return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getIconPath = (type: string): string => {
    switch (type) {
      case 'order_created':
        return ICON_PATHS.briefcase;
      case 'order_completed':
        return ICON_PATHS.check;
      case 'payment_received':
        return ICON_PATHS.currency;
      case 'withdrawal_completed':
        return ICON_PATHS.arrowUp;
      case 'topup_completed':
        return ICON_PATHS.arrowDown;
      default:
        return ICON_PATHS.bell;
    }
  };

  const activeProjects = 0;
  const pendingProposals = 0;

  const stats = [
    { label: "Active Projects", value: String(activeProjects), icon: ICON_PATHS.briefcase },
    { label: "Pending Proposals", value: String(pendingProposals), icon: ICON_PATHS.document },
    { label: "Reserved Balance", value: mounted ? formatBalance(user?.balance?.reserved) : "...", icon: ICON_PATHS.lock },
    { label: "Available Balance", value: mounted ? formatBalance(user?.balance?.available) : "...", icon: ICON_PATHS.currency },
  ];

  const activitiesLink = mode === "client" ? "/app/client/activities" : "/app/freelancer/activities";

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div
        className={cn(
          "flex items-center w-full px-4 py-3 rounded-2xl",
          "bg-white",
          "shadow-[inset_2px_2px_4px_#d1d5db,inset_-2px_-2px_4px_#ffffff]"
        )}
      >
        <Icon path={ICON_PATHS.search} size="md" className="text-text-secondary mr-3" />
        <input
          type="text"
          placeholder="Search projects, proposals, messages..."
          className="w-full bg-transparent text-sm text-text-primary placeholder-text-secondary outline-none"
        />
      </div>

      {/* Welcome Section */}
      <div
        className={cn(
          "p-6 rounded-2xl",
          "bg-white",
          "shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]"
        )}
      >
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Welcome back{mounted && user?.username ? `, ${user.username}` : ""}!
        </h1>
        <p className="text-text-secondary">
          Here&apos;s what&apos;s happening with your projects today.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {mounted && user?.type && (
            <span className={cn(
              "inline-block px-3 py-1 rounded-full text-xs font-medium",
              "bg-primary/10 text-primary"
            )}>
              {user.type === "BOTH" ? "Buyer & Seller" : user.type === "BUYER" ? "Buyer" : "Seller"}
            </span>
          )}
          {mounted && user?.wallet?.publicKey && (
            <WalletAddress address={user.wallet.publicKey} />
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={cn(
              "p-5 rounded-2xl",
              "bg-white",
              "shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff]"
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  "bg-primary/10"
                )}
              >
                <Icon path={stat.icon} size="md" className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div
        className={cn(
          "p-6 rounded-2xl",
          "bg-white",
          "shadow-[6px_6px_12px_#d1d5db,-6px_-6px_12px_#ffffff]"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">Recent Activity</h2>
          <Link
            href={activitiesLink}
            className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <Icon path={ICON_PATHS.chevronRight} size="sm" className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner className="text-primary" />
            </div>
          ) : activities.length > 0 ? (
            activities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl",
                  "bg-background",
                  "shadow-[inset_2px_2px_4px_#d1d5db,inset_-2px_-2px_4px_#ffffff]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon path={getIconPath(activity.type)} size="sm" className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{activity.title}</p>
                    <p className="text-xs text-text-secondary">{activity.description}</p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary whitespace-nowrap">{activity.time}</span>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mb-3 shadow-inner">
                <Icon path={ICON_PATHS.clock} size="md" className="text-text-secondary/30" />
              </div>
              <p className="text-text-secondary text-sm">No recent activity</p>
              <p className="text-text-secondary/70 text-xs mt-1">Your activity will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
