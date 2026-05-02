import React from 'react';
import { LayoutDashboard, Users, Send, FilePlus, MessageSquare, LogOut, Zap, BarChart3, Map } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'queue' | 'contacts' | 'import' | 'templates' | 'tracking' | 'plan';
  setActiveTab: (tab: 'dashboard' | 'queue' | 'contacts' | 'import' | 'templates' | 'tracking' | 'plan') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Outreach', icon: Send },
    { id: 'tracking', label: 'Logs', icon: BarChart3 },
    { id: 'plan', label: 'Plan', icon: Map },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'import', label: 'Import', icon: FilePlus },
    { id: 'templates', label: 'Library', icon: MessageSquare },
  ] as const;

  return (
    <div className="min-h-screen bg-[#000508] text-[#A0D2EB] flex flex-col relative overflow-hidden selection:bg-[#00F2FF]/30">
      {/* Background HUD Elements */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,242,255,0.05)_0%,transparent_70%)]" />
        
        {/* Rotating HUD Rings */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 opacity-20">
           <div className="hud-ring-outer inset-0" />
           <div className="hud-ring-inner inset-4" />
        </div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 opacity-10">
           <div className="hud-ring-outer inset-0 animate-[spin_20s_linear_infinite]" />
           <div className="hud-ring-inner inset-8" />
        </div>

        <div className="absolute top-0 left-0 w-64 h-64 border-t border-l border-[#00F2FF]/30 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="absolute bottom-0 right-0 w-96 h-96 border-b border-r border-[#00F2FF]/20 translate-x-1/4 translate-y-1/4 rounded-full" />
      </div>

      {/* Floating Data Decorators */}
      <div className="fixed top-24 left-6 z-0 opacity-10 hidden xl:block font-mono text-[8px] space-y-1">
         <p>LOC_LAT: 51.5074</p>
         <p>LOC_LNG: 0.1278</p>
         <p>SYS_STAB: OK</p>
         <p>NEURAL_L: ACTIVE</p>
      </div>
      <div className="fixed bottom-24 right-6 z-0 opacity-10 hidden xl:block font-mono text-[8px] text-right space-y-1">
         <p>MARK_85_IDLE</p>
         <p>UPLINK_SECURE</p>
         <p>AUTH_TOKEN: VERIFIED</p>
         <p>JARVIS_CORE: READY</p>
      </div>

      {/* Top Header Navigation */}
      <header className="w-full border-b border-[#00F2FF]/10 bg-black/60 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 bg-[#00F2FF]/5 px-4 py-2 border border-[#00F2FF]/10 relative overflow-hidden rounded-full">
              <div className="hud-scanning" />
              <div className="w-8 h-8 border border-[#00F2FF] flex items-center justify-center relative rounded-full">
                <Zap className="w-4 h-4 text-[#00F2FF] hud-text-glow" />
              </div>
              <span className="font-mono font-black tracking-[0.2em] text-[#00F2FF] block text-sm">JAEGER</span>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2.5 transition-all text-[10px] font-mono font-bold uppercase tracking-[0.2em] relative group",
                    activeTab === item.id 
                      ? "text-[#00F2FF]" 
                      : "text-[#A0D2EB]/30 hover:text-[#00F2FF]"
                  )}
                >
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeNav"
                      className="absolute inset-x-0 bottom-[-17px] h-[2px] bg-[#00F2FF] shadow-[0_0_10px_rgba(0,242,255,0.8)]"
                    />
                  )}
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 border-l border-[#00F2FF]/10 font-mono">
              <div className="text-right">
                <p className="text-[10px] font-bold text-[#00F2FF] tracking-wider">{user?.displayName?.toUpperCase()}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                   <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[8px] text-[#A0D2EB]/30 uppercase">Neural_Link</span>
                </div>
              </div>
              <img 
                src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
                className="w-10 h-10 border border-[#00F2FF]/30 p-0.5 rounded-full" 
                alt="avatar"
              />
            </div>
            <button 
              onClick={logout}
              className="p-2.5 text-[#A0D2EB]/40 hover:text-red-500 transition-colors border border-[#00F2FF]/10 hover:border-red-500/20 rounded-full bg-black/40"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden pb-32 relative z-10">
        <div className="p-4 md:p-12 max-w-7xl mx-auto relative min-h-[calc(100vh-6rem)]">
          {/* Target Corners */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-[#00F2FF]/30 pointer-events-none" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-[#00F2FF]/30 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-[#00F2FF]/30 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-[#00F2FF]/30 pointer-events-none" />
          
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-6 left-4 right-4 z-50 bg-[#000508]/80 backdrop-blur-3xl border border-[#00F2FF]/20 flex justify-between p-1.5 rounded-[2rem] shadow-2xl px-3 group">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all relative",
              activeTab === item.id ? "text-[#00F2FF]" : "text-[#A0D2EB]/30"
            )}
          >
            <item.icon className={cn("w-4 h-4", activeTab === item.id && "hud-text-glow")} />
            <span className="text-[7px] font-black uppercase tracking-tighter mt-1">{item.label}</span>
            {activeTab === item.id && (
              <motion.div 
                layoutId="activeNavMobile"
                className="absolute inset-0 border border-[#00F2FF]/50 bg-[#00F2FF]/5 rounded-2xl -z-10"
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};
