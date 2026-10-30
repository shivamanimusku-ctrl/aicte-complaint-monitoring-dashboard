import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  FolderPlus,
  GitCompare,
  History,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  BureauCode,
  CaseAction,
  CaseDocument,
  CaseFilterState,
  CasePriority,
  CaseRecord,
  CaseStatus,
  CoordinationStatus,
  CoordinationWorkspace,
  NavigationTab,
  OverlapAlert,
  OverlapReviewOutcome,
} from './types/domain';
import {
  getBackendConnectionStatus,
  loadAppState,
  PersistedAppState,
  resetDemoAppState,
  saveAppState,
} from './services/dataService';
import { REFERENCE_NOW_ISO } from './data/seedData';
import { runOverlapDetectionEngine } from './utils/engine';
import { CommandCenterView } from './components/CommandCenterView';
import { ComplaintRegistryView } from './components/ComplaintRegistryView';
import { Institution360View } from './components/Institution360View';
import { OverlapIntelligenceView } from './components/OverlapIntelligenceView';
import { CoordinationWorkspaceView } from './components/CoordinationWorkspaceView';
import { WorkflowHistoryView } from './components/WorkflowHistoryView';
import { ReportsAnalyticsView } from './components/ReportsAnalyticsView';
import { AlertsNotificationsView } from './components/AlertsNotificationsView';
import { AdminSettingsView } from './components/AdminSettingsView';
import { CaseDetailModal } from './components/CaseDetailModal';
import { BulkCsvImportModal, RegisterComplaintModal } from './components/Modals';

const DEFAULT_FILTERS: CaseFilterState = {
  searchQuery: '',
  caseIdQuery: '',
  bureau: 'ALL',
  region: 'ALL',
  category: 'ALL',
  status: 'ALL',
  riskLevel: 'ALL',
  assignedOfficerId: 'ALL',
  dateFrom: '',
  dateTo: '',
  overdueOnly: false,
  potentialOverlapOnly: false,
};

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'command-center',
    label: 'Command Center',
    shortDesc: 'Executive Triage & SLA Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'complaint-registry',
    label: 'Complaint Registry',
    shortDesc: 'Master Multi-Bureau Docket Table',
    icon: ClipboardList,
  },
  {
    id: 'institution-360',
    label: 'Institution 360°',
    shortDesc: 'Consolidated Profile by AICTE PID',
    icon: Building2,
  },
  {
    id: 'overlap-intelligence',
    label: 'Overlap Intelligence',
    shortDesc: 'Cross-Bureau Duplicate & Risk Engine',
    icon: GitCompare,
  },
  {
    id: 'coordination-workspace',
    label: 'Coordination Workspace',
    shortDesc: 'Joint Inter-Bureau Action Tracking',
    icon: FolderKanban,
  },
  {
    id: 'workflow-history',
    label: 'Workflow & Action History',
    shortDesc: 'Immutable Audit & Transfer Queue',
    icon: History,
  },
  {
    id: 'reports-analytics',
    label: 'Reports & Analytics',
    shortDesc: 'SLA Compliance, Workload & Data Quality',
    icon: BarChart3,
  },
  {
    id: 'alerts-notifications',
    label: 'Alerts & Notifications',
    shortDesc: 'Deadlines, Overdue & Inactivity Reminders',
    icon: Bell,
  },
  {
    id: 'admin-settings',
    label: 'Administration & Settings',
    shortDesc: 'SLA Policies, Weights & RBAC Roles',
    icon: Settings,
  },
];

export default function App() {
  const [appState, setAppState] = useState<PersistedAppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<NavigationTab>('command-center');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string>('USR-BA-RB');
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('INST-1001');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('CW-2026-01');
  const [activeCaseModalId, setActiveCaseModalId] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);

  const [registryFilters, setRegistryFilters] = useState<CaseFilterState>(DEFAULT_FILTERS);
  const [globalSearchInput, setGlobalSearchInput] = useState('');
  const globalSearchRef = useRef<HTMLInputElement>(null);

  const referenceDate = useMemo(() => new Date(REFERENCE_NOW_ISO), []);
  const backendStatus = useMemo(() => getBackendConnectionStatus(), []);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Keyboard shortcuts: '/' focuses global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') {
        e.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentUser = useMemo(
    () =>
      appState.users.find((u) => u.userId === currentUserId) || appState.users[0],
    [appState.users, currentUserId]
  );

  // Dynamically run the explainable Overlap Intelligence Engine
  const { alerts: overlapAlerts, preventedFalsePositives } = useMemo(
    () =>
      runOverlapDetectionEngine(
        appState.cases,
        appState.institutions,
        appState.overlapReviews,
        appState.overlapConfig
      ),
    [appState.cases, appState.institutions, appState.overlapReviews, appState.overlapConfig]
  );

  const unreadNotificationsCount = useMemo(
    () => appState.notifications.filter((n) => !n.readAt).length,
    [appState.notifications]
  );

  const unreviewedOverlapsCount = useMemo(
    () => overlapAlerts.filter((a) => a.reviewStatus === 'Unreviewed').length,
    [overlapAlerts]
  );

  const activeModalCase = useMemo(
    () => appState.cases.find((c) => c.caseId === activeCaseModalId) || null,
    [appState.cases, activeCaseModalId]
  );

  const activeModalInstitution = useMemo(
    () =>
      activeModalCase
        ? appState.institutions.find((i) => i.institutionId === activeModalCase.institutionId)
        : undefined,
    [appState.institutions, activeModalCase]
  );

  // Navigation helpers
  const handleNavigateWithFilter = (
    tab: NavigationTab,
    partialFilter?: Partial<CaseFilterState>
  ) => {
    if (partialFilter) {
      setRegistryFilters({
        ...DEFAULT_FILTERS,
        ...partialFilter,
      });
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleOpenInstitution360 = (institutionId: string) => {
    setSelectedInstitutionId(institutionId);
    setActiveTab('institution-360');
    setMobileMenuOpen(false);
  };

  const handleOpenWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setActiveTab('coordination-workspace');
    setMobileMenuOpen(false);
  };

  // State mutation handlers (all append chronological audit entries!)
  const appendAction = (newAction: Omit<CaseAction, 'actionId' | 'timestamp'>): CaseAction => {
    const entry: CaseAction = {
      ...newAction,
      actionId: `ACT-${5001 + appState.actions.length + Math.floor(Math.random() * 90)}`,
      timestamp: new Date().toISOString(),
    };
    return entry;
  };

  const handleRegisterCase = (newCase: CaseRecord) => {
    const initialAction = appendAction({
      caseId: newCase.caseId,
      actionType: 'Complaint Received',
      actorId: currentUser.userId,
      bureau: newCase.sourceBureau,
      newValue: 'Pending',
      remarks: `New institutional complaint registered and assigned to ${newCase.currentBureau}.`,
      documentReferences: [],
    });

    setAppState((prev) => ({
      ...prev,
      cases: [newCase, ...prev.cases],
      actions: [initialAction, ...prev.actions],
      notifications: [
        {
          notificationId: `NOTIF-${Date.now()}`,
          recipientId: newCase.assignedOfficerId,
          caseId: newCase.caseId,
          type: 'Assignment Update',
          priority: newCase.priority,
          message: `New Case Registered: ${newCase.caseId} (${newCase.category}) assigned to ${newCase.currentBureau}.`,
          createdAt: new Date().toISOString(),
        },
        ...prev.notifications,
      ],
    }));
  };

  const handleBulkImportCases = (importedCases: CaseRecord[]) => {
    const newActions: CaseAction[] = importedCases.map((c, idx) => ({
      actionId: `ACT-IMP-${Date.now()}-${idx}`,
      caseId: c.caseId,
      actionType: 'Complaint Received',
      actorId: currentUser.userId,
      bureau: c.sourceBureau,
      timestamp: new Date().toISOString(),
      newValue: 'Pending',
      remarks: `Imported via validated Bulk CSV upload (${c.category}).`,
      documentReferences: [],
    }));

    setAppState((prev) => ({
      ...prev,
      cases: [...importedCases, ...prev.cases],
      actions: [...newActions, ...prev.actions],
    }));
  };

  const handleChangeStatus = (caseId: string, newStatus: CaseStatus, remarks: string) => {
    setAppState((prev) => {
      const target = prev.cases.find((c) => c.caseId === caseId);
      if (!target) return prev;

      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: newStatus === 'Disposed' ? 'Disposal Approved' : 'Status Changed',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        previousValue: target.status,
        newValue: newStatus,
        remarks,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                status: newStatus,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  const handleRecordAction = (
    caseId: string,
    remarks: string,
    nextAction: string,
    confidential: boolean
  ) => {
    setAppState((prev) => {
      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length + 1}`,
        caseId,
        actionType: 'Action Recorded',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        newValue: nextAction,
        remarks,
        confidential,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                nextAction,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  const handleReassignOfficer = (caseId: string, newOfficerId: string, remarks: string) => {
    setAppState((prev) => {
      const target = prev.cases.find((c) => c.caseId === caseId);
      const oldOff = prev.users.find((u) => u.userId === target?.assignedOfficerId);
      const newOff = prev.users.find((u) => u.userId === newOfficerId);

      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Officer Reassigned',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        previousValue: oldOff?.displayName || target?.assignedOfficerId,
        newValue: newOff?.displayName || newOfficerId,
        remarks,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                assignedOfficerId: newOfficerId,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  const handleInitiateTransfer = (
    caseId: string,
    targetBureau: BureauCode,
    targetOfficerId: string,
    reason: string
  ) => {
    setAppState((prev) => {
      const target = prev.cases.find((c) => c.caseId === caseId);
      if (!target) return prev;

      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Bureau Transfer Initiated',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        previousValue: `Bureau: ${target.currentBureau}`,
        newValue: `Pending Transfer → ${targetBureau}`,
        remarks: reason,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                status: 'Transferred',
                pendingTransferToBureau: targetBureau,
                pendingTransferOfficerId: targetOfficerId,
                pendingTransferReason: reason,
                nextAction: `Await transfer acceptance by ${targetBureau}`,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
        notifications: [
          {
            notificationId: `NOTIF-${Date.now()}`,
            recipientId: targetOfficerId,
            caseId,
            type: 'Pending Transfer',
            priority: target.priority,
            message: `Inter-Bureau Transfer Initiated: Case ${caseId} transferred from ${target.currentBureau} to ${targetBureau}. Reason: ${reason}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      };
    });
  };

  const handleAcceptTransfer = (caseId: string, remarks: string) => {
    setAppState((prev) => {
      const target = prev.cases.find((c) => c.caseId === caseId);
      if (!target || !target.pendingTransferToBureau) return prev;

      const newBureau = target.pendingTransferToBureau;
      const newOfficer = target.pendingTransferOfficerId || target.assignedOfficerId;

      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Bureau Transfer Accepted',
        actorId: currentUser.userId,
        bureau: newBureau,
        timestamp: new Date().toISOString(),
        previousValue: `Bureau: ${target.currentBureau}`,
        newValue: `Accepted by ${newBureau}`,
        remarks,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                currentBureau: newBureau,
                assignedOfficerId: newOfficer,
                status: 'Under Process',
                pendingTransferToBureau: undefined,
                pendingTransferOfficerId: undefined,
                pendingTransferReason: undefined,
                nextAction: `Proceed with ${newBureau} regulatory review`,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  const handleUpdateDeadline = (caseId: string, newDueDate: string, reason: string) => {
    setAppState((prev) => {
      const target = prev.cases.find((c) => c.caseId === caseId);
      if (!target) return prev;

      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Deadline Updated',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        previousValue: target.dueAt.slice(0, 10),
        newValue: newDueDate,
        remarks: `SLA Deadline updated: ${reason}`,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                dueAt: `${newDueDate}T17:00:00Z`,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  const handleEscalateCase = (caseId: string, authority: string, remarks: string) => {
    setAppState((prev) => {
      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Escalation Initiated',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        previousValue: 'Standard Bureau Processing',
        newValue: `Escalated to ${authority}`,
        remarks,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                priority: 'Critical',
                nextAction: `Escalated to ${authority}: ${remarks}`,
                lastActionAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
        notifications: [
          {
            notificationId: `NOTIF-${Date.now()}`,
            recipientId: 'ALL',
            caseId,
            type: 'Escalation Alert',
            priority: 'Critical',
            message: `Case ${caseId} escalated to ${authority} by ${currentUser.displayName}: ${remarks}`,
            createdAt: new Date().toISOString(),
          },
          ...prev.notifications,
        ],
      };
    });
  };

  const handleAddDocument = (
    caseId: string,
    title: string,
    fileType: CaseDocument['fileType']
  ) => {
    const docId = `DOC-${910 + Math.floor(Math.random() * 900)}`;
    setAppState((prev) => {
      const act: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId,
        actionType: 'Action Recorded',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        newValue: title,
        remarks: `Uploaded supporting document "${title}" (${fileType}).`,
        documentReferences: [docId],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) =>
          c.caseId === caseId
            ? {
                ...c,
                documents: [
                  ...c.documents,
                  {
                    docId,
                    title,
                    fileType,
                    uploadedBy: currentUser.displayName,
                    uploadedAt: new Date().toISOString(),
                    sizeKb: 680,
                    bureau: currentUser.bureau,
                  },
                ],
                lastActionAt: new Date().toISOString(),
              }
            : c
        ),
        actions: [act, ...prev.actions],
      };
    });
  };

  // Overlap Review & Coordination Workspace Handlers
  const handleReviewOverlap = (
    alertId: string,
    outcome: OverlapReviewOutcome,
    remarks: string,
    dismiss?: boolean
  ) => {
    setAppState((prev) => ({
      ...prev,
      overlapReviews: {
        ...prev.overlapReviews,
        [alertId]: {
          reviewStatus: dismiss ? 'Dismissed' : 'Reviewed',
          reviewOutcome: outcome,
          reviewedBy: `${currentUser.displayName} (${currentUser.bureau})`,
          reviewedAt: new Date().toISOString(),
          reviewRemarks: remarks,
        },
      },
    }));
  };

  const handleLinkCasesFromOverlap = (caseIds: [string, string]) => {
    const [idA, idB] = caseIds;
    setAppState((prev) => {
      const actA: CaseAction = {
        actionId: `ACT-${5001 + prev.actions.length}`,
        caseId: idA,
        actionType: 'Cases Linked',
        actorId: currentUser.userId,
        bureau: currentUser.bureau,
        timestamp: new Date().toISOString(),
        newValue: `Linked with ${idB}`,
        remarks: `Cross-linked with parallel case ${idB} via Overlap Intelligence Engine.`,
        documentReferences: [],
      };

      return {
        ...prev,
        cases: prev.cases.map((c) => {
          if (c.caseId === idA && !c.relatedCaseIds.includes(idB)) {
            return { ...c, relatedCaseIds: [...c.relatedCaseIds, idB] };
          }
          if (c.caseId === idB && !c.relatedCaseIds.includes(idA)) {
            return { ...c, relatedCaseIds: [...c.relatedCaseIds, idA] };
          }
          return c;
        }),
        actions: [actA, ...prev.actions],
      };
    });
  };

  const handleCreateOrOpenWorkspaceFromAlert = (alert: OverlapAlert) => {
    const existing = appState.workspaces.find(
      (w) =>
        w.relatedCaseIds.includes(alert.caseIds[0]) &&
        w.relatedCaseIds.includes(alert.caseIds[1])
    );
    if (existing) {
      handleOpenWorkspace(existing.workspaceId);
      return;
    }

    const inst = appState.institutions.find((i) => i.institutionId === alert.institutionId);
    const c1 = appState.cases.find((c) => c.caseId === alert.caseIds[0]);
    const c2 = appState.cases.find((c) => c.caseId === alert.caseIds[1]);
    const wsId = `CW-2026-0${appState.workspaces.length + 1}`;

    const newWs: CoordinationWorkspace = {
      workspaceId: wsId,
      title: `${inst?.name || 'Institution'} — Joint ${c1?.currentBureau || 'RB'} & ${
        c2?.currentBureau || 'PGRC'
      } Coordination`,
      relatedCaseIds: [...alert.caseIds],
      institutionId: alert.institutionId,
      leadBureau: c1?.currentBureau || currentUser.bureau,
      coordinatorId: currentUser.userId,
      status: 'Open',
      priority: alert.riskLevel === 'High' ? 'Critical' : 'High',
      reviewDeadline: '2026-11-05T17:00:00Z',
      supportingDocs: [],
      actionItems: [
        {
          itemId: `AI-${Date.now()}`,
          title: `Consolidate show-cause requisitions across ${alert.caseIds[0]} and ${alert.caseIds[1]}`,
          assignedBureau: c1?.currentBureau || currentUser.bureau,
          assignedOfficerId: currentUser.userId,
          dueDate: '2026-11-02',
          completed: false,
        },
      ],
      notes: [
        {
          noteId: `NOTE-${Date.now()}`,
          authorId: currentUser.userId,
          bureau: currentUser.bureau,
          timestamp: new Date().toISOString(),
          content: `Coordination Workspace initialized from Overlap Alert ${alert.alertId} (Risk Score: ${alert.riskScore}/100).`,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAppState((prev) => ({
      ...prev,
      workspaces: [newWs, ...prev.workspaces],
    }));
    handleOpenWorkspace(wsId);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#203528] flex flex-col lg:flex-row">
      {/* Mobile Slide-Out Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#203528]/35 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* White Sidebar with Subtle Light-Green Border */}
      <aside
        aria-label="Main Sidebar Navigation"
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-[#FFFFFF] border-r border-[#DFEADF] flex flex-col justify-between transition-all duration-200 no-print ${
          sidebarCollapsed ? 'w-20' : 'w-68'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Emblem & Brand Area */}
        <div>
          <div className="h-16 px-4 border-b border-[#DFEADF] flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[#398653] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#203528] truncate">
                    AICTE CMS Portal
                  </div>
                  <div className="text-[11px] text-[#718173] truncate">
                    Complaint & Overlap Monitor
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="hidden lg:flex p-1.5 rounded-lg text-[#718173] hover:bg-[#EAF7E9] hover:text-[#398653] cursor-pointer"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 9 Navigation Items */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              const badgeCount =
                item.id === 'overlap-intelligence'
                  ? unreviewedOverlapsCount
                  : item.id === 'alerts-notifications'
                  ? unreadNotificationsCount
                  : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#EAF7E9] text-[#203528] font-bold'
                      : 'text-[#203528] hover:bg-[#F7FBF7] font-medium'
                  }`}
                >
                  {/* Slim Green Active Indicator */}
                  {isSelected && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#398653]" />
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-[#398653]' : 'text-[#718173]'
                      }`}
                    />
                    {!sidebarCollapsed && (
                      <span className="text-xs truncate">{item.label}</span>
                    )}
                  </div>

                  {!sidebarCollapsed && badgeCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#398653] text-white font-mono text-[10px] font-bold tabular-nums">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Demo Mode Transparency Badge */}
        {!sidebarCollapsed && (
          <div className="p-3.5 m-3 rounded-xl bg-[#F7FBF7] border border-[#DFEADF] text-[11px] space-y-1">
            <div className="font-bold text-[#398653] flex items-center gap-1.5">
              <span>{backendStatus.mode === 'firebase_live' ? 'Live Firestore' : 'Demo Sandbox Mode'}</span>
            </div>
            <p className="text-[#718173] leading-snug">
              Fictional AICTE dataset for evaluation. Changes persist locally and are not synced to a live AICTE server.
            </p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F7FBF7]/60">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#FFFFFF] border-b border-[#DFEADF] px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          {/* Left: Mobile Menu Trigger + Global Search */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
              className="lg:hidden p-2 rounded-lg border border-[#DFEADF] text-[#203528] hover:bg-[#EAF7E9]"
            >
              <Menu className="w-4 h-4" />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (globalSearchInput.trim()) {
                  handleNavigateWithFilter('complaint-registry', {
                    searchQuery: globalSearchInput.trim(),
                  });
                }
              }}
              className="relative flex-1"
            >
              <Search className="w-4 h-4 text-[#398653] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={globalSearchRef}
                type="text"
                value={globalSearchInput}
                onChange={(e) => setGlobalSearchInput(e.target.value)}
                placeholder="Search Case ID, Institution name, AICTE Permanent ID, or press '/'..."
                aria-label="Global search across cases and institutions"
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#F7FBF7] border border-[#DFEADF] rounded-lg text-[#203528] placeholder-[#718173] focus:bg-white focus:outline-none focus:border-[#398653]"
              />
            </form>
          </div>

          {/* Right: Register CTA + Notification Bell + Role Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] transition-colors whitespace-nowrap cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Register Complaint</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('alerts-notifications')}
              aria-label={`Notifications (${unreadNotificationsCount} unread)`}
              className="relative p-2 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] text-[#203528] hover:bg-[#EAF7E9] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#398653]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D9534F] text-white font-mono text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* User Avatar, Name & Role Switcher */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#DFEADF]">
              <div className="w-8 h-8 rounded-full bg-[#EAF7E9] border border-[#B7E4B1] flex items-center justify-center text-xs font-bold text-[#398653]">
                {currentUser.displayName
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="hidden md:block">
                <select
                  value={currentUser.userId}
                  onChange={(e) => setCurrentUserId(e.target.value)}
                  aria-label="Switch Active User Role"
                  className="text-xs font-bold text-[#203528] bg-transparent focus:outline-none cursor-pointer"
                >
                  {appState.users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.displayName} — {u.role} ({u.bureau})
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-[#718173]">
                  Role: <strong className="text-[#398653]">{currentUser.role}</strong> · Bureau:{' '}
                  <span className="font-mono">{currentUser.bureau}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Context Header & Breadcrumb */}
        <div className="bg-[#FFFFFF] border-b border-[#DFEADF] px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-[#718173] flex items-center gap-1.5">
              <span>AICTE Integrated Monitoring Portal</span>
              <span>/</span>
              <span className="text-[#398653] font-semibold">
                {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#203528] mt-0.5">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#718173]">
            <span className="px-2.5 py-1 rounded-md bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] font-medium">
              Demo Data · Active Role: <strong>{currentUser.role}</strong> ({currentUser.bureau})
            </span>
          </div>
        </div>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {activeTab === 'command-center' && (
            <CommandCenterView
              cases={appState.cases}
              institutions={appState.institutions}
              actions={appState.actions}
              overlapAlerts={overlapAlerts}
              users={appState.users}
              currentUser={currentUser}
              slaPolicy={appState.slaPolicy}
              referenceDate={referenceDate}
              onNavigateWithFilter={handleNavigateWithFilter}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenInstitution={handleOpenInstitution360}
            />
          )}

          {activeTab === 'complaint-registry' && (
            <ComplaintRegistryView
              cases={appState.cases}
              institutions={appState.institutions}
              users={appState.users}
              overlapAlerts={overlapAlerts}
              slaPolicy={appState.slaPolicy}
              referenceDate={referenceDate}
              filters={registryFilters}
              savedViews={appState.savedViews}
              onUpdateFilters={setRegistryFilters}
              onResetFilters={() => setRegistryFilters(DEFAULT_FILTERS)}
              onSaveFilterView={(name, filters) =>
                setAppState((prev) => ({
                  ...prev,
                  savedViews: [
                    ...prev.savedViews,
                    {
                      viewId: `VIEW-${Date.now()}`,
                      name,
                      userId: currentUser.userId,
                      filters,
                    },
                  ],
                }))
              }
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenInstitution={handleOpenInstitution360}
              onOpenRegisterModal={() => setShowRegisterModal(true)}
              onOpenCsvImportModal={() => setShowCsvImportModal(true)}
            />
          )}

          {activeTab === 'institution-360' && (
            <Institution360View
              institutions={appState.institutions}
              selectedInstitutionId={selectedInstitutionId}
              cases={appState.cases}
              actions={appState.actions}
              overlapAlerts={overlapAlerts}
              workspaces={appState.workspaces}
              users={appState.users}
              slaPolicy={appState.slaPolicy}
              referenceDate={referenceDate}
              onSelectInstitution={setSelectedInstitutionId}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenWorkspace={handleOpenWorkspace}
            />
          )}

          {activeTab === 'overlap-intelligence' && (
            <OverlapIntelligenceView
              overlapAlerts={overlapAlerts}
              preventedFalsePositives={preventedFalsePositives}
              cases={appState.cases}
              institutions={appState.institutions}
              users={appState.users}
              currentUser={currentUser}
              overlapConfig={appState.overlapConfig}
              onReviewOverlap={handleReviewOverlap}
              onLinkCasesFromOverlap={handleLinkCasesFromOverlap}
              onCreateOrOpenWorkspace={handleCreateOrOpenWorkspaceFromAlert}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenInstitution={handleOpenInstitution360}
              onNavigateToSettings={() => setActiveTab('admin-settings')}
            />
          )}

          {activeTab === 'coordination-workspace' && (
            <CoordinationWorkspaceView
              workspaces={appState.workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              cases={appState.cases}
              institutions={appState.institutions}
              users={appState.users}
              currentUser={currentUser}
              onSelectWorkspace={setSelectedWorkspaceId}
              onUpdateWorkspaceStatus={(wsId, newStatus) =>
                setAppState((prev) => ({
                  ...prev,
                  workspaces: prev.workspaces.map((w) =>
                    w.workspaceId === wsId
                      ? { ...w, status: newStatus, updatedAt: new Date().toISOString() }
                      : w
                  ),
                }))
              }
              onToggleActionItem={(wsId, itemId) =>
                setAppState((prev) => ({
                  ...prev,
                  workspaces: prev.workspaces.map((w) =>
                    w.workspaceId === wsId
                      ? {
                          ...w,
                          actionItems: w.actionItems.map((ai) =>
                            ai.itemId === itemId ? { ...ai, completed: !ai.completed } : ai
                          ),
                        }
                      : w
                  ),
                }))
              }
              onAddActionItem={(wsId, title, assignedBureau, assignedOfficerId, dueDate) =>
                setAppState((prev) => ({
                  ...prev,
                  workspaces: prev.workspaces.map((w) =>
                    w.workspaceId === wsId
                      ? {
                          ...w,
                          actionItems: [
                            ...w.actionItems,
                            {
                              itemId: `AI-${Date.now()}`,
                              title,
                              assignedBureau,
                              assignedOfficerId,
                              dueDate,
                              completed: false,
                            },
                          ],
                        }
                      : w
                  ),
                }))
              }
              onAddWorkspaceNote={(wsId, content) =>
                setAppState((prev) => ({
                  ...prev,
                  workspaces: prev.workspaces.map((w) =>
                    w.workspaceId === wsId
                      ? {
                          ...w,
                          notes: [
                            ...w.notes,
                            {
                              noteId: `NOTE-${Date.now()}`,
                              authorId: currentUser.userId,
                              bureau: currentUser.bureau,
                              timestamp: new Date().toISOString(),
                              content,
                            },
                          ],
                        }
                      : w
                  ),
                }))
              }
              onEscalateWorkspace={(wsId, authority, note) =>
                setAppState((prev) => ({
                  ...prev,
                  workspaces: prev.workspaces.map((w) =>
                    w.workspaceId === wsId
                      ? {
                          ...w,
                          escalatedTo: authority,
                          notes: [
                            ...w.notes,
                            {
                              noteId: `NOTE-${Date.now()}`,
                              authorId: currentUser.userId,
                              bureau: currentUser.bureau,
                              timestamp: new Date().toISOString(),
                              content: `[ESCALATED TO ${authority}]: ${note}`,
                            },
                          ],
                        }
                      : w
                  ),
                }))
              }
              onCreateWorkspace={(payload) => {
                const wsId = `CW-2026-0${appState.workspaces.length + 1}`;
                const created: CoordinationWorkspace = {
                  workspaceId: wsId,
                  title: payload.title,
                  institutionId: payload.institutionId,
                  relatedCaseIds: payload.relatedCaseIds,
                  leadBureau: payload.leadBureau,
                  coordinatorId: payload.coordinatorId,
                  status: 'Open',
                  priority: payload.priority,
                  reviewDeadline: payload.reviewDeadline,
                  supportingDocs: [],
                  actionItems: [],
                  notes: [
                    {
                      noteId: `NOTE-${Date.now()}`,
                      authorId: currentUser.userId,
                      bureau: currentUser.bureau,
                      timestamp: new Date().toISOString(),
                      content: 'Inter-bureau coordination workspace initialized.',
                    },
                  ],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                setAppState((prev) => ({
                  ...prev,
                  workspaces: [created, ...prev.workspaces],
                }));
                setSelectedWorkspaceId(wsId);
              }}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenInstitution={handleOpenInstitution360}
            />
          )}

          {activeTab === 'workflow-history' && (
            <WorkflowHistoryView
              actions={appState.actions}
              cases={appState.cases}
              institutions={appState.institutions}
              users={appState.users}
              currentUser={currentUser}
              onAcceptTransfer={handleAcceptTransfer}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
            />
          )}

          {activeTab === 'reports-analytics' && (
            <ReportsAnalyticsView
              cases={appState.cases}
              institutions={appState.institutions}
              overlapAlerts={overlapAlerts}
              users={appState.users}
              currentUser={currentUser}
              slaPolicy={appState.slaPolicy}
              referenceDate={referenceDate}
              onReassignOfficer={handleReassignOfficer}
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
              onOpenInstitution={handleOpenInstitution360}
            />
          )}

          {activeTab === 'alerts-notifications' && (
            <AlertsNotificationsView
              notifications={appState.notifications}
              cases={appState.cases}
              overlapAlerts={overlapAlerts}
              slaPolicy={appState.slaPolicy}
              referenceDate={referenceDate}
              onMarkAsRead={(notificationId) =>
                setAppState((prev) => ({
                  ...prev,
                  notifications: prev.notifications.map((n) =>
                    n.notificationId === notificationId
                      ? { ...n, readAt: new Date().toISOString() }
                      : n
                  ),
                }))
              }
              onMarkAllAsRead={() =>
                setAppState((prev) => ({
                  ...prev,
                  notifications: prev.notifications.map((n) => ({
                    ...n,
                    readAt: n.readAt || new Date().toISOString(),
                  })),
                }))
              }
              onOpenCase={(caseId) => setActiveCaseModalId(caseId)}
            />
          )}

          {activeTab === 'admin-settings' && (
            <AdminSettingsView
              slaPolicy={appState.slaPolicy}
              overlapConfig={appState.overlapConfig}
              users={appState.users}
              currentUser={currentUser}
              backendStatus={backendStatus}
              onUpdateSLAPolicy={(slaPolicy) =>
                setAppState((prev) => ({ ...prev, slaPolicy }))
              }
              onUpdateOverlapConfig={(overlapConfig) =>
                setAppState((prev) => ({ ...prev, overlapConfig }))
              }
              onSwitchUser={(userId) => setCurrentUserId(userId)}
              onResetDemoData={() => setAppState(resetDemoAppState())}
            />
          )}
        </main>
      </div>

      {/* Case Details & AI Brief Modal */}
      {activeModalCase && (
        <CaseDetailModal
          caseRecord={activeModalCase}
          institution={activeModalInstitution}
          allCases={appState.cases}
          actions={appState.actions}
          overlapAlerts={overlapAlerts}
          users={appState.users}
          currentUser={currentUser}
          slaPolicy={appState.slaPolicy}
          referenceDate={referenceDate}
          onClose={() => setActiveCaseModalId(null)}
          onSelectCase={(caseId) => setActiveCaseModalId(caseId)}
          onOpenInstitution={handleOpenInstitution360}
          onOpenOverlapScreen={() => setActiveTab('overlap-intelligence')}
          onChangeStatus={handleChangeStatus}
          onRecordAction={handleRecordAction}
          onReassignOfficer={handleReassignOfficer}
          onInitiateTransfer={handleInitiateTransfer}
          onAcceptTransfer={handleAcceptTransfer}
          onUpdateDeadline={handleUpdateDeadline}
          onEscalateCase={handleEscalateCase}
          onAddDocument={handleAddDocument}
        />
      )}

      {/* Register New Complaint Modal */}
      {showRegisterModal && (
        <RegisterComplaintModal
          institutions={appState.institutions}
          users={appState.users}
          currentUser={currentUser}
          existingCases={appState.cases}
          slaPolicy={appState.slaPolicy}
          referenceDate={referenceDate}
          onClose={() => setShowRegisterModal(false)}
          onRegisterCase={handleRegisterCase}
        />
      )}

      {/* Bulk CSV Import Modal */}
      {showCsvImportModal && (
        <BulkCsvImportModal
          institutions={appState.institutions}
          existingCases={appState.cases}
          currentUser={currentUser}
          slaPolicy={appState.slaPolicy}
          referenceDate={referenceDate}
          onClose={() => setShowCsvImportModal(false)}
          onImportCases={handleBulkImportCases}
        />
      )}
    </div>
  );
}
