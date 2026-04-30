import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthProvider';
import { Contact, ContactStatus } from '../types';
import { Search, Filter, MoreHorizontal, Trash2, Calendar, MessageCircle, ExternalLink, ChevronDown, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

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

export const ContactList: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ContactStatus | 'All'>('All');
  const [filterNiche, setFilterNiche] = useState<string | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const niches = Array.from(new Set(contacts.map(c => c.niche || 'General')));

  const fetchContacts = async () => {
    if (!user) return;
    setLoading(true);
    const path = 'contacts';
    try {
      const q = query(
        collection(db, path), 
        where('ownerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setContacts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Contact)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.phoneNumber.includes(searchTerm) ||
                          (c.contactName && c.contactName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesNiche = filterNiche === 'All' || c.niche === filterNiche;
    return matchesSearch && matchesStatus && matchesNiche;
  });

  const exportToCSV = (contactsToExport: Contact[]) => {
    const headers = ['Business Name', 'Contact Name', 'Phone Number', 'Niche', 'Status', 'Notes', 'Created At'];
    const rows = contactsToExport.map(c => [
      c.businessName,
      c.contactName || '',
      c.phoneNumber,
      c.niche || '',
      c.status,
      (c.notes || '').replace(/\n/g, ' '),
      c.createdAt
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(String).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `jaeger_contacts_${filterNiche.toLowerCase().replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateContactStatus = async (id: string, status: ContactStatus) => {
    const path = `contacts/${id}`;
    try {
      await updateDoc(doc(db, 'contacts', id), { status });
      fetchContacts();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Eliminate record?')) return;
    const path = `contacts/${id}`;
    try {
      await deleteDoc(doc(db, 'contacts', id));
      fetchContacts();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const getStatusColor = (status: ContactStatus) => {
    switch (status) {
      case 'New': return 'text-zinc-500 bg-white/5 border-white/5';
      case 'Opened': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Contacted': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Replied': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Follow Up': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Closed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Not Interested': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-zinc-500';
    }
  };

  if (loading) return <div className="text-zinc-500 font-mono">RETRIEVING_DATABASE_INDEX...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Lead Database</h1>
          <p className="text-zinc-500 text-sm">Managing {contacts.length} total outreach prospects.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
             <input 
               type="text" 
               placeholder="Search contacts..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-purple-500 outline-none w-full md:w-64"
             />
           </div>
           
           <select 
             value={filterNiche}
             onChange={(e) => setFilterNiche(e.target.value)}
             className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-purple-500 outline-none uppercase tracking-widest font-bold"
           >
             <option value="All">All Niches</option>
             {niches.map(n => <option key={n} value={n}>{n}</option>)}
           </select>

           <select 
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value as any)}
             className="bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-purple-500 outline-none uppercase tracking-widest font-bold"
           >
             <option value="All">All Statuses</option>
             <option value="New">New</option>
             <option value="Contacted">Contacted</option>
             <option value="Replied">Replied</option>
             <option value="Follow Up">Follow Up</option>
             <option value="Closed">Closed</option>
             <option value="Not Interested">Not Interested</option>
           </select>

           <button 
             onClick={() => exportToCSV(filteredContacts)}
             className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
           >
             <Download className="w-4 h-4" />
             Export
           </button>
        </div>
      </div>

      <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-white/5">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Business Name</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Number</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Niche</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500">Last Active</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredContacts.map((contact) => (
                <React.Fragment key={contact.id}>
                  <tr 
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
                  >
                    <td className="px-6 py-4 font-bold tracking-tight">{contact.businessName}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-zinc-400">{contact.phoneNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{contact.niche || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                        getStatusColor(contact.status)
                      )}>
                        {statusLabel(contact.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {contact.lastContactedAt ? format(new Date(contact.lastContactedAt), 'MMM dd, HH:mm') : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 transition-all">
                        <ChevronDown className={cn("w-4 h-4 transition-transform", expandedId === contact.id && "rotate-180")} />
                      </button>
                    </td>
                  </tr>
                  
                  <AnimatePresence>
                    {expandedId === contact.id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-white/[0.01]"
                      >
                        <td colSpan={6} className="px-8 py-6">
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                             <div className="space-y-4">
                               <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Contact Intel</h4>
                               <div className="space-y-1">
                                 <p className="text-sm font-medium">Head of Operations: <span className="text-white">{contact.contactName || 'Unknown'}</span></p>
                                 <p className="text-xs text-zinc-500">Imported: {format(new Date(contact.createdAt), 'MMMM dd, yyyy')}</p>
                                 {contact.followUpDate && (
                                   <p className="text-xs text-amber-500 font-bold">Follow-up set for: {format(new Date(contact.followUpDate), 'MMM dd, yyyy')}</p>
                                 )}
                               </div>
                               <div className="pt-2">
                                  <label className="block text-[10px] uppercase font-bold text-zinc-700 mb-2">Update Status</label>
                                  <div className="flex flex-wrap gap-2">
                                     {['Contacted', 'Replied', 'Follow Up', 'Closed', 'Not Interested'].map((s) => (
                                       <button 
                                         key={s}
                                         onClick={(e) => { 
                                           e.stopPropagation(); 
                                           if (s === 'Follow Up') {
                                             const days = prompt('In how many days? (default 3)', '3');
                                             const date = new Date();
                                             date.setDate(date.getDate() + parseInt(days || '3'));
                                             updateDoc(doc(db, 'contacts', contact.id), { 
                                               status: s,
                                               followUpDate: date.toISOString()
                                             }).then(() => fetchContacts());
                                           } else {
                                             updateContactStatus(contact.id, s as ContactStatus);
                                           }
                                         }}
                                         className={cn(
                                           "px-2 py-1 rounded text-[10px] font-bold uppercase border transition-all",
                                           contact.status === s ? "border-purple-500 text-purple-400 bg-purple-500/10" : "border-white/5 text-zinc-600 hover:text-white"
                                         )}
                                       >
                                         {s}
                                       </button>
                                     ))}
                                  </div>
                               </div>
                             </div>

                             <div className="md:col-span-2 space-y-4">
                               <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Latest Drafted Response</h4>
                               <div className="bg-black/40 border border-white/5 p-4 rounded-xl text-xs text-zinc-400 italic leading-relaxed whitespace-pre-wrap">
                                 {contact.draftedMessage || "No draft message available."}
                               </div>
                               <div className="flex items-center gap-4 pt-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const msg = encodeURIComponent(contact.draftedMessage || '');
                                      window.open(`https://wa.me/${contact.phoneNumber.replace('+', '')}?text=${msg}`, '_blank');
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold rounded-lg text-xs hover:bg-zinc-200 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Recall in WhatsApp
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); deleteContact(contact.id); }}
                                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Wipe Record
                                  </button>
                               </div>
                             </div>
                           </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}

              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-zinc-600 uppercase tracking-widest text-xs font-bold font-mono">
                     NO_RECORDS_FOUND_IN_BUFFER
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const statusLabel = (status: ContactStatus) => {
  switch (status) {
    case 'New': return 'NEW_ASSET';
    case 'Opened': return 'SYSTEM_OPEN';
    case 'Contacted': return 'OUTREACH_PENDING';
    case 'Replied': return 'SIGNAL_RECEIVED';
    case 'Follow Up': return 'RE_ENGAGE';
    case 'Closed': return 'CONVERTED';
    case 'Not Interested': return 'DISCONNECT';
    default: return status;
  }
};
