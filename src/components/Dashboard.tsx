import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Users, Send, MessageCircle, CheckCircle, XCircle, Calendar, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'motion/react';
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

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    contacted: 0,
    replied: 0,
    interested: 0,
    followUps: 0,
    closed: 0,
    notInterested: 0
  });
  const [loading, setLoading] = useState(true);

  const [insights, setInsights] = useState<{ name: string; advice: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const generateInsights = async (contacts: any[]) => {
    setAnalyzing(true);
    // Simple logic: pick a few who replied but didn't close
    const targets = contacts
      .filter(c => c.status === 'Replied' || c.status === 'Follow Up')
      .slice(0, 3);
    
    if (targets.length === 0) {
      setInsights([{ name: "SYSTEM_READY", advice: "Scan more leads to generate follow-up vectors." }]);
      setAnalyzing(false);
      return;
    }

    const newInsights = targets.map(t => ({
      name: t.businessName,
      advice: t.status === 'Replied' ? "Re-engage to secure commitment. Pivot to discovery call." : "Check resonance of previous message. Adjust frequency."
    }));
    
    setInsights(newInsights);
    setAnalyzing(false);
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      const path = 'contacts';
      try {
        const q = query(collection(db, path), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => doc.data());
        
        setStats({
          total: data.length,
          contacted: data.filter(c => ['Contacted', 'Opened', 'Replied', 'Follow Up', 'Closed', 'Interested'].includes(c.status)).length,
          replied: data.filter(c => c.status === 'Replied').length,
          interested: data.filter(c => c.status === 'Interested').length,
          followUps: data.filter(c => c.status === 'Follow Up').length,
          closed: data.filter(c => c.status === 'Closed').length,
          notInterested: data.filter(c => c.status === 'Not Interested').length
        });

        generateInsights(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const cards = [
    { title: 'Total Contacts', value: stats.total, icon: Users, color: 'text-[#00F2FF]' },
    { title: 'Contacted', value: stats.contacted, icon: Send, color: 'text-[#00F2FF]' },
    { title: 'Replies', value: stats.replied, icon: MessageCircle, color: 'text-green-400' },
    { title: 'Interested', value: stats.interested, icon: Zap, color: 'text-[#00F2FF]' },
    { title: 'Follow Ups', value: stats.followUps, icon: Calendar, color: 'text-amber-400' },
    { title: 'Closed Deals', value: stats.closed, icon: CheckCircle, color: 'text-emerald-400' },
  ];

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-40 hud-card animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#00F2FF]/20 pb-8 relative">
        <div className="hud-scanning" />
        <div>
          <h1 className="text-4xl font-mono font-black tracking-tighter text-[#00F2FF] hud-text-glow mb-2">OPERATIONAL_DATA</h1>
          <p className="text-[#A0D2EB]/50 font-mono text-xs uppercase tracking-[0.2em]">Cross-Referencing Lead Database / Uplink Stable</p>
        </div>
        <div className="flex items-center gap-4 bg-[#00F2FF]/5 px-6 py-3 border border-[#00F2FF]/20 relative">
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#00F2FF]" />
          <TrendingUp className="w-5 h-5 text-[#00F2FF]" />
          <div>
            <p className="text-[10px] font-mono text-[#00F2FF]/60 uppercase tracking-widest">Efficiency_Index</p>
            <p className="text-xl font-mono font-bold text-[#00F2FF]">
              {stats.total > 0 ? ((stats.closed / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="hud-card p-10 group hover:border-[#00F2FF]/50 transition-all relative overflow-hidden group/card"
          >
            <div className="hud-glint" />
            <div className="flex justify-between items-start mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00F2FF] blur-2xl opacity-10 group-hover/card:opacity-30 transition-opacity" />
                <div className="w-12 h-12 border border-[#00F2FF]/20 flex items-center justify-center relative bg-black/40">
                  <card.icon className={cn("w-6 h-6 relative z-10", card.color)} />
                  <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#00F2FF]" />
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[9px] text-[#00F2FF]/40 block uppercase tracking-[0.3em] mb-1">METRIC_ASSET</span>
                <span className="text-5xl font-mono font-black text-[#00F2FF] hud-text-glow tracking-tighter">{card.value}</span>
              </div>
            </div>
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                 <h3 className="text-[#A0D2EB]/60 text-[10px] uppercase tracking-[0.4em] font-black border-l-2 border-[#00F2FF] pl-3">{card.title.replace(' ', '_')}</h3>
                 <span className="text-[8px] font-mono text-[#00F2FF]/30">STABLE_FEED</span>
               </div>
               <div className="h-1.5 w-full bg-black/60 border border-[#00F2FF]/10 overflow-hidden relative">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '100%' }}
                   transition={{ duration: 1.5, delay: i * 0.1, ease: "circOut" }}
                   className="h-full bg-gradient-to-r from-[#00F2FF]/10 to-[#00F2FF]/60 relative"
                 >
                   <div className="absolute top-0 right-0 w-2 h-full bg-white blur-[2px] opacity-50" />
                 </motion.div>
               </div>
               <div className="flex justify-between text-[8px] font-mono text-[#A0D2EB]/20">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="hud-card overflow-hidden">
          <div className="p-8 border-b border-[#00F2FF]/10 flex items-center justify-between bg-[#00F2FF]/5">
            <div>
              <h3 className="font-mono font-bold text-[#00F2FF] text-sm uppercase tracking-widest">Conversion_Funnel</h3>
              <p className="text-[10px] text-[#A0D2EB]/40 font-mono mt-1">REAL-TIME PROPAGATION ANALYSIS</p>
            </div>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full animate-ping" />
              <span className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full" />
            </div>
          </div>
          <div className="p-12">
            <div className="relative h-6 bg-black/40 border border-[#00F2FF]/10 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(0,242,255,0.05)_50%,transparent_100%)] animate-[marquee_2s_linear_infinite]" />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${stats.total > 0 ? (stats.contacted / stats.total) * 100 : 0}%` }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00F2FF]/20 to-[#00F2FF] shadow-[0_0_20px_rgba(0,242,255,0.6)]" 
              />
            </div>
            <div className="mt-8 grid grid-cols-3 text-[10px] font-mono text-[#00F2FF]/50 uppercase tracking-[0.2em] font-bold">
                <div className="text-left">
                  <p>UPLINK</p>
                  <p className="text-[#00F2FF] mt-1 font-black">{stats.total}</p>
                </div>
                <div className="text-center">
                  <p>TRANSMITTED</p>
                  <p className="text-[#00F2FF] mt-1 font-black">{stats.contacted}</p>
                </div>
                <div className="text-right">
                  <p>VERIFIED</p>
                  <p className="text-[#00F2FF] mt-1 font-black">{stats.closed}</p>
                </div>
            </div>
          </div>
        </div>

        <div className="hud-card">
          <div className="p-8 border-b border-[#00F2FF]/10 bg-[#00F2FF]/5">
            <h3 className="font-mono font-bold text-[#00F2FF] text-sm uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Intelligence_Suggestions
            </h3>
          </div>
          <div className="p-8 space-y-4">
            {analyzing ? (
              <div className="p-4 border border-[#00F2FF]/10 animate-pulse text-[10px] font-mono text-[#00F2FF]/50">
                RUNNING_FOLLOW_UP_HEURISTICS...
              </div>
            ) : (
              insights.map((insight, i) => (
                <div key={i} className="p-4 bg-black/40 border border-[#00F2FF]/10 relative overflow-hidden group">
                  <div className="absolute left-0 top-0 w-1 h-full bg-[#00F2FF]/30 group-hover:bg-[#00F2FF] transition-colors" />
                  <p className="text-[10px] font-mono font-black text-[#00F2FF] uppercase tracking-widest">{insight.name}</p>
                  <p className="text-[11px] text-[#A0D2EB]/60 mt-1 leading-relaxed">{insight.advice}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
