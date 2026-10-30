import React from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Flame,
  GitCompare,
  Hourglass,
  ShieldAlert,
} from 'lucide-react';
import { BureauCode, CasePriority, CaseStatus, RiskLevel } from '../types/domain';

export const BUREAU_LABELS: Record<BureauCode, string> = {
  RB: 'Regulation Bureau (RB)',
  PGRC: 'Public Grievance Cell (PGRC)',
  AB: 'Approval Bureau (AB)',
  VIG: 'Vigilance Cell (VIG)',
  'RO-SC': 'Regional Office South-Central',
  'RO-N': 'Regional Office Northern',
  'RO-W': 'Regional Office Western',
  'RO-S': 'Regional Office Southern',
};

export function StatusBadge({ status, isOverdue }: { status: CaseStatus; isOverdue?: boolean }) {
  if (isOverdue && status !== 'Disposed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] whitespace-nowrap shrink-0">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>{status} · Overdue</span>
      </span>
    );
  }

  switch (status) {
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#FEF5E7] text-[#9A6700] border border-[#F5D9A6] whitespace-nowrap shrink-0">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Pending</span>
        </span>
      );
    case 'Under Process':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#E6F4F1] text-[#1D6B5E] border border-[#B5DFD7] whitespace-nowrap shrink-0">
          <Hourglass className="w-3 h-3 shrink-0" />
          <span>Under Process</span>
        </span>
      );
    case 'Transferred':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#F3EEFA] text-[#5E3A8C] border border-[#D8C7F0] whitespace-nowrap shrink-0">
          <ArrowRightLeft className="w-3 h-3 shrink-0" />
          <span>Transferred</span>
        </span>
      );
    case 'Disposed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#EAF7E9] text-[#2E8B57] border border-[#B7E4B1] whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Disposed</span>
        </span>
      );
  }
}

export function RiskBadge({
  level,
  score,
  isOverlap,
}: {
  level: RiskLevel;
  score?: number;
  isOverlap?: boolean;
}) {
  if (level === 'High') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#FDEDEC] text-[#B8322E] border border-[#F5B7B1] whitespace-nowrap shrink-0 tabular-nums">
        {isOverlap ? <GitCompare className="w-3 h-3 shrink-0" /> : <ShieldAlert className="w-3 h-3 shrink-0" />}
        <span>
          {isOverlap ? 'Overlap: ' : ''}High{score !== undefined ? ` (${score}/100)` : ''}
        </span>
      </span>
    );
  }
  if (level === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#FEF0E6] text-[#B35012] border border-[#F7C6A3] whitespace-nowrap shrink-0 tabular-nums">
        {isOverlap ? <GitCompare className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
        <span>
          {isOverlap ? 'Overlap: ' : ''}Medium{score !== undefined ? ` (${score}/100)` : ''}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#EAF7E9] text-[#2E8B57] border border-[#B7E4B1] whitespace-nowrap shrink-0 tabular-nums">
      <span>
        {isOverlap ? 'Overlap: ' : ''}Low{score !== undefined ? ` (${score}/100)` : ''}
      </span>
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: CasePriority }) {
  const styles: Record<CasePriority, string> = {
    Critical: 'text-[#B8322E] font-semibold',
    High: 'text-[#B35012] font-semibold',
    Medium: 'text-[#203528] font-medium',
    Low: 'text-[#718173] font-normal',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${styles[priority]} whitespace-nowrap`}>
      {priority === 'Critical' && <Flame className="w-3.5 h-3.5 text-[#D9534F] shrink-0" />}
      <span>{priority}</span>
    </span>
  );
}
