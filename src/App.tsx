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

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000508] flex items-center justify-center p-6 relative overflow-hidden selection:bg-[#00F2FF]/30">
        {/* Background Grids */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#00F2FF 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md hud-card p-12 relative z-10 text-center"
        >
          <div className="hud-scanning" />
          
          <div className="flex justify-center mb-10 relative">
            <div className="w-20 h-20 border border-[#00F2FF] flex items-center justify-center relative">
              <Zap className="w-10 h-10 text-[#00F2FF] hud-text-glow fill-[#00F2FF]/20" />
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#00F2FF]" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#00F2FF]" />
            </div>
          </div>
          
          <h1 className="text-4xl font-mono font-black text-[#00F2FF] mb-2 tracking-tighter hud-text-glow">JAEGER_HUD</h1>
          <p className="text-[#A0D2EB]/40 mb-12 text-[10px] font-mono uppercase tracking-[0.3em]">Cognitive Outreach Interface v2.0</p>
          
          <div className="relative group">
            <div className="absolute -inset-4 border border-[#00F2FF]/10 pointer-events-none group-hover:border-[#00F2FF]/30 transition-all" />
            <button
              onClick={login}
              className="hud-button w-full flex items-center justify-center gap-4 py-4"
            >
              <LogIn className="w-5 h-5" />
              AUTHORIZE_UPLINK
            </button>
          </div>
          
          <div className="mt-12 flex flex-col gap-2">
            <p className="text-[10px] text-[#A0D2EB]/20 font-mono uppercase tracking-widest leading-loose">
              [ SECURE_ACCESS_REQUIRED ]<br/>
              [ IDENTITY_VECTOR_VERIFICATION_PENDING ]
            </p>
          </div>
        </motion.div>

        {/* Decorative HUD Corners */}
        <div className="fixed top-12 left-12 w-24 h-24 border-t-2 border-l-2 border-[#00F2FF]/10" />
        <div className="fixed top-12 right-12 w-24 h-24 border-t-2 border-r-2 border-[#00F2FF]/10" />
        <div className="fixed bottom-12 left-12 w-24 h-24 border-b-2 border-l-2 border-[#00F2FF]/10" />
        <div className="fixed bottom-12 right-12 w-24 h-24 border-b-2 border-r-2 border-[#00F2FF]/10" />
      </div>
    );
  }

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
