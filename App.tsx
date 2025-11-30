import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_LANGUAGES } from './constants';
import { useLiveTranslator } from './hooks/useLiveTranslator';
import { ConnectionState } from './types';
import Visualizer from './components/Visualizer';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
);
const StopIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

const App: React.FC = () => {
  const [targetLangCode, setTargetLangCode] = useState<string>('es');
  // Use env var directly as per instructions, but fallback to empty for safety
  const apiKey = process.env.API_KEY || ''; 
  
  const {
    connectionState,
    detectedLanguage,
    messages,
    inputAnalyser,
    outputAnalyser,
    connect,
    disconnect
  } = useLiveTranslator({
    apiKey,
    targetLanguage: SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode)?.name || 'Spanish'
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED: return 'bg-green-500';
      case ConnectionState.CONNECTING: return 'bg-yellow-500';
      case ConnectionState.ERROR: return 'bg-red-500';
      default: return 'bg-slate-600';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED: return 'Live';
      case ConnectionState.CONNECTING: return 'Connecting...';
      case ConnectionState.ERROR: return 'Error';
      default: return 'Ready';
    }
  };

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLangCode);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-900 border-x border-slate-800 shadow-2xl overflow-hidden relative">
      
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-slate-900/90 backdrop-blur-md z-10 border-b border-slate-800">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">LF</span>
           </div>
           <h1 className="font-semibold text-slate-100">LinguaFlow</h1>
        </div>
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`}></span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{getStatusText()}</span>
        </div>
      </header>

      {/* Main Display Area */}
      <div className="flex-none p-6 bg-gradient-to-b from-slate-900 to-slate-800 border-b border-slate-700/50">
         <div className="flex flex-col items-center gap-4">
            
            {/* Language Indicators */}
            <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
               <span className="text-slate-200">English</span>
               <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
               <div className="relative group">
                 <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-slate-200">
                    <span>{selectedLang?.flag}</span>
                    <span>{selectedLang?.name}</span>
                 </button>
                 
                 {/* Language Selector Dropdown (Absolute) */}
                 <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 rounded-xl border border-slate-700 shadow-xl opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 z-50">
                    <div className="p-1">
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => setTargetLangCode(lang.code)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${targetLangCode === lang.code ? 'bg-indigo-600/20 text-indigo-400' : 'hover:bg-slate-700 text-slate-300'}`}
                            >
                                <span>{lang.flag}</span>
                                <span>{lang.name}</span>
                            </button>
                        ))}
                    </div>
                 </div>
               </div>
            </div>

            {/* Live Detected Status */}
            <div className="text-center my-4 min-h-[4rem]">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Detected Language</p>
                <p className="text-2xl font-light text-indigo-300 animate-in fade-in slide-in-from-bottom-2 duration-300 key={detectedLanguage}">
                    {detectedLanguage}
                </p>
            </div>

            {/* Visualizers */}
            <div className="w-full flex flex-col gap-2">
                <Visualizer analyser={inputAnalyser} isActive={connectionState === ConnectionState.CONNECTED} color="#818cf8" />
                <Visualizer analyser={outputAnalyser} isActive={connectionState === ConnectionState.CONNECTED} color="#34d399" />
            </div>
         </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900" ref={chatContainerRef}>
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                <p className="text-sm">Start the session to begin translation.</p>
            </div>
        )}
        {messages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            // Simple heuristic: if we have user then model immediately after, group them visually
            // Ideally, we'd have a 'Turn' object, but flat list works for streaming
            return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                       isUser 
                       ? 'bg-slate-800 text-slate-200 rounded-br-none border border-slate-700' 
                       : 'bg-indigo-600 text-white rounded-bl-none shadow-lg shadow-indigo-900/20'
                   }`}>
                      {msg.text}
                   </div>
                   <span className="text-[10px] text-slate-500 mt-1 px-1">
                       {isUser ? 'Original' : 'Translated'}
                   </span>
                </div>
            )
        })}
      </div>

      {/* Controls */}
      <div className="p-6 bg-slate-900 border-t border-slate-800">
         <div className="flex items-center justify-center gap-6">
            <button className="p-3 rounded-full text-slate-400 hover:bg-slate-800 transition-colors">
                <SettingsIcon />
            </button>

            <button 
                onClick={toggleConnection}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 ${
                    connectionState === ConnectionState.CONNECTED 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/30' 
                    : connectionState === ConnectionState.CONNECTING
                    ? 'bg-yellow-500 text-white animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40'
                }`}
            >
                {connectionState === ConnectionState.CONNECTED ? <StopIcon /> : <MicIcon />}
            </button>
            
            {/* Spacer to balance settings icon visually if we add more buttons */}
             <div className="w-10"></div>
         </div>
      </div>
    </div>
  );
};

export default App;
