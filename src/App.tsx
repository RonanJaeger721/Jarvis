/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthProvider';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { QueueView } from './components/QueueView';
import { ContactList } from './components/ContactList';
import { ImportView } from './components/ImportView';
import { TemplateList } from './components/TemplateList';
import { LogIn, Zap } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const { user, loading, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'contacts' | 'import' | 'templates'>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000508] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="hud-scanning opacity-20" />
        
        {/* Background Rings */}
        <div className="absolute w-[600px] h-[600px] opacity-10">
           <div className="hud-ring-outer inset-0" />
           <div className="hud-ring-inner inset-10" />
           <div className="hud-ring-outer inset-20 animate-[spin_30s_linear_infinite_reverse]" />
        </div>

        <div className="relative mb-12">
           <Zap className="w-16 h-16 text-[#00F2FF] hud-text-glow animate-pulse" />
           <div className="absolute -inset-6 border border-[#00F2FF]/40 animate-[spin_5s_linear_infinite]" />
           <div className="absolute -inset-10 border border-dashed border-[#00F2FF]/20 animate-[spin_10s_linear_infinite_reverse]" />
        </div>
        <motion.div 
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[#00F2FF] font-mono tracking-[0.6em] uppercase text-[11px] font-black relative"
        >
          <span className="absolute -left-12 top-1/2 -translate-y-1/2 w-8 h-[1px] bg-[#00F2FF]/40" />
          INITIALIZING_JAEGER_OS
          <span className="absolute -right-12 top-1/2 -translate-y-1/2 w-8 h-[1px] bg-[#00F2FF]/40" />
        </motion.div>
        
        <div className="mt-8 font-mono text-[8px] text-[#00F2FF]/30 tracking-widest uppercase">
          Neural_Link: Established / Scanning_Frequency: 42.8 THz
        </div>
      </div>
    );
  }

  // Removed strict user check to allow "Guest" mode
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'queue': return <QueueView />;
      case 'contacts': return <ContactList />;
      case 'import': return <ImportView onComplete={() => setActiveTab('contacts')} />;
      case 'templates': return <TemplateList />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
