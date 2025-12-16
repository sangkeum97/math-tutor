import React, { useEffect, useRef } from 'react';
import { ChatMessage, GeminiLiveStatus } from '../types';
import { Send, Sparkles, Mic, MicOff, Volume2, XCircle, BrainCircuit } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  liveStatus: GeminiLiveStatus;
  onToggleLive: () => void;
  isMicOn: boolean;
  toggleMic: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  inputValue,
  setInputValue,
  onSend,
  isLoading,
  liveStatus,
  onToggleLive,
  isMicOn,
  toggleMic
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-96 shadow-xl z-40">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <BrainCircuit className="text-indigo-600" size={20} />
          </div>
          <h2 className="font-bold text-slate-700">AI Tutor Assistant</h2>
        </div>
      </div>

      {/* Live Mode Controls */}
      <div className="p-4 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Live Co-Pilot</span>
            {liveStatus === 'connected' && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Live
                </span>
            )}
        </div>
        
        {liveStatus === 'disconnected' || liveStatus === 'error' || liveStatus === 'connecting' ? (
             <button
             onClick={onToggleLive}
             disabled={liveStatus === 'connecting'}
             className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-medium transition-all shadow-sm shadow-indigo-200 disabled:opacity-70"
           >
             <Mic size={18} />
             {liveStatus === 'connecting' ? 'Connecting...' : 'Start Live Session'}
           </button>
        ) : (
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleMic}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                        isMicOn ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-red-50 text-red-600 border border-red-100'
                    }`}
                >
                    {isMicOn ? <><Mic size={18}/> Mute Mic</> : <><MicOff size={18}/> Unmute</>}
                </button>
                <button
                    onClick={onToggleLive}
                    className="flex items-center justify-center p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"
                    title="End Session"
                >
                    <XCircle size={20} />
                </button>
            </div>
        )}
        {liveStatus === 'connected' && (
             <p className="text-xs text-indigo-600 mt-2 text-center">
                 The AI can see your board and hear you.
             </p>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-10">
            <Sparkles className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">Ask me to solve a problem on the board or explain a concept!</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-br-none'
                  : msg.isError 
                    ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-none'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
              }`}
            >
              {msg.text}
            </div>
            {msg.role === 'model' && !msg.isError && (
                 <span className="text-[10px] text-slate-400 mt-1 ml-1">Gemini</span>
            )}
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start">
                 <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                    <div className="flex gap-1">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex gap-2 relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about the math problem..."
            className="w-full resize-none border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 bg-slate-50 transition-all max-h-32"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
            AI can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;