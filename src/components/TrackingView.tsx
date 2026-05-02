import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { BusinessLog, PersonalHabit } from '../types';
import { motion } from 'motion/react';
import { BarChart3, Book, Dumbbell, Church, Save, Plus, TrendingUp, Zap, MessageSquare, Phone, Users, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import { playSound } from '../lib/audio';

export const TrackingView: React.FC = () => {
  const { user } = useAuth();
  const [log, setLog] = useState<Partial<BusinessLog>>({
    whatsappCount: 0,
    emailCount: 0,
    replies: 0,
    followUps: 0,
    calls: 0,
    clients: 0,
    revenue: 0
  });
  const [habits, setHabits] = useState<Record<string, Partial<PersonalHabit>>>({
    reading: { completed: false, notes: '' },
    workout: { completed: false, notes: '' },
    bible: { completed: false, notes: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const effectiveUid = user?.uid || 'guest_sector_01';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Business Log
        const logQ = query(
          collection(db, 'business_logs'),
          where('ownerId', '==', effectiveUid),
          where('date', '==', today)
        );
        const logSnap = await getDocs(logQ);
        if (!logSnap.empty) {
          setLog(logSnap.docs[0].data() as BusinessLog);
        }

        // Fetch Habits
        const habitQ = query(
          collection(db, 'personal_habits'),
          where('ownerId', '==', effectiveUid),
          where('date', '==', today)
        );
        const habitSnap = await getDocs(habitQ);
        const loadedHabits = { ...habits };
        habitSnap.docs.forEach(d => {
          const h = d.data() as PersonalHabit;
          loadedHabits[h.type] = h;
        });
        setHabits(loadedHabits);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [effectiveUid, today]);

  const calculateXP = () => {
    const bizXP = 
      (log.whatsappCount || 0) * 5 +
      (log.emailCount || 0) * 5 +
      (log.replies || 0) * 50 +
      (log.followUps || 0) * 30 +
      (log.calls || 0) * 100 +
      (log.clients || 0) * 1000 +
      (log.revenue || 0) * 10;
    
    const habitXP = (Object.values(habits) as Partial<PersonalHabit>[]).filter(h => h.completed).length * 200;
    
    return bizXP + habitXP;
  };

  const saveAll = async () => {
    setSaving(true);
    const xp = calculateXP();
    
    try {
      // Save Log
      const logPath = 'business_logs';
      const logQ = query(collection(db, logPath), where('ownerId', '==', effectiveUid), where('date', '==', today));
      const logSnap = await getDocs(logQ);
      const logData = { ...log, xpEarned: xp, date: today, ownerId: effectiveUid };
      
      if (logSnap.empty) {
        await addDoc(collection(db, logPath), logData);
      } else {
        await updateDoc(doc(db, logPath, logSnap.docs[0].id), logData);
      }

      // Save Habits
      const habitPath = 'personal_habits';
      for (const [type, data] of Object.entries(habits)) {
        const hQ = query(collection(db, habitPath), where('ownerId', '==', effectiveUid), where('date', '==', today), where('type', '==', type));
        const hSnap = await getDocs(hQ);
        const habitData = data as Partial<PersonalHabit>;
        const hData = { 
          ...habitData, 
          type, 
          xpEarned: habitData.completed ? 200 : 0, 
          date: today, 
          ownerId: effectiveUid 
        };
        
        if (hSnap.empty) {
          await addDoc(collection(db, habitPath), hData);
        } else {
          await updateDoc(doc(db, habitPath, hSnap.docs[0].id), hData);
        }
      }

      playSound('complete');
      alert('Strategic data synchronized, sir.');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-[#00F2FF] hud-text-glow">BATTLE_LOGS.EXE</h1>
          <p className="text-[10px] text-[#A0D2EB]/40 uppercase tracking-[0.3em] mt-1">Recording Tactical Milestones</p>
        </div>
        <button 
          onClick={saveAll}
          disabled={saving}
          className="bg-[#00F2FF] text-black px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:bg-[#00F2FF]/80 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]"
        >
          {saving ? 'SYNCING...' : 'SYNCHRONIZE_PROTOCOLS'}
          <Save className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Business Logs */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-l-4 border-[#00F2FF] pl-4">
            <BarChart3 className="w-5 h-5 text-[#00F2FF]" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Business_Metrics</h2>
          </div>

          <div className="hud-card border-[#00F2FF]/20 p-8 grid grid-cols-2 gap-8 relative overflow-hidden bg-black/40 backdrop-blur-xl">
            <div className="hud-scanning" />
            
            {[
              { label: 'WA_TRANSMISSIONS', key: 'whatsappCount', icon: MessageSquare },
              { label: 'EMAIL_UPLINKS', key: 'emailCount', icon: TrendingUp },
              { label: 'ACTIVE_REPLIES', key: 'replies', icon: Zap },
              { label: 'FOLLOW_UP_VECTORS', key: 'followUps', icon: Plus },
              { label: 'TACTICAL_CALLS', key: 'calls', icon: Phone },
              { label: 'CLIENTS_SECURED', key: 'clients', icon: Users },
            ].map((field) => (
              <div key={field.key} className="space-y-3">
                <label className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">
                  <field.icon className="w-3 h-3" />
                  {field.label}
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    value={log[field.key as keyof BusinessLog] as number}
                    onChange={(e) => setLog(prev => ({ ...prev, [field.key]: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-black/60 border border-[#00F2FF]/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00F2FF] transition-all font-mono text-xs"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#00F2FF]/20">UNIT</div>
                </div>
              </div>
            ))}

            <div className="col-span-2 space-y-3 pt-4 border-t border-white/5">
              <label className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">
                <DollarSign className="w-3 h-3" />
                REVENUE_STREAM (USD)
              </label>
              <div className="relative">
                <input 
                  type="number"
                  value={log.revenue}
                  onChange={(e) => setLog(prev => ({ ...prev, revenue: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#00F2FF]/5 border border-[#00F2FF]/30 rounded-xl px-6 py-5 text-xl font-mono text-[#00F2FF] hud-text-glow focus:outline-none focus:border-[#00F2FF] transition-all"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-mono text-[#00F2FF]/40">$CURRENCY</div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Habits */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-l-4 border-amber-400 pl-4">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Biological_Optimization</h2>
          </div>

          <div className="space-y-6">
            {[
              { type: 'reading', label: 'Knowledge_Absorption', icon: Book, color: 'text-blue-400' },
              { type: 'workout', label: 'Physical_Conditioning', icon: Dumbbell, color: 'text-red-400' },
              { type: 'bible', label: 'Spiritual_Alignment', icon: Church, color: 'text-amber-400' },
            ].map((habit) => (
              <div key={habit.type} className="hud-card border-white/5 p-6 bg-black/20 hover:bg-black/40 transition-all rounded-[2rem]">
                <div className="flex items-start gap-4">
                  <button 
                    onClick={() => setHabits(prev => ({ 
                      ...prev, 
                      [habit.type]: { ...prev[habit.type], completed: !prev[habit.type].completed } 
                    }))}
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shrink-0 hover:scale-105 active:scale-95 shadow-inner",
                      habits[habit.type].completed 
                        ? "bg-green-500/20 border-green-500/50 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]" 
                        : "bg-white/5 border-white/10 text-zinc-600"
                    )}
                  >
                    <habit.icon className="w-5 h-5" />
                  </button>
                  <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0D2EB]/80">{habit.label}</h4>
                      <span className={cn("text-[8px] font-mono", habits[habit.type].completed ? "text-green-400" : "text-zinc-600")}>
                        {habits[habit.type].completed ? '+200 XP' : '0 XP'}
                      </span>
                    </div>
                    <textarea 
                      placeholder="ENTER_INTEL_NOTES..."
                      value={habits[habit.type].notes || ''}
                      onChange={(e) => setHabits(prev => ({ 
                        ...prev, 
                        [habit.type]: { ...prev[habit.type], notes: e.target.value } 
                      }))}
                      rows={1}
                      className="w-full bg-black/60 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-amber-400 transition-all resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* XP Preview */}
          <div className="hud-card border-[#00F2FF]/10 p-8 bg-gradient-to-br from-[#00F2FF]/5 to-transparent rounded-[2.5rem]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-mono text-[#00F2FF]/40 uppercase tracking-[0.4em]">Projected_XP_Gain</p>
                <p className="text-4xl font-mono font-black text-[#00F2FF] hud-text-glow mt-1">+{calculateXP()}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em] mb-2">STATUS: AWAITING_SYNC</p>
                <div className="h-2 w-32 bg-black/60 border border-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    className="h-full bg-[#00F2FF]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
