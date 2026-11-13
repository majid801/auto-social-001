import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  CheckCircle2,
  RotateCcw,
  History,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { AutomationRule, AutomationLog } from '../../types';
import {
  runAutomationOnServer,
  fetchSchedulerState,
  syncSchedulerWithServer,
  ackServerDrafts,
} from '../../services/api';

const DEFAULT_AUTOMATIONS: Omit<AutomationRule, 'id' | 'userId'>[] = [
  {
    name: 'Daily Content Ideas',
    description: 'Generates fresh Instagram content concepts and hooks every morning at 08:00.',
    triggerType: 'schedule',
    frequency: 'Daily at 08:00',
    category: 'Education & Tech',
    timeOfDay: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isEnabled: true,
    executionCount: 0,
    lastExecutionTime: 'Ready',
    nextExecutionTime: 'Daily at 08:00',
    lastResult: 'Ready to run on schedule or manually',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Weekly Content Planning',
    description: 'Autonomous generation of a weekly Instagram content plan every Sunday evening.',
    triggerType: 'schedule',
    frequency: 'Weekly on Sunday',
    category: 'Growth & Business',
    timeOfDay: '19:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isEnabled: true,
    executionCount: 0,
    lastExecutionTime: 'Ready',
    nextExecutionTime: 'Weekly at 19:00',
    lastResult: 'Ready to run on schedule or manually',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Automatic Caption Generation',
    description: 'Generates Instagram captions and hashtags automatically for new media concepts.',
    triggerType: 'event',
    frequency: 'On Trigger',
    category: 'Creator Lifestyle',
    isEnabled: true,
    executionCount: 0,
    lastExecutionTime: 'Ready',
    nextExecutionTime: 'Event Driven',
    lastResult: 'Ready to generate caption & hashtags',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Reel Script Generation',
    description: 'Generates 30-second retention-optimized Reel scripts for trending AI & creator topics.',
    triggerType: 'schedule',
    frequency: 'Daily at 10:00',
    category: 'AI & Automation',
    timeOfDay: '10:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isEnabled: false,
    executionCount: 0,
    lastExecutionTime: 'Paused',
    nextExecutionTime: 'Paused',
    lastResult: 'Toggle on to activate scheduled runs',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Approved Automatic Publishing',
    description: 'Checks scheduled posts every minute and automatically publishes approved items via Publora.',
    triggerType: 'cron',
    frequency: 'Every 1 minute',
    isEnabled: true,
    executionCount: 0,
    lastExecutionTime: 'Active',
    nextExecutionTime: 'Every minute',
    lastResult: 'Monitoring scheduled queue',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: 'Category-Based Carousel Curator',
    description: 'Prepares educational carousel drafts tailored to your primary creator niche.',
    triggerType: 'schedule',
    frequency: 'Daily at 14:00',
    category: 'Artificial Intelligence',
    timeOfDay: '14:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isEnabled: false,
    executionCount: 0,
    lastExecutionTime: 'Paused',
    nextExecutionTime: 'Paused',
    lastResult: 'Ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const AutomationCentreView: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create / Edit modal state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('AI & Technology');
  const [formTrigger, setFormTrigger] = useState<'schedule' | 'event' | 'cron'>('schedule');
  const [formTime, setFormTime] = useState<string>('09:00');

  useEffect(() => {
    if (!user) return;
    loadAutomations();
  }, [user]);

  const loadAutomations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'automations'), where('userId', '==', user.uid));
      const snap = await getDocs(q);

      let loadedRules: AutomationRule[] = [];
      if (snap.empty) {
        for (const def of DEFAULT_AUTOMATIONS) {
          const docRef = await addDoc(collection(db, 'automations'), {
            userId: user.uid,
            ...def,
          });
          loadedRules.push({ id: docRef.id, userId: user.uid, ...def });
        }
      } else {
        loadedRules = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationRule[];
      }
      setAutomations(loadedRules);

      // Pull any drafts or logs created on server by background cron
      const stateRes = await fetchSchedulerState(user.uid).catch(() => null);
      if (stateRes?.success && Array.isArray(stateRes.generatedDrafts) && stateRes.generatedDrafts.length > 0) {
        for (const draft of stateRes.generatedDrafts) {
          await addDoc(collection(db, 'posts'), draft);
        }
        await ackServerDrafts(user.uid);
      }

      const logQuery = query(collection(db, 'automationLogs'), where('userId', '==', user.uid));
      const logSnap = await getDocs(logQuery);
      const dbLogs = (logSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationLog[]).sort(
        (a, b) => (b.executionTime || '').localeCompare(a.executionTime || '')
      );
      setLogs(dbLogs);

      await syncSchedulerWithServer({
        userId: user.uid,
        posts: [],
        automations: loadedRules,
        autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
      }).catch(() => {});
    } catch (err) {
      console.error('Error loading automations:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutomation = async (rule: AutomationRule) => {
    if (!rule.id || !user) return;
    const newState = !rule.isEnabled;
    try {
      await updateDoc(doc(db, 'automations', rule.id), {
        isEnabled: newState,
        updatedAt: new Date().toISOString(),
      });
      const updated = automations.map((a) =>
        a.id === rule.id ? { ...a, isEnabled: newState } : a
      );
      setAutomations(updated);
      syncSchedulerWithServer({
        userId: user.uid,
        posts: [],
        automations: updated,
        autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `automations/${rule.id}`);
    }
  };

  const handleRunNow = async (rule: AutomationRule) => {
    if (!rule.id || !user) return;
    setExecutingId(rule.id);
    setFeedback(null);

    try {
      const serverRes = await runAutomationOnServer(rule);
      if (!serverRes.success) {
        setFeedback({ type: 'error', message: serverRes.error || 'Automation run failed.' });
        return;
      }

      if (serverRes.draft) {
        await addDoc(collection(db, 'posts'), {
          ...serverRes.draft,
          userId: user.uid,
        });
      }

      const nowTime = new Date().toLocaleTimeString();
      const summaryText = serverRes.summary || 'Automation executed successfully.';

      await updateDoc(doc(db, 'automations', rule.id), {
        lastExecutionTime: `Today at ${nowTime}`,
        lastResult: summaryText,
        executionCount: (rule.executionCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      const logPayload: Omit<AutomationLog, 'id'> = {
        userId: user.uid,
        automationId: rule.id,
        automationName: rule.name,
        status: 'success',
        summary: summaryText,
        executionTime: new Date().toISOString(),
      };
      const logDoc = await addDoc(collection(db, 'automationLogs'), logPayload);

      setAutomations((prev) =>
        prev.map((a) =>
          a.id === rule.id
            ? {
                ...a,
                lastExecutionTime: `Today at ${nowTime}`,
                lastResult: summaryText,
                executionCount: (a.executionCount || 0) + 1,
              }
            : a
        )
      );
      setLogs((prev) => [{ id: logDoc.id, ...logPayload }, ...prev]);
      setFeedback({ type: 'success', message: summaryText });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Execution error.' });
    } finally {
      setExecutingId(null);
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setFormName('');
    setFormDesc('');
    setFormCategory('AI & Technology');
    setFormTrigger('schedule');
    setFormTime('09:00');
    setShowModal(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDesc(rule.description);
    setFormCategory(rule.category || 'AI & Technology');
    setFormTrigger((rule.triggerType as any) || 'schedule');
    setFormTime(rule.timeOfDay || '09:00');
    setShowModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formName.trim()) return;

    const frequencyLabel =
      formTrigger === 'schedule'
        ? `Daily at ${formTime}`
        : formTrigger === 'cron'
        ? 'Every 1 minute'
        : 'Event Driven';

    try {
      if (editingRule?.id) {
        await updateDoc(doc(db, 'automations', editingRule.id), {
          name: formName.trim(),
          description: formDesc.trim(),
          category: formCategory.trim(),
          triggerType: formTrigger,
          timeOfDay: formTrigger === 'schedule' ? formTime : '',
          frequency: frequencyLabel,
          updatedAt: new Date().toISOString(),
        });
        const updated = automations.map((a) =>
          a.id === editingRule.id
            ? {
                ...a,
                name: formName.trim(),
                description: formDesc.trim(),
                category: formCategory.trim(),
                triggerType: formTrigger,
                timeOfDay: formTrigger === 'schedule' ? formTime : '',
                frequency: frequencyLabel,
              }
            : a
        );
        setAutomations(updated);
        syncSchedulerWithServer({
          userId: user.uid,
          posts: [],
          automations: updated,
          autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
        }).catch(() => {});
      } else {
        const newRule: Omit<AutomationRule, 'id'> = {
          userId: user.uid,
          name: formName.trim(),
          description: formDesc.trim() || `Automated ${formCategory} content workflow`,
          triggerType: formTrigger,
          frequency: frequencyLabel,
          category: formCategory.trim(),
          timeOfDay: formTrigger === 'schedule' ? formTime : '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isEnabled: true,
          executionCount: 0,
          lastExecutionTime: 'Never',
          lastResult: 'Created and synced with server cron',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const docRef = await addDoc(collection(db, 'automations'), newRule);
        const updated = [{ id: docRef.id, ...newRule }, ...automations];
        setAutomations(updated);
        syncSchedulerWithServer({
          userId: user.uid,
          posts: [],
          automations: updated,
          autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
        }).catch(() => {});
      }
      setShowModal(false);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed saving rule.' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setConfirmDeleteId(null);
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'automations', ruleId));
      const updated = automations.filter((a) => a.id !== ruleId);
      setAutomations(updated);
      syncSchedulerWithServer({
        userId: user.uid,
        posts: [],
        automations: updated,
        autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
      }).catch(() => {});
      setFeedback({ type: 'success', message: 'Automation workflow deleted.' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `automations/${ruleId}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Instagram Automation Centre
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Create, edit, pause, or manually run persistent server-side background workflows.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-500">Server Cron Synced</span>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Automation</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading automations...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {automations.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all ${
                rule.isEnabled
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/40 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      rule.isEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {rule.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(rule)}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Edit Rule"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {rule.id &&
                    (confirmDeleteId === rule.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id!)}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(rule.id!)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => toggleAutomation(rule)}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-hidden ${
                      rule.isEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        rule.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                {rule.description}
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px] mb-4">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Trigger</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {rule.frequency}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                  <span className="text-slate-400 block text-[10px]">Executions</span>
                  <span className="font-semibold text-purple-400">
                    {rule.executionCount || 0} times run
                  </span>
                </div>
              </div>

              {rule.lastResult && (
                <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/15 text-[11px] text-slate-600 dark:text-slate-300 mb-4">
                  <span className="font-semibold text-purple-400 mr-1">Latest:</span>
                  {rule.lastResult}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <span className="text-[11px] text-slate-400">
                  Last: {rule.lastExecutionTime || 'Never'}
                </span>

                <button
                  type="button"
                  onClick={() => handleRunNow(rule)}
                  disabled={executingId === rule.id}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {executingId === rule.id ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-purple-500" />
              Recent Execution Logs
            </h3>
            <span className="text-xs text-slate-400">{logs.length} logged runs</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-white mr-2">
                      {log.automationName}
                    </span>
                    <span className="text-slate-400 truncate">{log.summary}</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(log.executionTime).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleSaveRule}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 text-xs"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingRule ? 'Edit Automation Rule' : 'Create Custom Automation'}
            </h3>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Rule Name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Daily AI Carousel Drafts"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Description</label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="What should this workflow generate or automate?"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Topic / Category</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Trigger Type</label>
                <select
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="schedule">Daily Schedule</option>
                  <option value="event">Event / Manual</option>
                  <option value="cron">Publishing Queue Check</option>
                </select>
              </div>
            </div>

            {formTrigger === 'schedule' && (
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Scheduled Execution Time (HH:MM)
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              >
                {editingRule ? 'Save Rule' : 'Create & Sync'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
