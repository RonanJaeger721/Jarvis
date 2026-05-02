import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, limit, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Contact, ContactStatus, OfferType, Template, BusinessLog } from '../types';
import { Send, Zap, RotateCcw, AlertTriangle, CheckCircle2, Timer, Pause, Play, Edit3, XCircle, ChevronLeft, ChevronRight, MessageSquare, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateMessage } from '../services/messagingService';
import { cn, cleanPhoneForWhatsApp } from '../lib/utils';
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
  const [selectedOffer, setSelectedOffer] = useState<OfferType>('Website');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateIndexMap, setTemplateIndexMap] = useState<Record<string, number>>({
    'Website': 0,
    'Flyer': 0,
    'Facebook Ads': 0,
    'Other': 0
  });
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
        "Recalibrating message vector... applying niche heuristics.",
        "Selecting next communication module from the blueprint library.",
        "Synchronizing template with target lead data... done."
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

  const fetchTemplates = async () => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    try {
      const q = query(collection(db, 'templates'), where('ownerId', '==', effectiveUid));
      const snapshot = await getDocs(q);
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
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
        // Initial cycle for the first contact
        const firstContact = filtered[0];
        const initialOffer = (firstContact.offer as OfferType) || 'Website';
        setSelectedOffer(initialOffer);
        // We defer message generation to the useEffect that watches selectedOffer/currentIndex
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial boot sequence
  useEffect(() => {
    fetchQueue();
    fetchTemplates();
    setTimeout(() => {
      jarvisSpeak("Outreach grid online. I'm scanning for active signatures in your sector, sir.");
      playSound('start');
    }, 1000);
  }, [fetchQueue, user]);

  // Automatic cycle trigger when contact or offer changes
  useEffect(() => {
    if (activeContact && templates.length > 0) {
      cycleToNextMessage(selectedOffer, activeContact);
    }
  }, [currentIndex, selectedOffer, templates.length === 0]);

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
      if (!pacing && !isCoolingDown && activeContact) {
        setTimeout(() => handleOpenWhatsApp(), 2500);
      }
    } else {
      jarvisSpeak("Manual control restored. I'm staying in the shadows for now.");
    }
  };

  const calibrateUplink = () => {
    jarvisSpeak("Calibrating holographic uplink... stand by.");
    const win = window.open('about:blank', '_blank', 'width=1,height=1');
    if (win) {
      setTimeout(() => win.close(), 1000);
      setCalibrated(true);
      jarvisSpeak("Uplink synchronized. We are green across the board, sir.");
      playSound('start');
    } else {
      jarvisSpeak("Calibration failed. Browser defenses are active. Please allow popups for this sector.");
      playSound('alert');
    }
  };

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
        
        const nextIdx = currentIndex + 1;
        if (nextIdx < contacts.length) {
          setCurrentIndex(nextIdx);
          // Rotation is handled by the useEffect watching currentIndex
          setIsEditing(false);
          
          const nextTarget = contacts[nextIdx];
          playSound('scan');
          jarvisSpeak(getTacticalResponse('next').replace('next asset', nextTarget.businessName));
          
          const tacticalJitter = 4000 + (Math.random() * 1500);
          setTimeout(() => {
            handleOpenWhatsApp(contacts[nextIdx], true);
          }, tacticalJitter);
        } else {
          setAutoPilot(false);
          playSound('complete');
          jarvisSpeak("Nice work, sir. The queue is sanitized. All tactical objectives have been met.");
          fetchQueue();
        }
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, pacing, isCoolingDown, autoPilot, contacts, currentIndex, fetchQueue]);

  const startPacing = () => {
    setPacing(true);
    const variation = Math.floor(pacingInterval * 0.1);
    const randomDelay = pacingInterval + (Math.random() > 0.5 ? variation : -variation);
    setTimeLeft(randomDelay);
    setTotalWaitTime(randomDelay);
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

  const cycleToNextMessage = (offer: OfferType, contact: Contact) => {
    if (!contact) return;
    const filtered = templates.filter(t => t.offerType === offer);
    if (filtered.length === 0) {
      setEditedMessage(contact.draftedMessage || '');
      return;
    }
    
    const currentIndexForTier = templateIndexMap[offer] || 0;
    const nextIdx = (currentIndexForTier) % filtered.length;
    
    // Update index map for NEXT time this tier is used
    setTemplateIndexMap(prev => ({
      ...prev,
      [offer]: (nextIdx + 1) % filtered.length
    }));
    
    const template = filtered[nextIdx];
    const newMessage = generateMessage(template.content, {
      businessName: contact.businessName,
      contactName: contact.contactName,
      niche: contact.niche,
      offer: offer,
      context: contact.context
    });
    
    setEditedMessage(newMessage);
    setIsEditing(false);
    playSound('scan');
  };

  const handleRotateBlueprint = () => {
    if (!activeContact) return;
    cycleToNextMessage(selectedOffer, activeContact);
    jarvisSpeak("Manual rotation triggered. Selecting next blueprint variation.");
  };

  const incrementLog = async (field: keyof BusinessLog) => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    const today = new Date().toISOString().split('T')[0];
    const logQ = query(collection(db, 'business_logs'), where('ownerId', '==', effectiveUid), where('date', '==', today));
    const logSnap = await getDocs(logQ);
    
    // XP mapping
    const xpMap: Partial<Record<keyof BusinessLog, number>> = {
      whatsappCount: 5,
      emailCount: 5,
      replies: 50,
      followUps: 30,
      calls: 100,
      clients: 1000
    };

    if (logSnap.empty) {
      await addDoc(collection(db, 'business_logs'), {
        date: today,
        ownerId: effectiveUid,
        [field]: 1,
        whatsappCount: field === 'whatsappCount' ? 1 : 0,
        xpEarned: xpMap[field] || 0
      });
    } else {
      const docRef = logSnap.docs[0].ref;
      const data = logSnap.docs[0].data();
      const current = (data[field as string] || 0) as number;
      const currentXP = (data.xpEarned || 0) as number;
      await updateDoc(docRef, {
        [field]: current + 1,
        xpEarned: currentXP + (xpMap[field] || 0)
      });
    }
  };

  const handleOpenWhatsApp = async (contactToOpen = activeContact, isAuto = false) => {
    if (!contactToOpen) return;
    if (!isAuto) {
      playSound('start');
      jarvisSpeak("Establishing manual link, sir. Stand by for transmission.");
    }
    const message = editedMessage || contactToOpen.draftedMessage || '';
    const encodedMessage = encodeURIComponent(message);
    
    const phoneNum = cleanPhoneForWhatsApp(contactToOpen.phoneNumber);
    const url = `https://wa.me/${phoneNum}?text=${encodedMessage}`;
    const path = `contacts/${contactToOpen.id}`;
    try {
      await updateDoc(doc(db, 'contacts', contactToOpen.id), {
        status: 'Opened',
        lastContactedAt: new Date().toISOString()
      });
      await incrementLog('whatsappCount');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }

    const win = window.open(url, 'jaeger_wa_uplink');
    if (isAuto) {
      if (!win) {
        jarvisSpeak(`Uplink to ${contactToOpen.businessName} failed. Browser defenses detected.`);
        playSound('alert');
        await updateDoc(doc(db, 'contacts', contactToOpen.id), { status: 'Invalid' });
        nextContact();
        return;
      }
      jarvisSpeak(`Uplink established for ${contactToOpen.businessName}. Reusing tactical window.`);
      playSound('scan');
    } else {
      jarvisSpeak("Tactical window synchronized. Reusing active link.");
    }
    startPacing();
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

  const reportInvalid = async () => {
    if (!activeContact) return;
    jarvisSpeak(`ID error detected for ${activeContact.businessName}. Filtering from queue.`);
    playSound('alert');
    try {
      await updateDoc(doc(db, 'contacts', activeContact.id), { status: 'Invalid' });
      nextContact();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `contacts/${activeContact.id}`);
    }
  };

  const nextContact = () => {
    if (currentIndex < contacts.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      // Rotation handled by useEffect
      setIsEditing(false);
    } else {
      setAutoPilot(false);
      fetchQueue();
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 hud-card p-6 bg-[#00F2FF]/5 relative rounded-[3rem] backdrop-blur-3xl shadow-2xl">
        <div className={cn(
          "hud-scanning rounded-full",
          isCoolingDown ? "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : pacing ? "bg-amber-400" : "bg-[#00F2FF]"
        )} />
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className={cn(
              "w-16 h-16 border flex items-center justify-center transition-all relative overflow-hidden rounded-full backdrop-blur-xl shadow-lg",
              autoPilot ? "border-[#00F2FF] bg-[#00F2FF]/10 hud-pulse-cyan" : "border-[#00F2FF]/20 bg-black/40"
            )}>
              <Zap className={cn("w-7 h-7", autoPilot ? "text-[#00F2FF] hud-text-glow" : "text-[#A0D2EB]/30")} />
              {autoPilot && (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-full h-[1px] bg-[#00F2FF]/30 absolute top-1/4 animate-scan" />
                </div>
              )}
            </div>
            {autoPilot && <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00F2FF] shadow-[0_0_10px_#00F2FF] rounded-full border-2 border-black" />}
          </div>
          <div className="font-mono">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-[#00F2FF] tracking-widest text-sm uppercase">AUTOPILOT_PROTOCOLS ({autoPilot ? 'ACTIVE' : 'IDLE'})</h2>
              {autoPilot && <div className="w-2 h-2 bg-[#00F2FF] rounded-full animate-ping" />}
            </div>
            <p className="text-[10px] text-[#A0D2EB]/50 uppercase tracking-[0.2em] mt-1">
              REMAINING: {contacts.length - currentIndex} / POINTER: {currentIndex + 1}
            </p>
            {(pacing || isCoolingDown) && (
              <div className="mt-2 flex items-center gap-3 animate-pulse">
                <div className="h-1 w-24 bg-black/40 rounded-full overflow-hidden border border-[#00F2FF]/10 relative">
                  <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / totalWaitTime) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                    className={cn(
                      "h-full",
                      isCoolingDown ? "bg-red-400" : "bg-[#00F2FF]"
                    )}
                  />
                </div>
                <div className="flex items-center gap-2">
                   <div className={cn("w-1 h-1 rounded-full", isCoolingDown ? "bg-red-400" : "bg-[#00F2FF] animate-ping")} />
                   <span className={cn(
                     "text-[10px] font-mono font-black tracking-widest",
                     isCoolingDown ? "text-red-400" : "text-[#00F2FF]"
                   )}>
                     {timeLeft}S
                   </span>
                </div>
              </div>
            )}
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

           <div className="flex items-center gap-3 bg-black/40 border border-[#00F2FF]/20 px-6 py-2.5 relative rounded-full backdrop-blur-xl">
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
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className={cn(
            "hud-card border-[#00F2FF]/30 overflow-hidden relative group/target transition-all duration-700",
            autoPilot && "hud-border-glow border-[#00F2FF]/50"
          )}
        >
          <div className="hud-glint" />
          <div className="absolute inset-0 hud-noise" />
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
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center bg-black/40 border border-[#00F2FF]/20 rounded-full overflow-hidden backdrop-blur-md shadow-[0_0_15px_rgba(0,242,255,0.05)]">
                  <span className="px-4 py-1.5 bg-[#00F2FF]/10 text-[#00F2FF] text-[9px] font-mono font-black uppercase tracking-[0.3em] border-r border-[#00F2FF]/30">
                    {activeContact.niche?.toUpperCase() || 'EXTERNAL_ASSET'}
                  </span>
                  <span className="px-4 py-1.5 text-[#A0D2EB]/60 text-[10px] font-mono tracking-tighter flex items-center gap-2">
                     <div className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full animate-pulse shadow-[0_0_5px_#00F2FF]" />
                     {activeContact.phoneNumber}
                  </span>
                </div>
              </div>
              <h1 className="text-6xl font-mono font-black tracking-tighter text-[#00F2FF] hud-text-glow uppercase relative leading-none">
                {activeContact.businessName}
                <div className="absolute -bottom-4 left-0 w-48 h-[3px] bg-gradient-to-r from-[#00F2FF] to-transparent rounded-full" />
              </h1>
              {activeContact.contactName && (
                <div className="flex items-center gap-2 mt-6 bg-[#00F2FF]/5 border-l-2 border-[#00F2FF] px-4 py-2 rounded-r-xl backdrop-blur-sm">
                  <span className="text-[#00F2FF]/40 text-[9px] font-mono uppercase tracking-[0.2em]">Target_Admin:</span>
                  <p className="text-[#A0D2EB] font-black tracking-[0.15em] uppercase text-[12px]">{activeContact.contactName}</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
               {['Contacted', 'Interested', 'Replied', 'Not Interested'].map((status) => (
                 <button
                   key={status}
                   onClick={() => updateStatus(status as ContactStatus)}
                   className="px-5 py-3.5 bg-black/40 hover:bg-[#00F2FF]/10 text-[#A0D2EB]/40 hover:text-[#00F2FF] text-[9px] font-mono font-black transition-all border border-[#00F2FF]/10 uppercase tracking-[0.2em] relative overflow-hidden rounded-full backdrop-blur-md group/status"
                 >
                   <div className="absolute inset-0 bg-gradient-to-tr from-[#00F2FF]/5 to-transparent opacity-0 group-hover/status:opacity-100 transition-opacity" />
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
                    <h3 className="text-[#00F2FF]/60 text-[10px] font-mono uppercase tracking-[0.3em] font-black border-l-2 border-[#00F2FF] pl-3">JAEGER_MESSAGING_ENGINE_v1.0</h3>
                    <div className="flex items-center gap-6">
                      <button
                        onClick={handleRotateBlueprint}
                        disabled={generating}
                        className={cn(
                          "flex items-center gap-2 text-[9px] font-mono text-[#00F2FF]/40 hover:text-[#00F2FF] transition-all group",
                          generating && "animate-pulse"
                        )}
                      >
                        <RotateCcw className={cn("w-3 h-3 group-hover:rotate-180 transition-transform duration-500")} />
                        ROTATE_BLUEPRINT
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

                  {/* Service Selection Tabs (Offer Core) */}
                  <div className="flex flex-wrap gap-2 border-b border-[#00F2FF]/5 pb-4">
                    {(['Website', 'Flyer', 'Facebook Ads', 'Other'] as OfferType[]).map((offer) => (
                      <button
                        key={offer}
                        onClick={() => {
                          setSelectedOffer(offer);
                          playSound('scan');
                        }}
                        className={cn(
                          "px-4 py-1.5 text-[8px] font-mono font-black uppercase tracking-widest border transition-all rounded-full backdrop-blur-sm",
                          selectedOffer === offer 
                            ? "border-[#00F2FF] text-[#00F2FF] bg-[#00F2FF]/10 shadow-[0_0_10px_rgba(0,242,255,0.2)]" 
                            : "border-white/10 text-[#A0D2EB]/30 hover:text-[#A0D2EB]/60 hover:bg-white/5"
                        )}
                      >
                        {offer}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="hud-card bg-black/40 border-[#00F2FF]/5 p-8 min-h-[220px] relative group/msg rounded-[2rem] shadow-inner backdrop-blur-xl">
                  <div className="absolute top-4 right-6 flex gap-1 opacity-20">
                    <div className="w-1.5 h-3 bg-[#00F2FF] rounded-full" />
                    <div className="w-1.5 h-1.5 bg-[#00F2FF] rounded-full" />
                  </div>

                  {templates.filter(t => t.offerType === selectedOffer).length > 0 && !isEditing && (
                    <div className="absolute -bottom-10 right-4 flex items-center gap-4 bg-black/60 border border-[#00F2FF]/10 px-5 py-2.5 opacity-0 group-hover/msg:opacity-100 transition-all rounded-full backdrop-blur-xl shadow-lg translate-y-4 group-hover/msg:translate-y-0">
                      <span className="text-[8px] font-mono text-[#00F2FF]/40 uppercase tracking-widest">
                        Tier Variation Activated
                      </span>
                      <div className="flex gap-2">
                        <button onClick={handleRotateBlueprint} className="hover:text-[#00F2FF] text-[#A0D2EB]/30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
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
                <div className={cn(
                  "hud-scanning",
                  isCoolingDown ? "bg-red-500 shadow-[0_0_20px_red]" : "bg-amber-400"
                )} />
                <div className="relative mb-8">
                  {/* SVG HUD Progress Ring */}
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="72"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="transparent"
                      className="text-[#00F2FF]/5"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="72"
                      stroke="currentColor"
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray="452.4"
                      initial={{ strokeDashoffset: 452.4 }}
                      animate={{ 
                         strokeDashoffset: 452.4 - (452.4 * (timeLeft / totalWaitTime)),
                         transition: { duration: 1, ease: "linear" }
                      }}
                      className={cn(
                         "transition-colors duration-500",
                         isCoolingDown ? "text-red-500 hud-pulse-red" : timeLeft < 10 ? "text-amber-400" : "text-[#00F2FF] hud-text-glow"
                      )}
                    />
                  </svg>
                  <div className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center font-mono",
                    timeLeft < 10 && !isCoolingDown && "animate-pulse"
                  )}>
                    <span className={cn(
                       "text-3xl font-black hud-text-glow",
                       isCoolingDown ? "text-red-500" : timeLeft < 10 ? "text-amber-400" : "text-[#00F2FF]"
                    )}>
                       {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-[#A0D2EB]/30 uppercase tracking-[0.2em] mt-1">SEC_STATUS</span>
                  </div>
                </div>
                
                <h4 className={cn(
                  "uppercase text-[11px] font-mono font-black tracking-[0.4em] transition-all",
                  isCoolingDown ? "text-red-500 animate-pulse" : pacing && timeLeft < 10 ? "text-amber-400 animate-bounce" : "text-[#00F2FF]"
                )}>
                  {isCoolingDown ? 'CRITICAL_COOLDOWN_ACTIVE' : timeLeft < 10 ? 'UPLINK_IMMINENT' : 'MASKING_USER_PATTERN'}
                </h4>
                
                {(!autoPilot || isCoolingDown) && (
                   <button 
                     onClick={() => { setTimeLeft(0); setPacing(false); setIsCoolingDown(false); }}
                     className="mt-8 text-[9px] font-mono text-[#A0D2EB]/30 hover:text-[#00F2FF] uppercase font-black border border-[#00F2FF]/20 px-6 py-2.5 hover:bg-[#00F2FF]/10 transition-all rounded-full backdrop-blur-xl"
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
