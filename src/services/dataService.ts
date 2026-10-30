import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import {
  CaseAction,
  CaseRecord,
  CoordinationWorkspace,
  Institution,
  NotificationItem,
  OverlapAlert,
  OverlapEngineConfig,
  SavedFilterView,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import {
  INITIAL_OVERLAP_CONFIG,
  INITIAL_SLA_POLICY,
  SEED_ACTIONS,
  SEED_CASES,
  SEED_INSTITUTIONS,
  SEED_NOTIFICATIONS,
  SEED_SAVED_VIEWS,
  SEED_USERS,
  SEED_WORKSPACES,
} from '../data/seedData';

const STORAGE_KEY = 'aicte_complaint_dashboard_state_v2';

export interface PersistedAppState {
  institutions: Institution[];
  cases: CaseRecord[];
  actions: CaseAction[];
  workspaces: CoordinationWorkspace[];
  users: UserProfile[];
  notifications: NotificationItem[];
  savedViews: SavedFilterView[];
  slaPolicy: SLAPolicyConfig;
  overlapConfig: OverlapEngineConfig;
  overlapReviews: Record<
    string,
    Pick<OverlapAlert, 'reviewStatus' | 'reviewOutcome' | 'reviewedBy' | 'reviewedAt' | 'reviewRemarks'>
  >;
}

export interface BackendConnectionStatus {
  mode: 'firebase_live' | 'demo_local';
  projectId?: string;
  label: string;
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function getBackendConnectionStatus(): BackendConnectionStatus {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (apiKey && projectId && apiKey.trim().length > 5 && projectId.trim().length > 2) {
    try {
      if (!getApps().length) {
        firebaseApp = initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        });
      } else {
        firebaseApp = getApps()[0];
      }
      firestoreDb = getFirestore(firebaseApp);
      return {
        mode: 'firebase_live',
        projectId,
        label: `Firebase Cloud Firestore (${projectId})`,
      };
    } catch {
      // Fallback to demo mode if config is invalid
    }
  }

  return {
    mode: 'demo_local',
    label: 'Demo Sandbox Mode (Fictional Seed Data · Local Persistence)',
  };
}

export function getInitialDemoState(): PersistedAppState {
  const seededActions = structuredClone(SEED_ACTIONS);
  const casesWithActions = new Set(seededActions.map((a) => a.caseId));

  // Ensure every seeded case has at least its intake & assignment audit entries
  for (const c of SEED_CASES) {
    if (!casesWithActions.has(c.caseId)) {
      seededActions.push({
        actionId: `ACT-INIT-${c.caseId.slice(-4)}`,
        caseId: c.caseId,
        actionType: 'Complaint Received',
        actorId: c.assignedOfficerId,
        bureau: c.sourceBureau,
        timestamp: c.receivedAt,
        newValue: 'Pending',
        remarks: `Complaint docket ${c.caseId} registered via ${c.sourceBureau} concerning ${c.category}.`,
        documentReferences: c.documents.map((d) => d.docId),
      });
      if (c.status !== 'Pending' || c.lastActionAt !== c.receivedAt) {
        seededActions.push({
          actionId: `ACT-PROC-${c.caseId.slice(-4)}`,
          caseId: c.caseId,
          actionType: c.status === 'Disposed' ? 'Disposal Approved' : 'Action Recorded',
          actorId: c.assignedOfficerId,
          bureau: c.currentBureau,
          timestamp: c.lastActionAt,
          previousValue: 'Pending',
          newValue: c.status,
          remarks: `Status updated to ${c.status}. Scheduled action: ${c.nextAction}`,
          documentReferences: [],
        });
      }
    }
  }

  return {
    institutions: structuredClone(SEED_INSTITUTIONS),
    cases: structuredClone(SEED_CASES),
    actions: seededActions,
    workspaces: structuredClone(SEED_WORKSPACES),
    users: structuredClone(SEED_USERS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    savedViews: structuredClone(SEED_SAVED_VIEWS),
    slaPolicy: structuredClone(INITIAL_SLA_POLICY),
    overlapConfig: structuredClone(INITIAL_OVERLAP_CONFIG),
    overlapReviews: {
      'OVL-AICTE-2026-0801__AICTE-2026-0802': {
        reviewStatus: 'Reviewed',
        reviewOutcome: 'Related — Separate Issues',
        reviewedBy: 'Dr. Arvind Deshmukh (Director, RB)',
        reviewedAt: '2026-10-22T10:25:00Z',
        reviewRemarks:
          'RB is examining institutional EOA cadre ratio compliance while PGRC is pursuing individual faculty salary arrears. Linked in Coordination Workspace CW-2026-01.',
      },
    },
  };
}

export function loadAppState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialDemoState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as PersistedAppState;
    if (!parsed.cases || !parsed.institutions) {
      return getInitialDemoState();
    }
    return parsed;
  } catch {
    return getInitialDemoState();
  }
}

export function saveAppState(state: PersistedAppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to persist state to localStorage:', err);
  }
}

export function resetDemoAppState(): PersistedAppState {
  const fresh = getInitialDemoState();
  saveAppState(fresh);
  return fresh;
}

export { firestoreDb };
