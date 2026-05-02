import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Goal } from '../types';
import { motion } from 'motion/react';
import { Target, CheckCircle2, Circle, TrendingUp, ShoppingBag, Globe, Megaphone } from 'lucide-react';
import { cn } from '../lib/utils';
import { playSound } from '../lib/audio';

export const GoalDashboard: React.FC = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const fetchGoals = async () => {
      const effectiveUid = user?.uid || 'guest_sector_01';
      setLoading(true);
      try {
        const q = query(
          collection(db, 'daily_goals'),
          where('ownerId', '==', effectiveUid),
          where('date', '==', today)
        );
        const snapshot = await getDocs(q);
        const fetchedGoals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
        
        if (fetchedGoals.length === 0) {
          // Initialize default goals
          const defaults: Omit<Goal, 'id'>[] = [
            { type: 'flyer', target: 5, completed: 0, date: today, ownerId: effectiveUid },
            { type: 'website', target: 2, completed: 0, date: today, ownerId: effectiveUid },
            { type: 'ads', target: 3, completed: 0, date: today, ownerId: effectiveUid },
            { type: 'leads', target: 20, completed: 0, date: today, ownerId: effectiveUid }
          ];
          
          const newGoals: Goal[] = [];
          for (const g of defaults) {
            const docRef = await addDoc(collection(db, 'daily_goals'), g);
            newGoals.push({ id: docRef.id, ...g });
          }
          setGoals(newGoals);
        } else {
          setGoals(fetchedGoals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [user, today]);

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

  const updateProgress = async (goalId: string, amount: number) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const nextVal = Math.max(0, goal.completed + amount);
    try {
      await updateDoc(doc(db, 'daily_goals', goalId), { completed: nextVal });
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, completed: nextVal } : g));
      if (amount > 0) {
        playSound('process');
        if (nextVal >= goal.target && goal.completed < goal.target) {
          jarvisSpeak(`Excellent work, sir. ${getName(goal.type)} objective neutralized.`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: Goal['type']) => {
    switch (type) {
      case 'flyer': return <ShoppingBag className="w-4 h-4" />;
      case 'website': return <Globe className="w-4 h-4" />;
      case 'ads': return <Megaphone className="w-4 h-4" />;
      case 'leads': return <Target className="w-4 h-4" />;
    }
  };

  const getName = (type: Goal['type']) => {
    switch (type) {
      case 'flyer': return 'FLYER_DESIGNS';
      case 'website': return 'WEBSITE_SALES';
      case 'ads': return 'AD_CAMPAIGNS';
      case 'leads': return 'NEW_LEAD_ACQUISITIONS';
    }
  };

  if (loading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {goals.map((goal) => {
        const progress = Math.min(1, goal.completed / goal.target);
        const isDone = goal.completed >= goal.target;
        
        return (
          <motion.div 
            key={goal.id}
            whileHover={{ scale: 1.02 }}
            className={cn(
              "p-5 bg-black/40 border hud-card transition-all relative overflow-hidden rounded-[2rem] backdrop-blur-md",
              isDone ? "border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : "border-[#00F2FF]/20"
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 border rounded-full backdrop-blur-xl shadow-inner",
                  isDone ? "border-green-500/20 text-green-500" : "border-[#00F2FF]/20 text-[#00F2FF]"
                )}>
                  {getIcon(goal.type)}
                </div>
                <h4 className="font-mono text-[9px] font-black uppercase tracking-widest text-[#A0D2EB]/60">{getName(goal.type)}</h4>
              </div>
              {isDone && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </div>

            <div className="flex items-end justify-between mb-3">
              <span className="text-2xl font-mono font-black text-white">{goal.completed} <span className="text-xs text-[#A0D2EB]/30 font-normal">/ {goal.target}</span></span>
              <div className="flex gap-2">
                <button 
                  onClick={() => updateProgress(goal.id, -1)}
                  className="w-8 h-8 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-[#A0D2EB]/40 rounded-full bg-black/20"
                >
                  -
                </button>
                <button 
                  onClick={() => updateProgress(goal.id, 1)}
                  className="w-8 h-8 border border-[#00F2FF]/30 flex items-center justify-center hover:bg-[#00F2FF]/10 transition-all text-[#00F2FF] rounded-full bg-black/20 shadow-[0_0_10px_rgba(0,242,255,0.1)]"
                >
                  +
                </button>
              </div>
            </div>

            <div className="h-1.5 bg-white/5 w-full overflow-hidden relative rounded-full">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  isDone ? "bg-green-500 shadow-[0_0_10px_green]" : "bg-[#00F2FF] shadow-[0_0_10px_#00F2FF]"
                )}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
