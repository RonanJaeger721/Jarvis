import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { ProjectTask } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Map, CheckSquare, Square, ChevronRight, Target, Zap, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { playSound } from '../lib/audio';

// Standard 6-Month Roadmap for Jaeger
const DEFAULT_ROADMAP = [
  { 
    month: 1, 
    title: 'May: First 3 clients ($450)', 
    tasks: [
      'Send 30 WhatsApp DMs/day — plumbers, salons, caterers',
      'Offer 1 free flyer to warm leads, close $10 paid',
      'Close 3 website clients at $150/mo retainer each',
      'Screenshot every piece of work — build proof folder',
      'Set up basic portfolio page (HTML, host free)'
    ] 
  },
  { 
    month: 2, 
    title: 'June: 10 clients + upsells ($1,500)', 
    tasks: [
      'Upsell month 1 clients to social media management (+$150/mo)',
      'Cold email 50 businesses/day — restaurants, real estate, retail',
      'Add logo remakes offer ($15) to warm up new leads',
      'Ask every paying client for 1 referral',
      'Raise new website price to $200 — anchor on results'
    ] 
  },
  { 
    month: 3, 
    title: 'July: First $5k month ($5,000)', 
    tasks: [
      'Bundle website + social + flyers into $250/mo package',
      'Post 1 case study/week on @Jaeger_.media — real client results',
      'Use Instantly.ai to scale cold email to 200/day',
      'Lock in 5 retainer clients with 3-month contracts',
      'Collect 3 written or video testimonials'
    ] 
  },
  { 
    month: 4, 
    title: 'August: Systems + scale ($8,000)', 
    tasks: [
      'Hire 1 freelance designer on Fiverr — offload flyer volume',
      'Offer paid ads management trials at $200/mo add-on',
      'Build a simple onboarding doc for new clients',
      'Target mid-size businesses — raise anchor price to $500/mo',
      'Track churn — every cancelled client needs a win-back call'
    ] 
  },
  { 
    month: 5, 
    title: 'September: Retainer machine ($12,000)', 
    tasks: [
      'Launch formal referral program — 1 free month per signed client',
      'Run your own $50/mo Facebook ads for Jaeger Media',
      'Introduce $500/mo all-in package — design + social + ads',
      'Build a lead list of 500 businesses for drip outreach',
      'Monthly client check-in calls — reduces churn to near zero'
    ] 
  },
  { 
    month: 6, 
    title: 'October: First $15k month ($15,000)', 
    tasks: [
      '50 active retainer clients at avg $300/mo = $15k MRR',
      'Hire 1 part-time assistant for outreach and admin',
      'Introduce AI lead generation as a $300/mo add-on service',
      'Lock in a 6-month retainer deal with your top 5 clients',
      'Reinvest 20% of revenue into ads, tools, and outsourcing'
    ] 
  },
];

export const PlanView: React.FC = () => {
  const { user } = useAuth();
  const [activeMonth, setActiveMonth] = useState(1); // Default to Month 1 (May)
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const effectiveUid = user?.uid || 'guest_sector_01';

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'project_tasks'), where('ownerId', '==', effectiveUid));
        const snap = await getDocs(q);
        let fetchedTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectTask));
        
        if (fetchedTasks.length === 0) {
          // Initialize defaults
          const newTasks: ProjectTask[] = [];
          for (const m of DEFAULT_ROADMAP) {
            for (const tTitle of m.tasks) {
              const t: Omit<ProjectTask, 'id'> = { title: tTitle, month: m.month, completed: false, ownerId: effectiveUid };
              const docRef = await addDoc(collection(db, 'project_tasks'), t);
              newTasks.push({ id: docRef.id, ...t });
            }
          }
          fetchedTasks = newTasks;
        }
        setTasks(fetchedTasks);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [effectiveUid]);

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      await updateDoc(doc(db, 'project_tasks', taskId), { completed: !task.completed });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !task.completed } : t));
      if (!task.completed) playSound('complete');
    } catch (err) {
      console.error(err);
    }
  };

  const resetRoadmap = async () => {
    if (!window.confirm("RESET PROTOCOL: THIS WILL ERASE ALL PROGRESS AND RE-INITIALIZE THE 6-MONTH ROADMAP TO A MAY START. PROCEED?")) return;
    
    setResetting(true);
    try {
      const q = query(collection(db, 'project_tasks'), where('ownerId', '==', effectiveUid));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      const newTasks: ProjectTask[] = [];
      for (const m of DEFAULT_ROADMAP) {
        for (const tTitle of m.tasks) {
          const t: Omit<ProjectTask, 'id'> = { title: tTitle, month: m.month, completed: false, ownerId: effectiveUid };
          const docRef = await addDoc(collection(db, 'project_tasks'), t);
          newTasks.push({ id: docRef.id, ...t });
        }
      }
      setTasks(newTasks);
      setActiveMonth(1);
      playSound('complete');
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  const monthData = DEFAULT_ROADMAP.find(m => m.month === activeMonth);
  const monthTasks = tasks.filter(t => t.month === activeMonth);
  const totalCompleted = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((totalCompleted / tasks.length) * 100) : 0;
  const monthProgress = monthTasks.length > 0 ? Math.round((monthTasks.filter(t => t.completed).length / monthTasks.length) * 100) : 0;

  if (loading) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#00F2FF]/10">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-[#00F2FF] hud-text-glow">STRATEGIC_PLAN.MAP</h1>
          <p className="text-[10px] text-[#A0D2EB]/40 uppercase tracking-[0.3em] mt-1">6-Month Roadmap to Market Dominance</p>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={resetRoadmap}
            disabled={resetting}
            className="px-4 py-2 border border-[#00F2FF]/20 text-[#00F2FF]/60 hover:text-[#00F2FF] hover:border-[#00F2FF]/40 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50"
          >
            {resetting ? 'RESETTING...' : 'RESET_ROADMAP'}
          </button>
          <div className="text-right">
             <p className="text-[9px] font-mono text-[#00F2FF]/40 uppercase tracking-widest">Global_Progression</p>
             <p className="text-2xl font-mono font-black text-[#00F2FF]">{progressPercent}%</p>
          </div>
          <div className="w-32 h-2 bg-black/60 border border-[#00F2FF]/20 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progressPercent}%` }}
               className="h-full bg-[#00F2FF] shadow-[0_0_10px_#00F2FF]"
             />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Months Sidebar */}
        <div className="space-y-3">
          {DEFAULT_ROADMAP.map((m) => {
            const mTasks = tasks.filter(t => t.month === m.month);
            const mDone = mTasks.every(t => t.completed);
            return (
              <button 
                key={m.month}
                onClick={() => setActiveMonth(m.month)}
                className={cn(
                  "w-full p-4 rounded-2xl flex items-center justify-between border transition-all relative overflow-hidden group",
                  activeMonth === m.month 
                    ? "bg-[#00F2FF]/10 border-[#00F2FF] text-[#00F2FF] hud-text-glow shadow-[0_0_15px_rgba(0,242,255,0.1)]" 
                    : "bg-black/20 border-white/5 text-zinc-500 hover:border-white/10"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs border shrink-0",
                    activeMonth === m.month ? "border-[#00F2FF]/40" : "border-white/5"
                  )}>
                    0{m.month}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-left">MONTH_{m.month}</span>
                </div>
                {mDone && <CheckSquare className="w-3 h-3 text-green-500" />}
              </button>
            );
          })}
        </div>

        {/* Level Details */}
        <div className="lg:col-span-3 space-y-8">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeMonth}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="hud-card border-[#00F2FF]/20 p-10 bg-black/40 backdrop-blur-xl relative overflow-hidden rounded-[3rem]"
            >
              <div className="hud-scanning" />
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[#00F2FF]">
                    <Zap className="w-5 h-5 fill-[#00F2FF]" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.4em]">MISSION_PROTOCOL: ALPHA_REDACTED</span>
                  </div>
                  <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{monthData?.title}</h2>
                </div>
                <div className="p-4 bg-[#00F2FF]/5 border border-[#00F2FF]/20 rounded-3xl text-center min-w-[100px]">
                   <p className="text-[8px] font-mono text-[#00F2FF]/60 uppercase tracking-widest mb-1">M_COMPLETION</p>
                   <p className="text-xl font-mono font-black text-[#00F2FF]">{monthProgress}%</p>
                </div>
              </div>

              <div className="space-y-4">
                {monthTasks.map((task) => (
                  <button 
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={cn(
                      "w-full p-6 border rounded-3xl flex items-center text-left gap-6 transition-all group relative overflow-hidden",
                      task.completed 
                        ? "bg-green-500/10 border-green-500/30 text-[#A0D2EB]/60 opacity-60" 
                        : "bg-white/5 border-white/5 hover:border-[#00F2FF]/30 text-white"
                    )}
                  >
                    {task.completed ? <CheckSquare className="w-5 h-5 text-green-500" /> : <Square className="w-5 h-5 text-[#00F2FF]/40 group-hover:text-[#00F2FF]" />}
                    <span className={cn(
                      "text-[11px] font-black uppercase tracking-widest leading-relaxed flex-1",
                      task.completed && "line-through opacity-50"
                    )}>
                      {task.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-[#00F2FF]/40 transition-colors" />
                  </button>
                ))}
              </div>

              <div className="mt-12 flex items-center gap-8 border-t border-white/5 pt-8">
                 <div className="flex items-center gap-3 text-zinc-600">
                    <Target className="w-4 h-4" />
                    <span className="text-[8px] font-mono uppercase tracking-[0.3em]">PRIORITY_OBJECTIVE: HIGH</span>
                 </div>
                 <div className="flex items-center gap-3 text-zinc-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-[8px] font-mono uppercase tracking-[0.3em]">ESTIMATED_WINDOW: 30_DAYS</span>
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
             <div className="p-8 hud-card bg-[#00F2FF]/5 border-white/5 rounded-[2.5rem]">
                <h4 className="text-[10px] font-black text-[#00F2FF] uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Map className="w-4 h-4" />
                   Strategic_Intent
                </h4>
                <p className="text-[9px] text-[#A0D2EB]/40 leading-relaxed uppercase tracking-wider">
                  Each phase is designed to scale tactical revenue while reducing manual execution load through system integration.
                </p>
             </div>
             <div className="p-8 hud-card bg-amber-400/5 border-white/5 rounded-[2.5rem]">
                <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Zap className="w-4 h-4" />
                   XP_Multipliers
                </h4>
                <p className="text-[9px] text-[#A0D2EB]/40 leading-relaxed uppercase tracking-wider">
                  Completing a full Phase unlocks a permanent 5% XP multiplier to base outreach transmissions.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
