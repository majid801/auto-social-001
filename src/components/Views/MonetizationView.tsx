import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Briefcase,
  TrendingUp,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { BrandCampaign } from '../../types';

export const MonetizationView: React.FC = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // New campaign form state
  const [brandName, setBrandName] = useState<string>('');
  const [dealAmount, setDealAmount] = useState<string>('500');
  const [currency, setCurrency] = useState<string>('USD');
  const [status, setStatus] = useState<BrandCampaign['status']>('in_progress');
  const [paymentStatus, setPaymentStatus] = useState<BrandCampaign['paymentStatus']>('invoiced');
  const [deliverables, setDeliverables] = useState<string>('1x Instagram Reel + 2x Story Frames');
  const [notes, setNotes] = useState<string>('Deliverable due by next Friday.');

  useEffect(() => {
    if (!user) return;
    loadCampaigns();
  }, [user]);

  const loadCampaigns = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'brandCampaigns'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as BrandCampaign[]);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !brandName.trim()) return;

    try {
      const payload: Omit<BrandCampaign, 'id'> = {
        userId: user.uid,
        brandName,
        dealAmount: parseFloat(dealAmount) || 0,
        currency,
        status,
        paymentStatus,
        deliverables,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'brandCampaigns'), payload);
      setCampaigns((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setIsModalOpen(false);
      setBrandName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'brandCampaigns');
    }
  };

  const handleDelete = async (campaignId: string) => {
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, 'brandCampaigns', campaignId));
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `brandCampaigns/${campaignId}`);
    }
  };

  const totalRevenue = campaigns
    .filter((c) => c.paymentStatus === 'paid')
    .reduce((acc, c) => acc + (c.dealAmount || 0), 0);

  const pendingRevenue = campaigns
    .filter((c) => c.paymentStatus === 'invoiced' || c.paymentStatus === 'unpaid')
    .reduce((acc, c) => acc + (c.dealAmount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Brand Sponsorships & Monetization
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track creator collaboration deals, content deliverables, invoices, and payouts.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Brand Deal</span>
        </button>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">Realized Paid Revenue</span>
          <div className="text-2xl font-bold text-emerald-500">${totalRevenue.toLocaleString()}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Completed payments</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">Invoiced / Pending Payouts</span>
          <div className="text-2xl font-bold text-amber-500">${pendingRevenue.toLocaleString()}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Pending client invoice clearance</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 block mb-1">Active Brand Campaigns</span>
          <div className="text-2xl font-bold text-purple-400">
            {campaigns.filter((c) => c.status === 'in_progress').length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Content in production</span>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">
          Sponsorship Deals & Deliverables Tracker ({campaigns.length})
        </h3>

        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No brand collaborations recorded</p>
            <p className="text-xs mt-1">Click "Add Brand Deal" to log deliverables and payments.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {campaigns.map((c) => (
              <div key={c.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {c.brandName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      c.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {c.paymentStatus}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-400">Deliverables:</strong> {c.deliverables}
                  </p>
                  {c.notes && (
                    <p className="text-slate-400 text-[11px] line-clamp-1">
                      Notes: {c.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">
                      ${c.dealAmount?.toLocaleString()} {c.currency}
                    </div>
                    <span className="text-[10px] text-slate-400">Contract Value</span>
                  </div>

                  {c.id && confirmDeleteId !== c.id && (
                    <button
                      onClick={() => setConfirmDeleteId(c.id!)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete Deal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {c.id && confirmDeleteId === c.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(c.id!)}
                        className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">New Brand Collaboration</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Brand / Sponsor Name</label>
                <input
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Cursor AI, Notion, Gymshark..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Deal Value ($)</label>
                  <input
                    type="number"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="invoiced">Invoiced</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deliverables</label>
                <input
                  type="text"
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  Save Brand Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
