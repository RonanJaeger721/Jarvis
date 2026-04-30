import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Mic, Send, X, Cpu, Activity } from 'lucide-react';
import { jarvisConsult } from '../services/geminiService';
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
    
    try {
      const resp = await jarvisConsult(text, history, context);
      const jarvisMsg: Message = { role: 'model', parts: resp };
      setHistory(prev => [...prev, jarvisMsg]);
      jarvisSpeak(resp);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl h-[600px] bg-black border border-[#00F2FF]/30 hud-card flex flex-col relative overflow-hidden">
        <div className="hud-scanning opacity-10 pointer-events-none" />
        
        {/* Header */}
        <div className="p-4 border-b border-[#00F2FF]/20 flex items-center justify-between bg-[#00F2FF]/5">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-[#00F2FF] animate-pulse" />
            <h2 className="font-mono font-black text-[#00F2FF] tracking-widest text-sm">JARVIS_STRATEGIC_CONSULT</h2>
          </div>
          <button onClick={onClose} className="text-[#A0D2EB]/40 hover:text-white transition-colors">
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
                "max-w-[80%] p-3 border",
                msg.role === 'user' 
                  ? "bg-[#00F2FF]/5 border-[#00F2FF]/20 text-[#00F2FF]" 
                  : "bg-white/5 border-white/10 text-[#A0D2EB]"
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
        <div className="p-4 border-t border-[#00F2FF]/20 bg-black/40">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleListening}
              className={cn(
                "p-3 border transition-all",
                isListening ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_red]" : "border-[#00F2FF]/20 text-[#00F2FF] hover:border-[#00F2FF]"
              )}
            >
              <Mic className="w-5 h-5" />
            </button>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="ENTER_COMMAND_OR_STRATEGY_QUERY..."
              className="flex-1 bg-transparent border-b border-[#00F2FF]/20 py-2 text-[#00F2FF] font-mono text-sm focus:outline-none focus:border-[#00F2FF] transition-colors"
            />
            <button 
              onClick={() => handleSend()}
              className="p-3 border border-[#00F2FF]/20 text-[#00F2FF] hover:border-[#00F2FF] transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
