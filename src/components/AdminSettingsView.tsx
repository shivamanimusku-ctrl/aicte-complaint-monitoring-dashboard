import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  KeyRound,
  RotateCcw,
  Save,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import {
  ComplaintCategory,
  OverlapEngineConfig,
  SLAPolicyConfig,
  UserProfile,
} from '../types/domain';
import { BackendConnectionStatus } from '../services/dataService';
import { checkPermission } from '../utils/engine';

interface AdminSettingsViewProps {
  slaPolicy: SLAPolicyConfig;
  overlapConfig: OverlapEngineConfig;
  users: UserProfile[];
  currentUser: UserProfile;
  backendStatus: BackendConnectionStatus;
  onUpdateSLAPolicy: (next: SLAPolicyConfig) => void;
  onUpdateOverlapConfig: (next: OverlapEngineConfig) => void;
  onSwitchUser: (userId: string) => void;
  onResetDemoData: () => void;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  slaPolicy,
  overlapConfig,
  users,
  currentUser,
  backendStatus,
  onUpdateSLAPolicy,
  onUpdateOverlapConfig,
  onSwitchUser,
  onResetDemoData,
}) => {
  const [draftSla, setDraftSla] = useState<SLAPolicyConfig>(structuredClone(slaPolicy));
  const [draftOverlap, setDraftOverlap] = useState<OverlapEngineConfig>(
    structuredClone(overlapConfig)
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const canManage = checkPermission(currentUser, 'MANAGE_SETTINGS').allowed;

  const handleSaveSettings = () => {
    const perm = checkPermission(currentUser, 'MANAGE_SETTINGS');
    if (!perm.allowed) {
      setFeedback({
        type: 'error',
        text:
          perm.reason ||
          'Only System Administrators can save SLA policies and Overlap Engine weights.',
      });
      return;
    }
    onUpdateSLAPolicy(draftSla);
    onUpdateOverlapConfig(draftOverlap);
    setFeedback({
      type: 'success',
      text: 'SLA Policy and Overlap Intelligence weights updated across all dashboards.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#203528]">
            Administration, SLA Policies & Overlap Engine Configuration
          </h2>
          <p className="text-xs text-[#718173]">
            Configure statutory SLA deadlines, Overlap Engine signal weights, Role-Based Access Control (RBAC), and backend persistence
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onResetDemoData();
              setFeedback({
                type: 'success',
                text: 'Demo dataset reset to clean initial AICTE seed records.',
              });
            }}
            className="px-3.5 py-2 rounded-lg bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] text-xs font-semibold hover:bg-[#d8f0d6] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#398653]" />
            <span>Reset Demo Seed Data</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-lg bg-[#398653] text-white text-xs font-semibold hover:bg-[#2F7446] flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Policy & Engine Config</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-[#EAF7E9] border-[#B7E4B1] text-[#203528]'
              : 'bg-[#FDEDEC] border-[#F5B7B1] text-[#B8322E]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {!canManage && (
        <div className="bg-[#FEF5E7] border border-[#F5D9A6] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9A6700]">
          <span>
            <strong>Role Notice:</strong> Your active role is{' '}
            <strong>{currentUser.role}</strong> ({currentUser.displayName}). Modifying system-wide SLA policies and Overlap Engine weights requires the <strong>System Administrator</strong> role.
          </span>
          <button
            type="button"
            onClick={() => onSwitchUser('USR-SYS-01')}
            className="px-3 py-1.5 rounded-lg bg-[#398653] text-white font-semibold whitespace-nowrap cursor-pointer"
          >
            Switch to System Administrator
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Configurable Overlap Engine Weights */}
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
          <div className="bg-[#EAF7E9] -mx-5 -mt-5 px-5 py-3.5 rounded-t-xl border-b border-[#DFEADF] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#398653]" />
            <h3 className="text-sm font-bold text-[#203528]">
              Overlap Intelligence Engine — Signal Weights & Thresholds
            </h3>
          </div>

          <div className="space-y-3 pt-1 text-xs">
            {(
              [
                {
                  key: 'institutionMatch',
                  label: '1. Institution Identity Match (Exact AICTE PID / Fuzzy Name)',
                },
                {
                  key: 'crossBureauActive',
                  label: '2. Cross-Bureau Parallel Active Handling',
                },
                {
                  key: 'categorySimilarity',
                  label: '3. Complaint Category Correlation',
                },
                {
                  key: 'descriptionSimilarity',
                  label: '4. Description & Subject Keyword Similarity',
                },
                {
                  key: 'temporalOverlap',
                  label: '5. Active Review Window Overlap',
                },
              ] as const
            ).map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between font-semibold text-[#203528]">
                  <span>{item.label}</span>
                  <span className="font-mono text-[#398653]">
                    {draftOverlap.weights[item.key]} pts
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={draftOverlap.weights[item.key]}
                  onChange={(e) =>
                    setDraftOverlap({
                      ...draftOverlap,
                      weights: {
                        ...draftOverlap.weights,
                        [item.key]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-[#398653]"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#DFEADF]">
              <div>
                <label className="block font-semibold text-[#203528] mb-1">
                  High-Risk Score Threshold (0–100)
                </label>
                <input
                  type="number"
                  min={55}
                  max={95}
                  value={draftOverlap.highRiskThreshold}
                  onChange={(e) =>
                    setDraftOverlap({
                      ...draftOverlap,
                      highRiskThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 border border-[#DFEADF] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#203528] mb-1">
                  Medium-Risk Score Threshold (0–100)
                </label>
                <input
                  type="number"
                  min={30}
                  max={70}
                  value={draftOverlap.mediumRiskThreshold}
                  onChange={(e) =>
                    setDraftOverlap({
                      ...draftOverlap,
                      mediumRiskThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 border border-[#DFEADF] rounded-lg font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Configurable SLA Policy */}
        <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
          <div className="bg-[#EAF7E9] -mx-5 -mt-5 px-5 py-3.5 rounded-t-xl border-b border-[#DFEADF] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#203528]">
              SLA Policy Configuration (Days by Complaint Category)
            </h3>
            <span className="text-[11px] font-mono text-[#398653]">{draftSla.timezone}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
            {(Object.keys(draftSla.categorySLADays) as ComplaintCategory[]).map((cat) => (
              <div
                key={cat}
                className="p-2.5 rounded-lg bg-[#F7FBF7] border border-[#DFEADF] flex items-center justify-between gap-2"
              >
                <span className="font-medium text-[#203528] truncate" title={cat}>
                  {cat}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={draftSla.categorySLADays[cat]}
                    onChange={(e) =>
                      setDraftSla({
                        ...draftSla,
                        categorySLADays: {
                          ...draftSla.categorySLADays,
                          [cat]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-14 px-2 py-1 text-center font-mono border border-[#DFEADF] rounded bg-white"
                  />
                  <span className="text-[#718173]">d</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#DFEADF] text-xs">
            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Approaching Deadline Warning (Days)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={draftSla.approachingDeadlineDays}
                onChange={(e) =>
                  setDraftSla({
                    ...draftSla,
                    approachingDeadlineDays: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-1.5 border border-[#DFEADF] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#203528] mb-1">
                Inactivity Alert Threshold (Days)
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={draftSla.inactivityThresholdDays}
                onChange={(e) =>
                  setDraftSla({
                    ...draftSla,
                    inactivityThresholdDays: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-1.5 border border-[#DFEADF] rounded-lg font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Panel 3: Role-Based Access Control (RBAC) Directory & Demo Role Switcher */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#203528]">
                Official User Directory & Role-Based Access Matrix (Demo Switcher)
              </h3>
              <p className="text-xs text-[#718173]">
                Switch active account to verify role & scope restrictions (Senior Management read-only, Bureau isolation, Regional scope, System Admin)
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#EAF7E9] text-[#203528] font-semibold border-b border-[#DFEADF]">
                <th className="py-2.5 px-4">Official Name & ID</th>
                <th className="py-2.5 px-4">Designation</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Bureau & Region Scope</th>
                <th className="py-2.5 px-4 text-right">Session Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFEADF]">
              {users.map((u) => {
                const isCurrent = u.userId === currentUser.userId;
                return (
                  <tr key={u.userId} className={isCurrent ? 'bg-[#EAF7E9]/40' : 'hover:bg-[#F7FBF7]'}>
                    <td className="py-2.5 px-4 font-semibold text-[#203528]">
                      {u.displayName}{' '}
                      <span className="font-mono text-[11px] text-[#718173]">({u.userId})</span>
                    </td>
                    <td className="py-2.5 px-4 text-[#718173]">{u.designation}</td>
                    <td className="py-2.5 px-4 font-semibold text-[#398653]">{u.role}</td>
                    <td className="py-2.5 px-4 font-mono">
                      {u.bureau} · {u.region}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isCurrent ? (
                        <span className="px-2.5 py-1 rounded bg-[#398653] text-white font-semibold">
                          Active Session
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSwitchUser(u.userId)}
                          className="px-2.5 py-1 rounded bg-[#EAF7E9] text-[#203528] border border-[#B7E4B1] hover:bg-[#d8f0d6] font-semibold cursor-pointer"
                        >
                          Switch to Role
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel 4: Backend & Firebase Integration Instructions */}
      <div className="bg-white border border-[#DFEADF] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EAF7E9] flex items-center justify-center text-[#398653]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203528]">
              Data Service Abstraction & Production Backend Connection Guide
            </h3>
            <p className="text-xs text-[#718173]">
              Current Mode: <strong>{backendStatus.label}</strong>
            </p>
          </div>
        </div>
        <div className="bg-[#F7FBF7] border border-[#DFEADF] rounded-lg p-4 text-xs text-[#203528] space-y-2">
          <p>
            <strong>Demo Data Disclosure:</strong> This instance runs on fictional AICTE seed data with local state persistence (`src/services/dataService.ts`). Changes made in Demo Sandbox Mode are stored in your browser and are not synchronized with a live AICTE production portal.
          </p>
          <p>
            <strong>Connecting Firebase Authentication & Cloud Firestore:</strong> Set <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DFEADF]">VITE_FIREBASE_API_KEY</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DFEADF]">VITE_FIREBASE_AUTH_DOMAIN</code>, and <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DFEADF]">VITE_FIREBASE_PROJECT_ID</code> in your environment configuration, and set <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DFEADF]">GEMINI_API_KEY</code> on the server for live Gemini AI Case Brief generation via <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DFEADF]">/api/ai/case-brief</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
