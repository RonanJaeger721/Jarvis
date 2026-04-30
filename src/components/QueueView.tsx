import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Contact, ContactStatus } from '../types';
import { Send, Zap, RotateCcw, AlertTriangle, CheckCircle2, Timer, Pause, Play, Edit3, XCircle, ChevronLeft, ChevronRight, MessageSquare, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { personalizeMessage, generateJaegerMessages, OutreachService } from '../services/geminiService';
import { cn } from '../lib/utils';
import { JarvisTerminal } from './JarvisTerminal';
import { GoalDashboard } from './GoalDashboard';
import { playSound } from '../lib/audio';

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

export const QueueView: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pacing, setPacing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalWaitTime, setTotalWaitTime] = useState(0);
  const [pacingInterval, setPacingInterval] = useState(60); // Default 60s
  const [autoPilot, setAutoPilot] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedService, setSelectedService] = useState<OutreachService>('Website');
  const [variations, setVariations] = useState<string[]>([]);
  const [variationIndex, setVariationIndex] = useState(0);
  const [editedMessage, setEditedMessage] = useState('');
  const [countSinceCoolDown, setCountSinceCoolDown] = useState(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [calibrated, setCalibrated] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownThreshold = 15;
  const cooldownDuration = 600; // 10 minutes (600s)

  const activeContact = contacts[currentIndex];

  const pacingOptions = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '3m', value: 180 },
    { label: '5m', value: 300 },
    { label: '10m', value: 600 },
    { label: '30m', value: 1800 },
  ];

  const [showTerminal, setShowTerminal] = useState(false);

  const jarvisSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Advanced selection for best Jarvis proxy
    const jarvisVoice = voices.find(v => 
      v.name.includes('Daniel') || 
      v.name.includes('Google UK English Male') || 
      (v.lang === 'en-GB' && v.name.includes('Male'))
    );
    
    if (jarvisVoice) utterance.voice = jarvisVoice;
    // Faster, more realistic Jarvis settings
    utterance.rate = 1.35; // Jarvis fast mode
    utterance.pitch = 0.88;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const getTacticalResponse = (type: 'engage' | 'next' | 'complete' | 'gen' | 'fail') => {
    const responses = {
      engage: [
        "Autopilot engaged, sir. I'll maintain the tactical frequency.",
        "Initiating outreach protocols. Sit back, I have the controls.",
        "Uplink locked. Commencing mission, sir."
      ],
      next: [
        "Target acquisition complete. Engaging next sector.",
        "Recalibrating for the next contact. Resonance is holding steady.",
        "Moving to the next asset. Data packet is prepped and ready."
      ],
      complete: [
        "Outreach cycle complete, sir. All targets have been addressed.",
        "The queue is clear. Operation outcome: Optimal.",
        "Mission successful. All data packets successfully delivered."
      ],
      gen: [
        "Analyzing target resonance... synthesizing tactical response.",
        "Running social heuristics. Drafting a persuasive uplink... there we go.",
        "Scanning profile data. Neural draft complete and optimized for impact."
      ],
      fail: [
        "Sir, we have an uplink interference. Permission required.",
        "Browser defenses detected. I'll need a manual override on that pop-up.",
        "Transmission blocked. Calibrate your browser settings, please."
      ]
    };
    const set = responses[type];
    return set[Math.floor(Math.random() * set.length)];
  };

  const fetchQueue = useCallback(async () => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    setLoading(true);
    const path = 'contacts';
    try {
      const q = query(
        collection(db, path), 
        where('ownerId', '==', effectiveUid),
        where('status', 'in', ['New', 'Follow Up']),
        orderBy('createdAt', 'asc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contact));
      
      const now = new Date();
      const filtered = data.filter(c => {
        if (c.status === 'New') return true;
        if (c.status === 'Follow Up' && c.followUpDate) {
          return new Date(c.followUpDate) <= now;
        }
        return false;
      });

      setContacts(filtered);
      if (filtered[0]) {
        setEditedMessage(filtered[0].draftedMessage || '');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQueue();
    // Jarvis Welcome
    setTimeout(() => {
      jarvisSpeak("Outreach grid online. I'm scanning for active signatures in your sector, sir.");
      playSound('start');
    }, 1000);
  }, [fetchQueue]);

  const toggleAutoPilot = () => {
    const newState = !autoPilot;
    setAutoPilot(newState);
    
    if (newState) {
      if (!calibrated) {
        jarvisSpeak("Sir, I'll need you to calibrate the holographic uplink first. Use the initialization module in the control bar.");
        setAutoPilot(false);
        playSound('alert');
        return;
      }
      jarvisSpeak(getTacticalResponse('engage'));
      // If we're not currently pacing or cooling, and we have a target, engage after a brief human-like pause
      if (!pacing && !isCoolingDown && activeContact) {
        setTimeout(() => {
          handleOpenWhatsApp();
        }, 2500); // 2.5s tactical delay
      }
    } else {
      jarvisSpeak("Manual control restored. I'm staying in the shadows for now.");
    }
  };

  const calibrateUplink = () => {
    jarvisSpeak("Calibrating holographic uplink... stand by.");
    const win = window.open('about:blank', '_blank', 'width=1,height=1');
    if (win) {
      setTimeout(() => win.close(), 1000); // 1s to ensure browser registers interaction
      setCalibrated(true);
      jarvisSpeak("Uplink synchronized. We are green across the board, sir.");
      playSound('start');
    } else {
      jarvisSpeak("Calibration failed. Browser defenses are active. Please allow popups for this sector.");
      playSound('alert');
    }
  };

  // Timer logic
  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && (pacing || isCoolingDown)) {
      const wasCoolingDown = isCoolingDown;
      setPacing(false);
      setIsCoolingDown(false);
      
      if (autoPilot) {
        if (wasCoolingDown) {
          jarvisSpeak("Core temperature normalized, sir. Resuming tactical outreach.");
          playSound('start');
        }
        
        // Automatic jump to next
        const nextIdx = currentIndex + 1;
        if (nextIdx < contacts.length) {
          setCurrentIndex(nextIdx);
          setEditedMessage(contacts[nextIdx].draftedMessage || '');
          setIsEditing(false);
          
          const nextTarget = contacts[nextIdx];
          playSound('scan');
          jarvisSpeak(getTacticalResponse('next').replace('next asset', nextTarget.businessName));
          
          // Delay transmission with a human-like tactical jitter (4s base + 0.5s-2s random)
          const tacticalJitter = 4000 + (Math.random() * 1500);
          setTimeout(() => {
            handleOpenWhatsApp(contacts[nextIdx], true);
          }, tacticalJitter);
        } else {
          // End of current local queue
          setAutoPilot(false);
          playSound('complete');
          jarvisSpeak("Nice work, sir. The queue is sanitized. All tactical objectives have been met.");
          fetchQueue(); // Try to get more leads if any
        }
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, pacing, isCoolingDown, autoPilot, contacts, currentIndex, fetchQueue]);

  // Focus detection for auto-return
  useEffect(() => {
    const onFocus = () => {
      if (pacing === false && timeLeft === 0 && !isCoolingDown) {
         // If user returned after an "Open", start pacing
         // But we only want this if we *actually* triggered an open
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [pacing, timeLeft, isCoolingDown]);

  const startPacing = () => {
    setPacing(true);
    // Randomize the interval slightly to look human (+/- 10%)
    const variation = Math.floor(pacingInterval * 0.1);
    const randomDelay = pacingInterval + (Math.random() > 0.5 ? variation : -variation);
    setTimeLeft(randomDelay);
    setTotalWaitTime(randomDelay);
    
    // Increment counter for cooldown
    const nextCount = countSinceCoolDown + 1;
    setCountSinceCoolDown(nextCount);
    
    if (nextCount >= cooldownThreshold) {
      setIsCoolingDown(true);
      setTimeLeft(cooldownDuration);
      setTotalWaitTime(cooldownDuration);
      setCountSinceCoolDown(0);
      jarvisSpeak("Sir, we've reached the transmission limit for this period. Initiating 10-minute cooling cycle to avoid tactical detection.");
    }
  };

  const handleGenerateMessage = async (autoResume = false) => {
    if (!activeContact) return;
    setGenerating(true);
    playSound('start');
    jarvisSpeak(getTacticalResponse('gen'));
    try {
      const vars = await generateJaegerMessages(
        selectedService,
        activeContact.businessName,
        activeContact.niche || "",
        `Status: ${activeContact.status}`
      );
      
      setVariations(vars);
      setVariationIndex(0);
      setEditedMessage(vars[0] || "");
      setIsEditing(true);
      jarvisSpeak("Tactical draft uploaded, sir. It's quite persuasive.");
      
      if (autoResume && autoPilot) {
        setTimeout(() => handleOpenWhatsApp(activeContact, true), 1500);
      }
    } catch (error) {
      jarvisSpeak("Neural link interrupted. Error in synthesis.");
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const cycleVariation = (dir: 'next' | 'prev') => {
    if (variations.length === 0) return;
    let nextIdx = dir === 'next' ? variationIndex + 1 : variationIndex - 1;
    if (nextIdx >= variations.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = variations.length - 1;
    
    setVariationIndex(nextIdx);
    setEditedMessage(variations[nextIdx]);
    playSound('scan');
  };

  const handleOpenWhatsApp = async (contactToOpen = activeContact, isAuto = false) => {
    if (!contactToOpen) return;

    if (!isAuto) {
      playSound('start');
      jarvisSpeak("Establishing manual link, sir. Stand by for transmission.");
    }

    const message = editedMessage || contactToOpen.draftedMessage || '';
    
    if (isAuto && !message) {
      jarvisSpeak(`Asset ${contactToOpen.businessName} lacks a draft. I'll synthesize one now.`);
      await handleGenerateMessage(true);
      return; 
    }

    const encodedMessage = encodeURIComponent(message);
    
    // Hardened Zimbabwe formatting: Must follow 263... pattern for browser/app integration
    let phoneNum = contactToOpen.phoneNumber.replace(/[^\d]/g, '');
    if (phoneNum.startsWith('0')) {
      phoneNum = '263' + phoneNum.substring(1);
    } else if (phoneNum.length === 9) {
       phoneNum = '263' + phoneNum;
    } else if (phoneNum.startsWith('263')) {
      // already good
    } else {
       phoneNum = '263' + phoneNum;
    }
    
    const url = `https://wa.me/${phoneNum}?text=${encodedMessage}`;

    const path = `contacts/${contactToOpen.id}`;
    try {
      await updateDoc(doc(db, 'contacts', contactToOpen.id), {
        status: 'Opened',
        lastContactedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    const win = window.open(url, '_blank');
    
    if (isAuto) {
      if (!win) {
        jarvisSpeak(`Uplink to ${contactToOpen.businessName} failed. Flagging as invalid and recalibrating.`);
        playSound('alert');
        // Automatically report as invalid and move to next
        await reportInvalid(); 
        return;
      }
      jarvisSpeak(`Packet delivered to ${contactToOpen.businessName}. Commencing recovery phase.`);
      playSound('scan');
    }

    startPacing();
  };

  const reportInvalid = async () => {
    if (!activeContact) return;
    jarvisSpeak(`ID error detected for ${activeContact.businessName}. Filtering from queue.`);
    playSound('alert');
    try {
      await updateDoc(doc(db, 'contacts', activeContact.id), { status: 'Invalid' });
      
      if (autoPilot) {
        // If in autopilot, we don't need a full pacing delay because no message was sent
        jarvisSpeak("Skipping invalid entry. Recalibrating coordinates.");
        // Set a short delay before jumping to the next
        setPacing(true);
        setTimeLeft(3); // 3 second skip delay
        setTotalWaitTime(3);
      } else {
        nextContact();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `contacts/${activeContact.id}`);
    }
  };

  const nextContact = () => {
    if (currentIndex < contacts.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setEditedMessage(contacts[nextIdx].draftedMessage || '');
      setIsEditing(false);
      
      if (autoPilot) {
        // If autoPilot was on but we reached here via manual button click
        // Wait a short bit then trigger
        const nextTarget = contacts[nextIdx];
        jarvisSpeak(getTacticalResponse('next').replace('next asset', nextTarget.businessName));
        playSound('scan');
        setTimeout(() => handleOpenWhatsApp(nextTarget, true), 3000);
      }
    } else {
      if (autoPilot) {
        setAutoPilot(false);
        playSound('complete');
        jarvisSpeak(getTacticalResponse('complete'));
      }
      fetchQueue();
      setCurrentIndex(0);
    }
  };

  const updateStatus = async (status: ContactStatus) => {
    if (!activeContact) return;
    const path = `contacts/${activeContact.id}`;
    try {
      await updateDoc(doc(db, 'contacts', activeContact.id), { status });
      nextContact();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const showTerminalBtn = (
    <button 
      onClick={() => setShowTerminal(true)}
      className="fixed bottom-10 right-10 w-16 h-16 bg-black border-2 border-[#00F2FF] flex items-center justify-center animate-pulse group z-50 shadow-[0_0_20px_#00F2FF33]"
    >
      <div className="absolute inset-0 bg-[#00F2FF]/5 animate-ping group-hover:block hidden" />
      <Terminal className="w-8 h-8 text-[#00F2FF]" />
    </button>
  );

  const terminalOverlay = (
    <AnimatePresence>
      {showTerminal && (
        <JarvisTerminal 
          onClose={() => setShowTerminal(false)} 
          jarvisSpeak={jarvisSpeak}
          context={`Current Queue: ${contacts.length} items. Current Target: ${activeContact?.businessName || 'None'}. Autopilot is ${autoPilot ? 'ON' : 'OFF'}.`}
        />
      )}
    </AnimatePresence>
  );

  if (loading) return <div className="text-[#00F2FF] font-mono animate-pulse tracking-widest">INITIALIZING_COMBAT_SUITE...</div>;

  if (contacts.length === 0) return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-4">
        <h3 className="text-[#00F2FF]/60 text-[10px] font-mono uppercase tracking-[0.3em] font-black border-l-2 border-[#00F2FF] pl-3">Daily_Mission_Status</h3>
        <GoalDashboard />
      </div>

      <div className="flex flex-col items-center justify-center py-20 text-center hud-card bg-black/20">
        <div className="p-8 border border-[#00F2FF]/20 rounded-full mb-8 relative">
          <div className="absolute inset-0 bg-[#00F2FF] blur-2xl opacity-10" />
          <Zap className="w-12 h-12 text-[#00F2FF]/40" />
        </div>
        <h3 className="text-2xl font-mono font-black mb-2 text-[#00F2FF] tracking-tighter">GRID_EMPTY</h3>
        <p className="text-[#A0D2EB]/50 max-w-xs mx-auto mb-10 font-mono text-xs uppercase tracking-widest">No active targets identified in sector. Recalibrate lead database.</p>
        <button 
          onClick={fetchQueue}
          className="hud-button"
        >
          RESCAN_GRID
        </button>
      </div>

      <button 
        onClick={() => setShowTerminal(true)}
        className="fixed bottom-10 right-10 w-16 h-16 bg-black border-2 border-[#00F2FF] flex items-center justify-center animate-pulse group shadow-[0_0_20px_#00F2FF33]"
      >
        <div className="absolute inset-0 bg-[#00F2FF]/5 animate-ping group-hover:block hidden" />
        <Terminal className="w-8 h-8 text-[#00F2FF]" />
      </button>

      <AnimatePresence>
        {showTerminal && (
          <JarvisTerminal 
            onClose={() => setShowTerminal(false)} 
            jarvisSpeak={jarvisSpeak}
            context={`Current Queue: ${contacts.length} items. Current Target: ${activeContact?.businessName || 'None'}. Autopilot is ${autoPilot ? 'ON' : 'OFF'}.`}
          />
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Strategic Goals Header */}
      <div className="space-y-4">
        <h3 className="text-[#00F2FF]/60 text-[10px] font-mono uppercase tracking-[0.3em] font-black border-l-2 border-[#00F2FF] pl-3">Daily_Mission_Status</h3>
        <GoalDashboard />
      </div>

      {/* HUD Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 hud-card p-8 bg-[#00F2FF]/5">
        <div className="hud-scanning" />
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className={cn(
              "w-14 h-14 border flex items-center justify-center transition-all relative overflow-hidden",
              autoPilot ? "border-[#00F2FF] bg-[#00F2FF]/10" : "border-[#00F2FF]/20 bg-black/40"
            )}>
              <Zap className={cn("w-6 h-6", autoPilot ? "text-[#00F2FF] hud-text-glow" : "text-[#A0D2EB]/30")} />
              {autoPilot && (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-full h-[1px] bg-[#00F2FF]/30 absolute top-1/4 animate-scan" />
                </div>
              )}
            </div>
            {autoPilot && <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00F2FF] shadow-[0_0_10px_#00F2FF]" />}
          </div>
          <div className="font-mono">
            <h2 className="font-black text-[#00F2FF] tracking-widest text-sm uppercase">AUTOPILOT_PROTOCOLS ({autoPilot ? 'ACTIVE' : 'IDLE'})</h2>
            <p className="text-[10px] text-[#A0D2EB]/50 uppercase tracking-[0.2em] mt-1">
              REMAINING: {contacts.length - currentIndex} / POINTER: {currentIndex + 1}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           {!calibrated && (
             <button 
               onClick={calibrateUplink}
               className="hud-button border-[#FFD700]/30 text-[#FFD700]/60 hover:border-[#FFD700] hover:text-[#FFD700] bg-[#FFD700]/5 flex items-center gap-2"
             >
               <Zap className="w-3 h-3" />
               INIT_UPLINK
             </button>
           )}

           <div className="flex items-center gap-3 bg-black/40 border border-[#00F2FF]/20 px-4 py-2 relative">
             <Timer className="w-4 h-4 text-[#00F2FF]" />
             <select 
               value={pacingInterval}
               onChange={(e) => setPacingInterval(Number(e.target.value))}
               disabled={pacing || autoPilot}
               className="bg-transparent border-none text-[10px] font-mono font-bold focus:outline-none uppercase tracking-widest text-[#00F2FF] cursor-pointer"
             >
               {pacingOptions.map(opt => (
                 <option key={opt.value} value={opt.value} className="bg-[#000508]">{opt.label} DELAY_FREQ</option>
               ))}
             </select>
           </div>

           <button 
             onClick={toggleAutoPilot}
             className={cn(
               "hud-button flex items-center gap-3",
               autoPilot ? "bg-[#00F2FF]/20 text-[#00F2FF] border-[#00F2FF]" : "text-[#A0D2EB]/40 border-[#A0D2EB]/20"
             )}
           >
             {autoPilot ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
             {autoPilot ? 'DISABLE_AUTO' : 'ENGAGE_AUTO'}
           </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeContact.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="hud-card border-[#00F2FF]/30 overflow-hidden relative group/target"
        >
          <div className="hud-glint" />
          {/* HUD Grids Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00F2FF 1px, transparent 0)', backgroundSize: '20px 20px' }} />
          
          <div className="absolute -top-10 -right-10 w-64 h-64 opacity-10 pointer-events-none">
             <div className="hud-ring-outer inset-0 border-[#00F2FF]/40" />
             <div className="hud-ring-inner inset-10 border-[#00F2FF]/30" />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-32 bg-[#00F2FF]/20 animate-[spin_4s_linear_infinite]" />
                <div className="w-32 h-1 bg-[#00F2FF]/20 animate-[spin_4s_linear_infinite]" />
             </div>
          </div>

          {/* Target Identification Header */}
          <div className="p-10 border-b border-[#00F2FF]/10 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-black/20 relative overflow-hidden">
            <div className="hud-scanning opacity-10" />
            <div className="relative">
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-8 h-[1px] bg-[#00F2FF]/40 hidden lg:block" />
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-[#00F2FF]/10 text-[#00F2FF] text-[9px] font-mono font-bold uppercase tracking-[0.3em] border border-[#00F2FF]/30">
                  {activeContact.niche?.toUpperCase() || 'EXTERNAL_ASSET'}
                </span>
                <span className="text-[#A0D2EB]/30 text-[10px] font-mono tracking-tighter flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full animate-pulse" />
                   COORD: {activeContact.phoneNumber}
                </span>
              </div>
              <h1 className="text-5xl font-mono font-black tracking-tighter text-[#00F2FF] hud-text-glow uppercase relative">
                {activeContact.businessName}
                <div className="absolute -bottom-2 left-0 w-32 h-[2px] bg-gradient-to-r from-[#00F2FF] to-transparent" />
              </h1>
              {activeContact.contactName && (
                <div className="flex items-center gap-2 mt-4 bg-[#00F2FF]/5 border-l border-[#00F2FF] px-3 py-1">
                  <span className="text-[#00F2FF]/40 text-[9px] font-mono uppercase tracking-[0.2em]">Target_Admin:</span>
                  <p className="text-[#A0D2EB] font-bold tracking-[0.15em] uppercase text-[11px]">{activeContact.contactName}</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
               {['Contacted', 'Interested', 'Replied', 'Not Interested'].map((status) => (
                 <button
                   key={status}
                   onClick={() => updateStatus(status as ContactStatus)}
                   className="px-4 py-3 bg-black/40 hover:bg-[#00F2FF]/10 text-[#A0D2EB]/40 hover:text-[#00F2FF] text-[9px] font-mono font-bold transition-all border border-[#00F2FF]/10 uppercase tracking-[0.2em] relative overflow-hidden"
                 >
                   <span className="relative z-10">{status}</span>
                 </button>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
             {/* Technical Data Sidebar */}
             <div className="lg:col-span-3 border-r border-[#00F2FF]/10 p-6 space-y-8 bg-black/20 text-[9px] font-mono">
                <div className="space-y-2">
                  <p className="text-[#A0D2EB]/30 uppercase tracking-widest">ASSET_IDENT</p>
                  <p className="text-[#A0D2EB]/60 font-bold break-all">ID_{activeContact.id.toUpperCase()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[#A0D2EB]/30 uppercase tracking-widest">STATUS</p>
                  <p className="text-[#00F2FF] font-bold">READY_FOR_ENGAGEMENT</p>
                </div>
                <div className="space-y-4 pt-4 border-t border-[#00F2FF]/10">
                   <div className="flex justify-between items-center text-[#A0D2EB]/30">
                     <span>STABILITY</span>
                     <span className="text-[#00F2FF]">94.2%</span>
                   </div>
                   <div className="h-1 bg-black overflow-hidden relative">
                      <div className="absolute inset-0 bg-[#00F2FF]/20" />
                      <div className="absolute inset-y-0 left-0 w-[94.2%] bg-[#00F2FF]" />
                   </div>
                </div>
             </div>

             {/* Message Area */}
             <div className="lg:col-span-9 p-10 bg-black/10">
                <div className="flex flex-col gap-6 mb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[#00F2FF]/60 text-[10px] font-mono uppercase tracking-[0.3em] font-black border-l-2 border-[#00F2FF] pl-3">Neural_Draft_v5.0_Jaeger</h3>
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleGenerateMessage()}
                        disabled={generating}
                        className={cn(
                          "flex items-center gap-2 text-[9px] font-mono text-[#00F2FF]/40 hover:text-[#00F2FF] transition-all group",
                          generating && "animate-pulse"
                        )}
                      >
                        <RotateCcw className={cn("w-3 h-3 group-hover:rotate-180 transition-transform duration-500", generating && "animate-spin")} />
                        {generating ? 'SYNTHESIZING...' : 'REGENERATE_TACTICAL_DATA'}
                      </button>
                      <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center gap-2 text-[9px] font-mono text-[#A0D2EB]/40 hover:text-[#00F2FF] transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        {isEditing ? 'COMMIT_DRAFT' : 'MANUAL_OVERRIDE'}
                      </button>
                    </div>
                  </div>

                  {/* Service Selection Tabs */}
                  <div className="flex flex-wrap gap-2 border-b border-[#00F2FF]/5 pb-4">
                    {(['Website', 'Facebook Ads', 'Flyers', 'Lead Generation', 'Custom', 'Follow-up'] as OutreachService[]).map((service) => (
                      <button
                        key={service}
                        onClick={() => {
                          setSelectedService(service);
                          playSound('scan');
                        }}
                        className={cn(
                          "px-3 py-1 text-[8px] font-mono uppercase tracking-widest border transition-all",
                          selectedService === service 
                            ? "border-[#00F2FF] text-[#00F2FF] bg-[#00F2FF]/5" 
                            : "border-transparent text-[#A0D2EB]/30 hover:text-[#A0D2EB]/60"
                        )}
                      >
                        {service}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="hud-card bg-black/40 border-[#00F2FF]/5 p-8 min-h-[220px] relative group/msg">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-20">
                    <div className="w-1 h-3 bg-[#00F2FF]" />
                    <div className="w-1 h-1 bg-[#00F2FF]" />
                  </div>

                  {/* Variation Controls */}
                  {variations.length > 0 && !isEditing && (
                    <div className="absolute -bottom-10 right-0 flex items-center gap-4 bg-black/60 border border-[#00F2FF]/10 px-4 py-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <span className="text-[8px] font-mono text-[#00F2FF]/40 uppercase tracking-widest">Variation {variationIndex + 1}/{variations.length}</span>
                      <div className="flex gap-2">
                        <button onClick={() => cycleVariation('prev')} className="hover:text-[#00F2FF] text-[#A0D2EB]/30"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => cycleVariation('next')} className="hover:text-[#00F2FF] text-[#A0D2EB]/30"><ChevronRight className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      className="w-full h-full bg-transparent text-[#00F2FF] focus:outline-none resize-none font-mono leading-relaxed text-sm"
                      rows={8}
                    />
                  ) : (
                    <p className="text-[#00F2FF] font-mono leading-relaxed whitespace-pre-wrap text-[13px] tracking-tight">
                      {editedMessage || activeContact.draftedMessage || "NULL_DATA_DETECTED / REFRESH_SYSTEM"}
                    </p>
                  )}
                </div>
             </div>
          </div>

          {/* Action Interface */}
          <div className="p-10 bg-[#00F2FF]/5 border-t border-[#00F2FF]/10 relative group">
            {pacing || isCoolingDown ? (
              <div className="flex flex-col items-center justify-center py-10 relative overflow-hidden">
                <div className="hud-scanning opacity-50" />
                <div className="relative mb-8">
                  {/* SVG HUD Progress Ring */}
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="transparent"
                      className="text-[#00F2FF]/10"
                    />
                    <motion.circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray="364.4"
                      initial={{ strokeDashoffset: 364.4 }}
                      animate={{ strokeDashoffset: 364.4 - (364.4 * (timeLeft / totalWaitTime)) }}
                      className="text-[#00F2FF] hud-text-glow"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-2xl font-black text-[#00F2FF] hud-text-glow">
                      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[8px] text-[#00F2FF]/40 uppercase">SEC_LEFT</span>
                  </div>
                </div>
                
                <h4 className={cn(
                  "uppercase text-[11px] font-mono font-black tracking-[0.4em]",
                  isCoolingDown ? "text-red-500 animate-pulse" : "text-[#00F2FF]"
                )}>
                  {isCoolingDown ? 'COOLING_CORE_TEMP' : 'MASKING_USER_PATTERN'}
                </h4>
                
                {(!autoPilot || isCoolingDown) && (
                   <button 
                     onClick={() => { setTimeLeft(0); setPacing(false); setIsCoolingDown(false); }}
                     className="mt-8 text-[9px] font-mono text-[#A0D2EB]/30 hover:text-[#00F2FF] uppercase font-bold border border-[#00F2FF]/20 px-4 py-2 hover:bg-[#00F2FF]/5 transition-all"
                   >
                     OVERRIDE_THROTTLING
                   </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={() => handleOpenWhatsApp()}
                  className="flex-1 py-8 hud-button flex items-center justify-center gap-6 group/btn relative overflow-hidden"
                >
                  <div className="absolute left-10 opacity-20 pointer-events-none group-hover/btn:opacity-60 transition-opacity">
                     <div className="w-12 h-12 border-2 border-[#00F2FF] flex items-center justify-center rounded-full animate-[spin_5s_linear_infinite]">
                       <div className="w-1 h-8 bg-[#00F2FF]/40" />
                     </div>
                  </div>
                  <span className="text-xl font-mono font-black tracking-widest hud-text-glow">FIRE_ENGAGEMENT</span>
                  <Send className="w-5 h-5 fill-[#00F2FF] group-hover/btn:translate-x-2 transition-transform" />
                </button>

                <button 
                  onClick={() => { playSound('alert'); reportInvalid(); }}
                  className="px-8 py-8 hud-button border-red-500/20 text-red-500/60 hover:border-red-500/50 hover:text-red-500 hover:bg-red-500/5 transition-all flex flex-col items-center justify-center gap-2 group/err"
                >
                  <XCircle className="w-6 h-6 group-hover/err:rotate-90 transition-transform" />
                  <span className="text-[10px] font-mono font-black tracking-[0.2em]">ID_ERROR</span>
                </button>
              </div>
            )}
            
            <div className="mt-10 flex items-center justify-center gap-12 border-t border-[#00F2FF]/5 pt-8 opacity-40 grayscale hover:grayscale-0 transition-all relative">
               <div className="absolute -top-[1px] left-0 w-1/4 h-[1px] bg-gradient-to-r from-[#00F2FF] to-transparent" />
               <div className="absolute -top-[1px] right-0 w-1/4 h-[1px] bg-gradient-to-l from-[#00F2FF] to-transparent" />
               
               <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#00F2FF]" />
                  <span className="text-[8px] font-mono font-bold tracking-widest uppercase">Target_Lock</span>
               </div>
               <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-[8px] font-mono font-bold tracking-widest uppercase">Grid_Safe</span>
               </div>
               <div className="flex flex-col items-center gap-3">
                  <RotateCcw className="w-4 h-4 text-[#00F2FF]" />
                  <span className="text-[8px] font-mono font-bold tracking-widest uppercase">Loop_Active</span>
               </div>
            </div>

            {/* Tech Feed */}
            <div className="mt-6 flex justify-center">
               <div className="px-4 py-1 bg-[#00F2FF]/5 border border-[#00F2FF]/10 text-[7px] font-mono text-[#00F2FF]/40 uppercase tracking-[0.2em] animate-pulse">
                  SYNCING_NEURAL_RESONANCE... DATA_BUFFER_STABLE... UPLINK_MODE_WHATSAPP
               </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Security Disclaimer HUD */}
      <div className="hud-card border-red-500/20 bg-red-500/5 p-6 flex items-start gap-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-red-500 opacity-20" />
        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5 hud-text-glow shadow-red-500" />
        <div>
          <p className="text-[10px] font-mono text-red-400 leading-relaxed font-bold uppercase tracking-widest">
            OPERATIONAL_SECURITY_WARNING: Ensure compliance with international data privacy laws. Do not saturate neural links. Limit frequency to avoid network exclusion.
          </p>
        </div>
      </div>

      {showTerminalBtn}
      {terminalOverlay}
    </div>
  );
};
