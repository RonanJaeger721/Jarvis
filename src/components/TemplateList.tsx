import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Template, OfferType } from '../types';
import { Plus, Trash2, Edit3, Save, X, MessageSquare, Info, RotateCcw, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JAEGER_DEFAULTS } from '../services/messagingService';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const TemplateList: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  const jarvisSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice = voices.find(v => 
      v.name.includes('Daniel') || 
      v.name.includes('Google UK English Male') || 
      (v.lang === 'en-GB' && v.name.includes('Male'))
    );
    if (jarvisVoice) utterance.voice = jarvisVoice;
    utterance.rate = 1.35;
    utterance.pitch = 0.88;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  
  // State for bulk entry per tier
  const [bulkInput, setBulkInput] = useState<Record<OfferType, string>>({
    'Website': '',
    'Flyer': '',
    'Facebook Ads': '',
    'Other': ''
  });
  const [isBulkMode, setIsBulkMode] = useState<Record<OfferType, boolean>>({
    'Website': false,
    'Flyer': false,
    'Facebook Ads': false,
    'Other': false
  });

  const fetchTemplates = async () => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    setLoading(true);
    const path = 'templates';
    try {
      const q = query(collection(db, path), where('ownerId', '==', effectiveUid));
      const snapshot = await getDocs(q);
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const handleBulkSubmit = async (tier: OfferType) => {
    const content = bulkInput[tier].trim();
    const effectiveUid = user?.uid || 'guest_sector_01';
    
    // We split by double newlines but also allow single newlines if they are within a message
    // Actually double newline is the safest separator for "Bulk" feel
    const variations = content.split(/\n\n+/).filter(v => v.trim());
    
    const batch = writeBatch(db);

    try {
      // 1. Clear existing templates for this tier to perform a full "Strategy Sync"
      const tierTemplates = templates.filter(t => t.offerType === tier);
      tierTemplates.forEach(t => {
        batch.delete(doc(db, 'templates', t.id));
      });

      // 2. Add new ones
      variations.forEach((v, index) => {
        const docRef = doc(collection(db, 'templates'));
        batch.set(docRef, {
          name: `${tier}_VECTOR_${index + 1}`,
          content: v.trim(),
          offerType: tier,
          ownerId: effectiveUid,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setBulkInput(prev => ({ ...prev, [tier]: '' }));
      setIsBulkMode(prev => ({ ...prev, [tier]: false }));
      fetchTemplates();
      jarvisSpeak(`${tier} strategic protocols synchronized, sir.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bulk_${tier}`);
    }
  };

  const handleOpenBulkEdit = (tier: OfferType) => {
    const tierContent = templates
      .filter(t => t.offerType === tier)
      .map(t => t.content)
      .join('\n\n');
    
    setBulkInput(prev => ({ ...prev, [tier]: tierContent }));
    setIsBulkMode(prev => ({ ...prev, [tier]: true }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Discard communication module?')) return;
    const path = `templates/${id}`;
    try {
      await deleteDoc(doc(db, 'templates', id));
      fetchTemplates();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Uplink Jaeger standard protocols? This will augment your current strategic cache.')) return;
    setIsResetting(true);
    const effectiveUid = user?.uid || 'guest_sector_01';
    const batch = writeBatch(db);

    try {
      JAEGER_DEFAULTS.forEach(t => {
        const docRef = doc(collection(db, 'templates'));
        batch.set(docRef, {
          ...t,
          ownerId: effectiveUid,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
      fetchTemplates();
      jarvisSpeak("Base protocols restored. Strategic depth increased.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'templates_batch');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <div className="text-[#00F2FF] font-mono p-12 flex items-center gap-4"><Loader2 className="w-6 h-6 animate-spin" /> SYNCHRONIZING_COMM_CHUNKS...</div>;

  return (
    <div className="space-y-16 max-w-6xl mx-auto p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-black/40 p-8 rounded-[3rem] border border-[#00F2FF]/10 backdrop-blur-xl">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-[#00F2FF] hud-text-glow uppercase">Blueprint_Registry</h1>
          <p className="text-[10px] text-[#A0D2EB]/40 uppercase tracking-[0.4em] mt-2 font-mono flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Strategic Uplink Active / Multi-Tier Rotation Enabled
          </p>
        </div>
        <button 
          onClick={handleResetDefaults}
          disabled={isResetting}
          className="group flex items-center gap-3 px-8 py-3 bg-[#00F2FF]/5 border border-[#00F2FF]/20 rounded-full text-[10px] font-mono font-black text-[#00F2FF] uppercase tracking-[0.2em] hover:bg-[#00F2FF]/20 transition-all disabled:opacity-30 shadow-[0_0_20px_rgba(0,242,255,0.05)]"
        >
          {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />}
          UPLINK_DEFAULTS
        </button>
      </div>

      {(['Website', 'Flyer', 'Facebook Ads'] as OfferType[]).map((tier) => {
        const tierTemplates = templates.filter(t => t.offerType === tier);
        
        return (
          <section key={tier} className="space-y-8">
            <div className="flex items-center justify-between border-l-4 border-[#00F2FF] pl-6">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-[#00F2FF]/10 border border-[#00F2FF]/30 rounded-3xl flex items-center justify-center transform rotate-12 group-hover:rotate-0 transition-transform">
                  <MessageSquare className="text-[#00F2FF] w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-[0.2em] text-white uppercase">{tier}</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[9px] font-mono text-[#00F2FF] uppercase tracking-widest bg-[#00F2FF]/10 px-3 py-1 rounded-full border border-[#00F2FF]/20">
                      {tierTemplates.length} MODULES_ONLINE
                    </span>
                    <span className="text-[9px] font-mono text-[#A0D2EB]/30 uppercase tracking-[0.4em]">STATION_BUFFER_0{tier[0]}</span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => isBulkMode[tier] ? setIsBulkMode(prev => ({ ...prev, [tier]: false })) : handleOpenBulkEdit(tier)}
                className={cn(
                  "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  isBulkMode[tier] ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-[#00F2FF]/10 text-[#00F2FF] border border-[#00F2FF]/30 hover:bg-[#00F2FF]/20"
                )}
              >
                {isBulkMode[tier] ? 'ABORT_SYNC' : 'MANAGE_STRATEGY'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isBulkMode[tier] ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="hud-card border-[#00F2FF]/40 p-10 bg-black/80 relative overflow-hidden rounded-[3rem] shadow-[0_0_50px_rgba(0,242,255,0.1)]"
                >
                  <div className="hud-scanning opacity-30 pointer-events-none" />
                  <div className="flex items-start gap-4 mb-8">
                    <div className="p-3 bg-[#00F2FF]/10 rounded-full border border-[#00F2FF]/30">
                      <Info className="w-6 h-6 text-[#00F2FF]" />
                    </div>
                    <div>
                      <h4 className="text-[#00F2FF] font-black text-xs uppercase tracking-widest mb-1">Bulk Vector Synchronization</h4>
                      <p className="text-[10px] text-[#A0D2EB]/40 font-mono uppercase tracking-widest leading-relaxed">
                        Input strategy variations. Separate each module with a <span className="text-[#00F2FF] font-black">Double Newline</span>.<br />
                        Auto-processing will distribute these chunks into the active outreach cycle.
                      </p>
                    </div>
                  </div>
                  <textarea 
                    value={bulkInput[tier]}
                    onChange={(e) => setBulkInput(prev => ({ ...prev, [tier]: e.target.value }))}
                    placeholder="Enter message variations here..."
                    className="w-full bg-black/40 border-2 border-[#00F2FF]/10 rounded-[3rem] px-10 py-10 text-sm font-mono text-[#A0D2EB] focus:border-[#00F2FF] outline-none min-h-[400px] mb-8 backdrop-blur-3xl shadow-inner scrollbar-hide leading-relaxed"
                  />
                  <div className="flex justify-end gap-6">
                    <button 
                      onClick={() => handleBulkSubmit(tier)}
                      className="px-12 py-4 bg-[#00F2FF] text-black font-black uppercase tracking-[0.3em] text-xs rounded-full shadow-[0_0_30px_rgba(0,242,255,0.5)] hover:scale-105 transition-all active:scale-95"
                    >
                      SYNCHRONIZE_TIER_STRATEGY
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {tierTemplates.length > 0 ? tierTemplates.map((t) => (
                    <div 
                      key={t.id} 
                      className="hud-card border-white/5 bg-black/40 p-8 flex flex-col justify-between group hover:border-[#00F2FF]/30 transition-all rounded-[2.5rem] hover:shadow-[0_0_40px_rgba(0,242,255,0.08)] backdrop-blur-md relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all border border-transparent hover:border-red-500/20"
                         >
                           <Trash2 className="w-5 h-5" />
                         </button>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full animate-pulse" />
                           <span className="text-[10px] font-mono text-[#00F2FF]/40 uppercase tracking-[0.3em] font-black">VARIATION_PROTOCOL</span>
                        </div>
                        <div className="bg-black/60 border border-white/5 p-8 rounded-[2rem] min-h-[160px] text-[13px] font-mono text-[#A0D2EB]/80 leading-relaxed italic relative">
                           <div className="absolute -top-4 -left-2 text-[#00F2FF]/10 text-[80px] font-serif leading-none select-none">"</div>
                           {t.content}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="md:col-span-2 py-20 text-center border-4 border-dashed border-[#00F2FF]/5 rounded-[3rem] bg-black/20">
                      <Zap className="w-16 h-16 text-[#00F2FF]/10 mx-auto mb-6" />
                      <p className="text-xs font-mono text-[#A0D2EB]/20 uppercase tracking-[0.5em] font-black">Strategy Buffer Empty / Ready for Upload</p>
                      <button 
                        onClick={() => handleOpenBulkEdit(tier)}
                        className="mt-8 text-[#00F2FF] text-[10px] font-black uppercase tracking-widest border border-[#00F2FF]/20 px-8 py-3 rounded-full hover:bg-[#00F2FF]/10 transition-all"
                      >
                        INITIALIZE_BUFFER
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
};

