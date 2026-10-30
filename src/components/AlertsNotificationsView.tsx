import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  CheckCheck,
  Clock,
  Eye,
  GitCompare,
  ShieldAlert,
} from 'lucide-react';
import {
  CaseRecord,
  NotificationItem,
  NotificationType,
  OverlapAlert,
  SLAPolicyConfig,
} from '../types/domain';
import { evaluateCaseSLA } from '../utils/engine';
import { PriorityLabel } from './BadgeHelpers';

interface AlertsNotificationsViewProps {
  notifications: NotificationItem[];
  cases: CaseRecord[];
  overlapAlerts: OverlapAlert[];
  slaPolicy: SLAPolicyConfig;
  referenceDate: Date;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onOpenCase: (caseId: string) => void;
}

export const AlertsNotificationsView: React.FC<AlertsNotificationsViewProps> = ({
  notifications,
  cases,
  overlapAlerts,
  slaPolicy,
  referenceDate,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenCase,
}) => {
  const [typeFilter, setTypeFilter] = useState<'ALL' | NotificationType>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Dynamically combine persisted notifications with live SLA inactivity/overdue checks
  const combinedNotifications = useMemo(() => {
    const list = [...notifications];
    const existingCaseTypes = new Set(list.map((n) => `${n.caseId}__${n.type}`));

    for (const c of cases) {
      if (c.status === 'Disposed') continue;
      const ev = evaluateCaseSLA(c, referenceDate, slaPolicy);
      if (ev.isInactive && !existingCaseTypes.has(`${c.caseId}__Inactivity Alert`)) {
        list.push({
          notificationId: `LIVE-INACT-${c.caseId}`,
          recipientId: 'ALL',
          caseId: c.caseId,
          type: 'Inactivity Alert',
          priority: c.priority,
          message: `Case Inactivity Alert: Docket ${c.caseId} (${c.currentBureau} — ${c.category}) has had no recorded action for ${ev.daysSinceLastAction} days (threshold: ${slaPolicy.inactivityThresholdDays} days).`,
          createdAt: referenceDate.toISOString(),
        });
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, cases, referenceDate, slaPolicy]);

  const filteredList = useMemo(() => {
    return combinedNotifications.filter((n) => {
      if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
      if (unreadOnly && n.readAt) return false;
      return true;
    });
  }, [combinedNotifications, typeFilter, unreadOnly]);

  const unreadCount = useMemo(
    () => combinedNotifications.filter((n) => !n.readAt).length,
    [combinedNotifications]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#203528]">
            SLA Alerts & Notification Center ({unreadCount} Unread)
          </h2>
          <p className="text-xs text-[#718173]">
            Automated reminders for upcoming SLA deadlines, overdue breaches, case inactivity (&ge;{slaPolicy.inactivityThresholdDays}d), pending inter-bureau transfers, and unreviewed high-risk overlaps
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#203528] cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="accent-[#398653]"
            />
            <span>Unread Only</span>
          </label>
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="px-3.5 py-2 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] text-xs font-semibold hover:bg-[#d8f0d6] flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-[#398653]" />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            'ALL',
            'Overdue Alert',
            'Upcoming Deadline',
            'Inactivity Alert',
            'Pending Transfer',
            'High-Risk Overlap',
            'Escalation Alert',
          ] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              typeFilter === t
                ? 'bg-[#398653] text-white'
                : 'bg-white border border-[#DFEADF] text-[#203528] hover:bg-[#EAF7E9]'
            }`}
          >
            {t === 'ALL' ? 'All Alert Types' : t}
          </button>
        ))}
      </div>

      {/* Notification Cards */}
      <div className="space-y-3">
        {filteredList.map((n) => {
          const isUnread = !n.readAt;
          return (
            <div
              key={n.notificationId}
              className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                isUnread
                  ? 'bg-[#EAF7E9]/45 border-[#B7E4B1]'
                  : 'bg-white border-[#DFEADF] opacity-85'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-white border border-[#DFEADF] text-xs font-bold text-[#203528]">
                    {n.type}
                  </span>
                  <PriorityLabel priority={n.priority} />
                  <button
                    type="button"
                    onClick={() => onOpenCase(n.caseId)}
                    className="font-mono text-xs font-bold text-[#398653] hover:underline cursor-pointer"
                  >
                    Case: {n.caseId}
                  </button>
                  <span className="font-mono text-[11px] text-[#718173]">
                    {n.createdAt.slice(0, 16).replace('T', ' ')} UTC
                  </span>
                  {isUnread && (
                    <span className="px-2 py-0.5 rounded bg-[#398653] text-white text-[10px] font-bold">
                      UNREAD
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#203528] font-medium">{n.message}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenCase(n.caseId)}
                  className="px-3 py-1.5 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Case</span>
                </button>
                {isUnread && (
                  <button
                    type="button"
                    onClick={() => onMarkAsRead(n.notificationId)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#DFEADF] text-xs font-semibold text-[#203528] hover:bg-[#F7FBF7] cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
