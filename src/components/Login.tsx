import React, { useState } from 'react';
import { useAuth } from '../lib/AuthProvider';
import { Zap, Lock, User, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(name, password);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#000508] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="hud-scanning opacity-20 pointer-events-none" />
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00F2FF]/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-[#00F2FF]/10 rounded-3xl border border-[#00F2FF]/30 mb-6 group">
            <Zap className="w-12 h-12 text-[#00F2FF] hud-text-glow group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
            Jaeger<span className="text-[#00F2FF]">_OS</span>
          </h1>
          <p className="text-[10px] text-[#A0D2EB]/40 uppercase tracking-[0.5em] mt-2 font-mono">Tactical Outreach & Logistics / v4.2.0</p>
        </div>

        <form onSubmit={handleSubmit} className="hud-card border-[#00F2FF]/20 p-10 space-y-6 bg-black/60 backdrop-blur-2xl rounded-[3rem]">
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00F2FF]/40" />
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="OPERATOR_ID"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-14 py-5 text-sm font-mono text-white placeholder:text-white/10 outline-none focus:border-[#00F2FF]/50 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00F2FF]/40" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SECTOR_KEY"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-14 py-5 text-sm font-mono text-white placeholder:text-white/10 outline-none focus:border-[#00F2FF]/50 transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-mono tracking-widest uppercase">Access Denied: Invalid Credentials</span>
            </motion.div>
          )}

          <button 
            type="submit"
            className="w-full bg-[#00F2FF] text-black font-black uppercase tracking-[0.3em] py-5 rounded-2xl text-xs hover:bg-[#00F2FF]/80 transition-all shadow-[0_0_30px_rgba(0,242,255,0.2)] active:scale-95"
          >
            INITIATE_SESSION
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[8px] font-mono text-[#A0D2EB]/20 uppercase tracking-[0.4em]">
            Authorized Personnel Only / Neural Uplink Required
          </p>
        </div>
      </motion.div>
    </div>
  );
};
