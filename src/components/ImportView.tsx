import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { FileUp, Clipboard, LayoutList, CheckCircle2, RotateCcw, Zap, Globe, Image, Facebook } from 'lucide-react';
import { motion } from 'motion/react';
import { generateMessage } from '../services/messagingService';
import { Template, OfferType } from '../types';
import { cn, formatZimbabweNumber } from '../lib/utils';

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

interface ImportViewProps {
  onComplete: () => void;
}

export const ImportView: React.FC<ImportViewProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [bulkText, setBulkText] = useState('');
  const [niche, setNiche] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<OfferType>('Website');
  const [context, setContext] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const handleImport = async () => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    if (!bulkText.trim()) return;
    setIsProcessing(true);
    setStatusText('Analyzing contact list...');

    const lines = bulkText.split('\n').filter(l => l.trim());
    const seenNumbers = new Set<string>();
    
    // Fetch existing numbers for basic duplicate prevention
    try {
      const existingSnap = await getDocs(query(collection(db, 'contacts'), where('ownerId', '==', effectiveUid)));
      existingSnap.docs.forEach(d => seenNumbers.add(d.data().phoneNumber));
    } catch (err) {
      console.error("Duplicate check failed, proceeding with limited detection");
    }

    const newContacts = [];

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      let businessName = '';
      let phoneNumber = '';
      let contactName = '';
      let notes = '';

      if (parts.length === 1) {
        phoneNumber = formatZimbabweNumber(parts[0]);
        businessName = `Business (${phoneNumber})`;
      } else {
        businessName = parts[0];
        phoneNumber = formatZimbabweNumber(parts[1] || '');
        contactName = parts[2] || '';
        notes = parts[3] || '';
      }

      if (phoneNumber.length >= 10 && !seenNumbers.has(phoneNumber)) {
        seenNumbers.add(phoneNumber);
        newContacts.push({
          businessName: businessName || `Lead ${phoneNumber}`,
          phoneNumber,
          contactName,
          notes,
          niche: niche || 'General',
          offer: selectedOffer,
          context: context,
          status: 'New' as const,
          ownerId: effectiveUid,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (newContacts.length === 0) {
      setStatusText('ALERT: No new unique leads found in this batch.');
      setIsProcessing(false);
      return;
    }

    setStatusText(`Found ${newContacts.length} valid new contacts. Processing drafts...`);

    const templatePath = 'templates';
    let templates: Template[] = [];
    try {
      const templatesSnap = await getDocs(query(
        collection(db, templatePath), 
        where('ownerId', '==', effectiveUid),
        where('offerType', '==', selectedOffer)
      ));
      templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, templatePath);
    }

    if (templates.length === 0) {
       setStatusText('No specific blueprints found for this offer. Using generic fallback...');
       const fallbackSnap = await getDocs(query(
         collection(db, templatePath), 
         where('ownerId', '==', effectiveUid)
       ));
       templates = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
    }

    if (templates.length === 0) {
      setStatusText('ALERT: No blueprints available. Please restore defaults in Templates.');
      setIsProcessing(false);
      return;
    }

    let count = 0;
    const contactPath = 'contacts';
    for (const contact of newContacts) {
      const template = templates[count % templates.length];
      setStatusText(`Calibrating [${count + 1}/${newContacts.length}]: ${contact.businessName}`);
      
      const draftedMessage = generateMessage(template.content, {
        businessName: contact.businessName,
        contactName: contact.contactName,
        niche: contact.niche,
        offer: contact.offer,
        context: contact.context
      });

      try {
        await addDoc(collection(db, contactPath), {
          ...contact,
          draftedMessage,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, contactPath);
      }

      count++;
      setProgress((count / newContacts.length) * 100);
    }

    setIsProcessing(false);
    onComplete();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-tighter text-[#00F2FF] hud-text-glow">BATCH_LOADER.EXE</h1>
        <p className="text-[10px] text-[#A0D2EB]/40 uppercase tracking-[0.3em] mt-1">High-Volume Uplink Calibration</p>
      </div>

      <div className="space-y-8">
        <div className="hud-card border-[#00F2FF]/20 p-8 space-y-8 relative overflow-hidden">
          <div className="hud-scanning" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">1. Target Sector (Niche)</label>
              <input 
                type="text" 
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Borehole Drillers in Bulawayo"
                className="w-full bg-black/40 border border-[#00F2FF]/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#00F2FF] transition-all font-mono text-xs backdrop-blur-md shadow-inner"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">2. Tactical Offer</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Website', icon: Globe },
                  { id: 'Flyer', icon: Image },
                  { id: 'Facebook Ads', icon: Facebook }
                ].map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => setSelectedOffer(offer.id as OfferType)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all relative overflow-hidden group",
                      selectedOffer === offer.id 
                        ? "bg-[#00F2FF]/10 border-[#00F2FF] text-[#00F2FF] hud-text-glow shadow-[0_0_20px_rgba(0,242,255,0.2)]" 
                        : "bg-black/20 border-white/5 text-zinc-500 hover:border-white/10"
                    )}
                  >
                    <offer.icon className="w-5 h-5 relative z-10" />
                    <span className="text-[8px] font-bold uppercase tracking-tighter relative z-10">{offer.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">3. Tactical Context (Optional)</label>
            <textarea 
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. they don’t have a website, offering a clean website demo..."
              rows={2}
              className="w-full bg-black/40 border border-[#00F2FF]/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#00F2FF] transition-all font-mono text-xs backdrop-blur-md"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-[9px] uppercase tracking-widest font-black text-[#A0D2EB]/60">4. Acquisition Data (CSV/Tab)</label>
            <textarea 
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Business Name, Phone Number, Contact Name, Notes..."
              rows={6}
              className="w-full bg-black/40 border border-[#00F2FF]/10 rounded-2xl px-5 py-5 text-white focus:outline-none focus:border-[#00F2FF] transition-all font-mono text-[10px] placeholder:text-zinc-800 backdrop-blur-md"
            />
            <div className="flex justify-between items-center text-[8px] text-zinc-600 uppercase tracking-widest">
              <span>FORMAT: NAME, PHONE, CONTACT, NOTES</span>
              <span className="text-[#00F2FF]/40">Input sanitized: {bulkText.split('\n').filter(l => l.trim()).length} Leads</span>
            </div>
          </div>

          {!isProcessing ? (
            <button 
              onClick={handleImport}
              disabled={!bulkText.trim()}
              className="w-full py-5 bg-[#00F2FF] text-black font-black uppercase tracking-[0.3em] text-xs rounded-full flex items-center justify-center gap-3 hover:bg-[#00F2FF]/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed group shadow-[0_0_30px_rgba(0,242,255,0.3)]"
            >
              <Zap className="w-4 h-4 fill-black group-hover:scale-125 transition-transform" />
              INITIATE_UP_LINK_SEQUENCE
            </button>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-end mb-2">
                 <span className="text-[10px] font-mono text-[#00F2FF] animate-pulse uppercase tracking-widest">{statusText}</span>
                 <span className="text-[10px] font-mono text-[#A0D2EB]">{Math.round(progress)}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-[#00F2FF] shadow-[0_0_10px_#00F2FF]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 hud-card border-white/5 bg-black/20 flex gap-5 rounded-[2rem]">
            <div className="p-4 bg-[#00F2FF]/5 rounded-2xl shrink-0">
               <RotateCcw className="w-5 h-5 text-[#00F2FF] opacity-50" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0D2EB]/80 mb-2">Pattern Masking</h4>
              <p className="text-[9px] text-[#A0D2EB]/40 leading-relaxed uppercase tracking-wider">System automatically rotates patterns to ensure variability across networks.</p>
            </div>
          </div>
          <div className="p-8 hud-card border-white/5 bg-black/20 flex gap-5 rounded-[2rem]">
            <div className="p-4 bg-green-500/5 rounded-2xl shrink-0">
               <CheckCircle2 className="w-5 h-5 text-green-500 opacity-50" />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0D2EB]/80 mb-2">Region: ZIMBABWE</h4>
              <p className="text-[9px] text-[#A0D2EB]/40 leading-relaxed uppercase tracking-wider">International formats (+263) applied automatically during acquisition.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
