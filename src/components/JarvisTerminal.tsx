import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Mic, Send, X, Cpu, Activity } from 'lucide-react';
import { playSound } from '../lib/audio';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'model';
  parts: string;
}

interface JarvisTerminalProps {
  onClose: () => void;
  context?: string;
  jarvisSpeak: (text: string) => void;
}

export const JarvisTerminal: React.FC<JarvisTerminalProps> = ({ onClose, context, jarvisSpeak }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { role: 'user', parts: text };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    
    // Mock Jarvis logic - Tactical Hub
    setTimeout(() => {
      let resp = "";
      const lower = text.toLowerCase();
      
      if (lower.includes('status') || lower.includes('report')) {
        resp = "Sir, all systems are operational. Outreach queue is stabilized and message vectors are calibrated.";
      } else if (lower.includes('goal') || lower.includes('target')) {
        resp = "Current mission parameters are loaded. We are maintaining trajectory towards our daily acquisition targets.";
      } else if (lower.includes('hello') || lower.includes('hi')) {
        resp = "Greetings, Sir. HUD is active. How shall we proceed with today's outreach cycle?";
      } else if (lower.includes('who are you')) {
        resp = "I am J.A.R.V.I.S., your tactical strategy interface for Jaeger Media operations. My objective is your market dominance.";
      } else {
        resp = "Understood, Sir. I'm processing that directive. We'll adjust the strategy heuristics accordingly.";
      }

      const jarvisMsg: Message = { role: 'model', parts: resp };
      setHistory(prev => [...prev, jarvisMsg]);
      jarvisSpeak(resp);
      setIsTyping(false);
    }, 800);
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      jarvisSpeak("Sir, your browser does not support audio input heuristics.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setIsListening(true);
      playSound('scan');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl"
    >
      <div className="w-full max-w-2xl h-[650px] bg-black/40 border border-[#00F2FF]/30 hud-card flex flex-col relative overflow-hidden rounded-[3rem] shadow-[0_0_50px_rgba(0,242,255,0.15)] backdrop-blur-2xl">
        <div className="hud-scanning opacity-10 pointer-events-none" />
        
        {/* Header */}
        <div className="p-6 border-b border-[#00F2FF]/20 flex items-center justify-between bg-[#00F2FF]/5">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-[#00F2FF]/10 rounded-full border border-[#00F2FF]/30">
              <Cpu className="w-5 h-5 text-[#00F2FF] animate-pulse" />
            </div>
            <div>
              <h2 className="font-mono font-black text-[#00F2FF] tracking-[0.2em] text-xs">JARVIS_STRATEGIC_CONSULT</h2>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-ping" />
                <span className="text-[8px] text-[#A0D2EB]/30 uppercase font-mono">Core_Status: Ready</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#A0D2EB]/40 hover:text-white transition-all hover:bg-white/5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat History */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs"
        >
          {history.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-[#A0D2EB]/20 text-center uppercase tracking-[0.2em]">
              <Activity className="w-12 h-12 mb-4 animate-pulse" />
              <p>System Idle... Awaiting Strategic Directive</p>
            </div>
          )}
          {history.map((msg, i) => (
            <div key={i} className={cn(
              "flex flex-col gap-2",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <span className="text-[10px] opacity-40 uppercase tracking-widest">
                {msg.role === 'user' ? 'Ronan' : 'JARVIS'}
              </span>
              <div className={cn(
                "max-w-[85%] p-4 border backdrop-blur-md shadow-lg transition-all",
                msg.role === 'user' 
                  ? "bg-[#00F2FF]/10 border-[#00F2FF]/30 text-[#00F2FF] rounded-[1.5rem_1.5rem_0_1.5rem]" 
                  : "bg-white/5 border-white/10 text-[#A0D2EB] rounded-[1.5rem_1.5rem_1.5rem_0]"
              )}>
                {msg.parts}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2 items-center text-[#00F2FF] animate-pulse">
              <span className="text-[10px] uppercase tracking-widest">JARVIS Thinking...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-[#00F2FF]/20 bg-black/60 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleListening}
              className={cn(
                "p-4 border transition-all rounded-full backdrop-blur-xl",
                isListening 
                  ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse" 
                  : "border-[#00F2FF]/20 text-[#00F2FF] hover:border-[#00F2FF] hover:bg-[#00F2FF]/5"
              )}
            >
              <Mic className="w-5 h-5" />
            </button>
            <div className="flex-1 relative group">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="ENTER_COMMAND_OR_STRATEGY_QUERY..."
                className="w-full bg-black/40 border border-[#00F2FF]/10 rounded-full px-6 py-4 text-[#00F2FF] font-mono text-xs focus:outline-none focus:border-[#00F2FF] transition-all backdrop-blur-md group-hover:border-[#00F2FF]/30"
              />
            </div>
            <button 
              onClick={() => handleSend()}
              className="p-4 bg-[#00F2FF]/10 border border-[#00F2FF]/30 text-[#00F2FF] rounded-full hover:bg-[#00F2FF]/20 transition-all shadow-[0_0_15px_rgba(0,242,255,0.2)]"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
