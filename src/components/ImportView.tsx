import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { FileUp, Clipboard, LayoutList, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { personalizeMessage } from '../services/geminiService';
import { Template } from '../types';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  const formatZimbabweNumber = (phone: string) => {
    let cleaned = phone.replace(/[^\d]/g, ''); // Keep only digits
    
    // Remove leading 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // If it's just the number (e.g. 772...), add +263
    if (cleaned.startsWith('7') && (cleaned.length === 9)) {
      return `+263${cleaned}`;
    }
    
    // If it starts with 263 but no +, add it
    if (cleaned.startsWith('263')) {
      return `+${cleaned}`;
    }

    // Default: if it's long enough, assume it's valid but needs +263 if not present
    return cleaned.length >= 7 && !cleaned.startsWith('263') ? `+263${cleaned}` : `+${cleaned}`;
  };

  const handleImport = async () => {
    if (!user || !bulkText.trim()) return;
    setIsProcessing(true);
    setStatusText('Analyzing contact list...');

    // Split by new line, then comma or tab
    const lines = bulkText.split('\n').filter(l => l.trim());
    const seenNumbers = new Set<string>();
    const newContacts = [];

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      // Handle "Just Phone Number" vs "Business, Phone, Name, Notes"
      let businessName = '';
      let phoneNumber = '';
      let contactName = '';
      let notes = '';

      if (parts.length === 1) {
        // Just a number
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
          status: 'New',
          ownerId: user.uid,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setStatusText(`Found ${newContacts.length} valid contacts. Processing drafts...`);

    // Fetch available templates to rotate
    const templatePath = 'templates';
    let templates: Template[] = [];
    try {
      const templatesSnap = await getDocs(query(collection(db, templatePath), where('ownerId', '==', user.uid)));
      templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Template));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, templatePath);
    }

    if (templates.length === 0) {
       // Create a default one if none exist
       const defaultTempContent = "Hey {business_name}, I saw you are in the {niche} space. Would you be open to a quick chat about our services?";
       try {
         const defaultTemp = await addDoc(collection(db, 'templates'), {
           name: 'Default Outreach',
           content: defaultTempContent,
           ownerId: user.uid
         });
         templates.push({ id: defaultTemp.id, name: 'Default Outreach', content: defaultTempContent, ownerId: user.uid });
       } catch (error) {
         handleFirestoreError(error, OperationType.CREATE, 'templates');
       }
    }

    let count = 0;
    const contactPath = 'contacts';
    for (const contact of newContacts) {
      const template = templates[count % templates.length];
      setStatusText(`Personalizing [${count + 1}/${newContacts.length}]: ${contact.businessName}`);
      
      const draft = await personalizeMessage(
        template.content,
        contact.businessName,
        contact.contactName,
        contact.niche,
        contact.notes
      );

      try {
        await addDoc(collection(db, contactPath), {
          ...contact,
          draftedMessage: draft,
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Batch Loader</h1>
        <p className="text-zinc-500 text-sm">Bulk paste contacts and let AI generate personalized openers instantly.</p>
      </div>

      <div className="space-y-8">
        <div className="bg-[#121212] border border-white/5 p-8 rounded-3xl space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-3">Niche Category (e.g. Real Estate)</label>
            <input 
              type="text" 
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Real Estate"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-3">Bulk Data Paste</label>
            <textarea 
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Business Name, Phone Number, Contact Name, Notes..."
              rows={10}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 transition-colors font-mono text-xs placeholder:text-zinc-700"
            />
            <p className="mt-3 text-[10px] text-zinc-600 italic">
              FORMAT: Business Name, Phone, Contact Name, Notes (Comma or Tab separated)
            </p>
          </div>

          {!isProcessing ? (
            <button 
              onClick={handleImport}
              disabled={!bulkText.trim()}
              className="w-full py-4 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Zap className="w-5 h-5 fill-black" />
              Process & Personalize
            </button>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-end mb-2">
                 <span className="text-xs font-mono text-purple-400 animate-pulse">{statusText}</span>
                 <span className="text-xs font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl flex gap-4">
            <div className="p-3 bg-purple-900/20 rounded-lg shrink-0">
               <RotateCcw className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Auto-Rotate</h4>
              <p className="text-xs text-zinc-500">System automatically cycles through your active message templates to avoid spam patterns.</p>
            </div>
          </div>
          <div className="p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl flex gap-4">
            <div className="p-3 bg-green-900/20 rounded-lg shrink-0">
               <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-1">Zimbabwe Format</h4>
              <p className="text-xs text-zinc-500">Phone numbers are automatically cleaned and reformatted to +263 standard.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
