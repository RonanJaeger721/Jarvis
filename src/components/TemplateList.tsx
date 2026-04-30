import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Template } from '../types';
import { Plus, Trash2, Edit3, Save, X, MessageSquare, Info, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTemplateDraft } from '../services/geminiService';
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
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterNiche, setFilterNiche] = useState<string | 'All'>('All');
  
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newNiche, setNewNiche] = useState('');

  const [aiOffer, setAiOffer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);

  const niches = Array.from(new Set(templates.map(t => t.niche || 'General')));

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

  const handleAiGenerate = async () => {
    if (!newNiche.trim() || !aiOffer.trim()) return;
    setIsGenerating(true);
    try {
      const generated = await generateTemplateDraft(newNiche, aiOffer);
      if (generated) {
        setNewContent(generated);
        setShowAiGen(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    const effectiveUid = user?.uid || 'guest_sector_01';
    if (!newName.trim() || !newContent.trim()) return;

    if (editingId) {
      const path = `templates/${editingId}`;
      try {
        await updateDoc(doc(db, 'templates', editingId), {
          name: newName,
          content: newContent,
          niche: newNiche
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const path = 'templates';
      try {
        await addDoc(collection(db, path), {
          name: newName,
          content: newContent,
          niche: newNiche,
          ownerId: effectiveUid
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }

    setEditingId(null);
    setIsAdding(false);
    setNewName('');
    setNewContent('');
    setNewNiche('');
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This template will be permanently deleted.')) return;
    const path = `templates/${id}`;
    try {
      await deleteDoc(doc(db, 'templates', id));
      fetchTemplates();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  if (loading) return <div className="text-zinc-500 font-mono">LOADING_TEMPLATE_CACHE...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Message Blueprints</h1>
          <select 
            value={filterNiche}
            onChange={(e) => setFilterNiche(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs uppercase tracking-widest font-bold outline-none focus:border-purple-500"
          >
            <option value="All">All Niches</option>
            {niches.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {!isAdding && !editingId && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all text-sm uppercase tracking-widest"
          >
            <Plus className="w-4 h-4" />
            New Blueprint
          </button>
        )}
      </div>

      <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-xl flex items-start gap-4">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-200/60 leading-relaxed font-medium">
          <p className="mb-1">PRO TIP: Use <span className="text-white font-bold">{'{business_name}'}, {'{contact_name}'}, {'{niche}'}</span> as placeholders.</p>
          <p>The system will use Gemini to contextually weave these into human-sounding sentences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {(isAdding || editingId) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#121212] border-2 border-purple-600/30 p-8 rounded-3xl space-y-6 lg:col-span-2"
            >
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-bold uppercase tracking-widest text-purple-400">
                   {editingId ? 'Modify Blueprint' : 'Define New Blueprint'}
                 </h2>
                 <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Blueprint Name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none transition-colors font-bold"
                  />
                  <div className="flex gap-2">
                    <input 
                      value={newNiche} 
                      onChange={(e) => setNewNiche(e.target.value)}
                      placeholder="Niche (e.g. Plumbers)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-purple-500 outline-none transition-colors"
                    />
                    {!editingId && (
                      <button 
                        onClick={() => setShowAiGen(!showAiGen)}
                        className={cn(
                          "px-3 rounded-xl border transition-all flex items-center justify-center",
                          showAiGen ? "bg-purple-600 border-purple-500 text-white" : "bg-white/5 border-white/10 text-purple-400 hover:bg-white/10"
                        )}
                        title="Generate with AI"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {showAiGen && !editingId && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">AI Blueprint Engine</span>
                        </div>
                        <input 
                          value={aiOffer}
                          onChange={(e) => setAiOffer(e.target.value)}
                          placeholder="What are you offering? (e.g. 50% off web design for new businesses)"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none"
                        />
                        <button 
                          onClick={handleAiGenerate}
                          disabled={isGenerating || !newNiche || !aiOffer}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 transition-all"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Craft Message
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea 
                  value={newContent} 
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Example: Hey {contact_name}, I saw your work at {business_name}..."
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-purple-500 outline-none transition-colors font-serif italic text-lg"
                />
                <button 
                  onClick={handleSave}
                  className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-purple-700 transition-all shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Commit to System
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {templates.filter(t => filterNiche === 'All' || t.niche === filterNiche).map((t) => (
          <motion.div 
            key={t.id}
            layout
            className="bg-[#121212] border border-white/5 p-8 rounded-3xl hover:border-white/10 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-white/5 rounded-xl">
                  <MessageSquare className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { 
                      setEditingId(t.id); 
                      setNewName(t.name); 
                      setNewContent(t.content);
                      setNewNiche(t.niche || '');
                    }}
                    className="p-2 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(t.id)}
                    className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                 <h3 className="text-xl font-bold">{t.name}</h3>
                 {t.niche && (
                   <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest rounded border border-purple-500/30">
                     {t.niche}
                   </span>
                 )}
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed italic line-clamp-4">
                "{t.content}"
              </p>
            </div>
          </motion.div>
        ))}

        {!isAdding && templates.length === 0 && (
          <div className="lg:col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
             <p className="text-zinc-600 uppercase tracking-widest font-bold text-xs">No blueprints defined. System offline.</p>
          </div>
        )}
      </div>
    </div>
  );
};
