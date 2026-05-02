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
  });
  
  interface LeaderboardEntry {
    uid: string;
    name: string;
    xp: number;
    lvl: number;
    revenue: number;
    leads: number;
  }

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<{ name: string; advice: string }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const calculateLevel = (xp: number) => {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  };

  const getXPToNextLevel = (lvl: number) => {
    return Math.pow(lvl, 2) * 100;
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      const effectiveUid = user?.uid || 'guest_sector_01';
      
      try {
        // 1. Fetch current user tactical stats
        const contactsSnap = await getDocs(query(collection(db, 'contacts'), where('ownerId', '==', effectiveUid)));
        const contactsData = contactsSnap.docs.map(d => d.data());
        
        setStats({
          total: contactsData.length,
          contacted: contactsData.filter(c => ['Contacted', 'Opened', 'Replied', 'Follow Up', 'Closed', 'Interested'].includes(c.status)).length,
          replied: contactsData.filter(c => c.status === 'Replied').length,
          interested: contactsData.filter(c => c.status === 'Interested').length,
          followUps: contactsData.filter(c => c.status === 'Follow Up').length,
          closed: contactsData.filter(c => c.status === 'Closed').length,
        });

        // 2. Build Leaderboard (Ronan & Mikey)
        const entriesMap: Record<string, LeaderboardEntry> = {
          'ronan_sector': { uid: 'ronan_sector', name: 'Ronan', xp: 0, lvl: 1, revenue: 0, leads: 0 },
          'mikey_sector': { uid: 'mikey_sector', name: 'Mikey', xp: 0, lvl: 1, revenue: 0, leads: 0 }
        };

        const sectors = ['ronan_sector', 'mikey_sector'];

        // Fetch logs for XP and Revenue
        const logsSnap = await getDocs(query(collection(db, 'business_logs'), where('ownerId', 'in', sectors)));
        logsSnap.docs.forEach(doc => {
          const d = doc.data();
          if (entriesMap[d.ownerId]) {
            entriesMap[d.ownerId].xp += d.xpEarned || 0;
            entriesMap[d.ownerId].revenue += d.revenue || 0;
          }
        });

        // Fetch contacts for Leads count
        const allContactsSnap = await getDocs(query(collection(db, 'contacts'), where('ownerId', 'in', sectors)));
        allContactsSnap.docs.forEach(doc => {
          const d = doc.data();
          if (entriesMap[d.ownerId]) {
            entriesMap[d.ownerId].leads += 1;
          }
        });

        // Fetch habits for XP
        const habitsSnap = await getDocs(query(collection(db, 'personal_habits'), where('ownerId', 'in', sectors)));
        habitsSnap.docs.forEach(doc => {
          const d = doc.data();
          if (entriesMap[d.ownerId]) {
            entriesMap[d.ownerId].xp += d.xpEarned || 0;
          }
        });

        const board = Object.values(entriesMap).map(e => ({
          ...e,
          lvl: calculateLevel(e.xp)
        })).sort((a, b) => b.xp - a.xp);

        setLeaderboard(board);
        
        // Insights logic
        const targets = contactsData.filter(c => c.status === 'Replied' || c.status === 'Follow Up').slice(0, 3);
        if (targets.length === 0) {
          setInsights([{ name: "SYSTEM_READY", advice: "Scan more leads to generate follow-up vectors." }]);
        } else {
          setInsights(targets.map(t => ({
            name: t.businessName,
            advice: t.status === 'Replied' ? "Re-engage to secure commitment. Pivot to discovery call." : "Check resonance of previous message. Adjust frequency."
          })));
        }

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  const currentUserData = leaderboard.find(e => e.uid === user?.uid) || { xp: 0, lvl: 1, name: 'Guest' };
  const currentXP = currentUserData.xp;
  const currentLvl = currentUserData.lvl;
  const lvlStart = getXPToNextLevel(currentLvl - 1);
  const lvlEnd = getXPToNextLevel(currentLvl);
  const xpProgress = ((currentXP - lvlStart) / (lvlEnd - lvlStart)) * 100;

  const cards = [
    { title: 'Total Contacts', value: stats.total, icon: Users, color: 'text-[#00F2FF]' },
    { title: 'Contacted', value: stats.contacted, icon: Send, color: 'text-[#00F2FF]' },
    { title: 'Replies', value: stats.replied, icon: MessageCircle, color: 'text-green-400' },
    { title: 'Interested', value: stats.interested, icon: Zap, color: 'text-[#00F2FF]' },
    { title: 'Follow Ups', value: stats.followUps, icon: Calendar, color: 'text-amber-400' },
    { title: 'Closed Deals', value: stats.closed, icon: CheckCircle, color: 'text-emerald-400' },
  ];

  if (loading) return (
    <div className="space-y-12">
      <div className="h-20 hud-card animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 hud-card animate-pulse" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Header with XP Bar */}
      <div className="flex flex-col gap-8 border-b border-[#00F2FF]/20 pb-10 relative">
        <div className="hud-scanning" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-mono font-black tracking-tighter text-[#00F2FF] hud-text-glow mb-2 italic">OPERATIONAL_DATA</h1>
            <p className="text-[#A0D2EB]/50 font-mono text-xs uppercase tracking-[0.2em]">Sector: {currentUserData.name} / Experience: {currentXP} XP</p>
          </div>
          
          <div className="w-full md:w-96 space-y-3 bg-[#00F2FF]/5 p-6 rounded-[2rem] border border-[#00F2FF]/10 backdrop-blur-xl">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-mono text-[#00F2FF] font-black uppercase tracking-widest">LEVEL_{currentLvl}</span>
              <span className="text-[9px] font-mono text-[#A0D2EB]/40 uppercase tracking-widest">{currentXP} / {lvlEnd} XP</span>
            </div>
            <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                className="h-full bg-gradient-to-r from-[#00F2FF]/40 to-[#00F2FF] shadow-[0_0_10px_#00F2FF]"
              />
            </div>
            <p className="text-[8px] font-mono text-center text-[#A0D2EB]/20 uppercase tracking-tighter">Synchronizing Neural Growth Pattern</p>
          </div>
        </div>
      </div>

      {stats.total === 0 ? (
        <div className="py-20 text-center space-y-6 hud-card border-dashed border-white/10 opacity-60">
           <Zap className="w-12 h-12 text-[#A0D2EB]/20 mx-auto" />
           <p className="text-[10px] uppercase font-mono tracking-[0.5em] text-[#A0D2EB]/40">No strategic data detected in this sector.</p>
           <button onClick={() => window.location.hash = '#import'} className="text-[9px] font-black text-[#00F2FF] uppercase border-b border-[#00F2FF]/30 pb-1">Initiate Initial Acquisition</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="hud-card p-10 group hover:border-[#00F2FF]/50 transition-all relative overflow-hidden group/card bg-black/40 backdrop-blur-md rounded-[3rem]"
            >
              <div className="hud-glint" />
              <div className="flex justify-between items-start mb-8">
                <div className="w-14 h-14 border border-[#00F2FF]/20 flex items-center justify-center relative bg-black/40 rounded-full shadow-inner">
                  <card.icon className={cn("w-6 h-6 relative z-10", card.color)} />
                  <div className="absolute top-0 left-0 w-2 h-2 bg-[#00F2FF] rounded-full blur-[1px]" />
                </div>
                <div className="text-right font-mono">
                  <span className="text-[9px] text-[#00F2FF]/40 block uppercase tracking-[0.3em] mb-1">UNIT_COUNT</span>
                  <span className="text-5xl font-mono font-black text-white tracking-tighter">{card.value}</span>
                </div>
              </div>
              <div className="space-y-4">
                 <h3 className="text-[#A0D2EB] text-[10px] uppercase tracking-[0.4em] font-black border-l-2 border-[#00F2FF] pl-3">{card.title.replace(' ', '_')}</h3>
                 <div className="h-1 w-full bg-white/5 overflow-hidden rounded-full">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: stats.total > 0 ? `${(card.value / stats.total) * 100}%` : '0%' }}
                     className={cn("h-full", card.color.replace('text-', 'bg-'))}
                   />
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Leaderboard Section */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-l-4 border-amber-400 pl-4">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white">Operational_Leaderboard</h2>
          </div>
          
          <div className="space-y-4">
            {leaderboard.map((entry, i) => (
              <motion.div 
                key={entry.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "hud-card p-6 flex items-center justify-between group transition-all rounded-[2rem] border-white/5",
                  entry.uid === user?.uid ? "bg-[#00F2FF]/5 border-[#00F2FF]/30 shadow-[0_0_20px_rgba(0,242,255,0.1)]" : "bg-black/20"
                )}
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 flex items-center justify-center font-mono font-black text-xl text-[#00F2FF] bg-black/40 border border-[#00F2FF]/20 rounded-2xl">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-white">{entry.name}</h4>
                    <p className="text-[9px] font-mono text-[#A0D2EB]/40 uppercase tracking-widest mt-1">
                      LEVEL_{entry.lvl} / {entry.leads} LEADS
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-xl font-mono font-black text-[#00F2FF] hud-text-glow">{entry.xp} XP</p>
                   <p className="text-[9px] font-mono text-green-400 uppercase tracking-widest mt-1">${entry.revenue} REV</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Funnel & Insights */}
        <div className="space-y-12">
          <div className="hud-card border-[#00F2FF]/20 overflow-hidden rounded-[3rem] bg-black/40 backdrop-blur-xl">
            <div className="p-8 border-b border-[#00F2FF]/10 flex items-center justify-between bg-[#00F2FF]/5">
              <h3 className="font-mono font-bold text-[#00F2FF] text-xs uppercase tracking-[0.3em]">Conversion_Propagation</h3>
              <Zap className="w-4 h-4 text-[#00F2FF] animate-pulse" />
            </div>
            <div className="p-10 space-y-8">
              <div className="relative h-12 bg-black/60 border border-[#00F2FF]/10 overflow-hidden rounded-2xl p-1.5 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.total > 0 ? (stats.contacted / stats.total) * 100 : 0}%` }}
                  className="absolute top-1.5 left-1.5 bottom-1.5 bg-gradient-to-r from-[#00F2FF]/20 to-[#00F2FF] shadow-[0_0_20px_#00F2FF] rounded-xl" 
                />
              </div>
              <div className="grid grid-cols-3 text-[9px] font-mono text-center uppercase tracking-widest font-black">
                  <div className="space-y-1">
                    <p className="text-[#A0D2EB]/30">IDENTIFIED</p>
                    <p className="text-[#00F2FF] text-lg">{stats.total}</p>
                  </div>
                  <div className="space-y-1 border-x border-white/5">
                    <p className="text-[#A0D2EB]/30">CONTACTED</p>
                    <p className="text-[#00F2FF] text-lg">{stats.contacted}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#A0D2EB]/30">CLOSED</p>
                    <p className="text-[#00F2FF] text-lg">{stats.closed}</p>
                  </div>
              </div>
            </div>
          </div>

          <div className="hud-card border-white/5 rounded-[3rem]">
            <div className="p-8 border-b border-white/5 bg-white/5 rounded-t-[3rem]">
              <h3 className="font-mono font-bold text-[#A0D2EB] text-xs uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Next_Tactical_Steps
              </h3>
            </div>
            <div className="p-8 space-y-4">
              {insights.map((insight, i) => (
                <div key={i} className="p-5 bg-black/40 border border-[#00F2FF]/5 relative overflow-hidden group rounded-2xl backdrop-blur-md">
                   <div className="absolute left-0 inset-y-0 w-1 bg-[#00F2FF]/20 group-hover:bg-[#00F2FF] transition-all" />
                   <p className="text-[10px] font-mono font-black text-[#00F2FF] uppercase tracking-widest mb-1">{insight.name}</p>
                   <p className="text-[11px] text-[#A0D2EB]/50 font-medium leading-relaxed">{insight.advice}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
