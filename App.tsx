
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Search, 
  Settings, 
  Globe,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import { Message, ChatSession } from './types';
import { gemini } from './geminiService';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY = 'gemini_chat_sessions';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize sessions
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessions, currentSessionId]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      setCurrentSessionId(filtered.length > 0 ? filtered[0].id : null);
      if (filtered.length === 0) createNewSession();
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // Update session locally first
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const newTitle = s.messages.length === 0 ? input.substring(0, 30) + (input.length > 30 ? '...' : '') : s.title;
        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, userMessage, assistantMessage],
          updatedAt: Date.now(),
        };
      }
      return s;
    }));

    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const stream = gemini.streamChat(currentSession?.messages || [], currentInput, useSearch);
      
      for await (const chunk of stream) {
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const updatedMessages = [...s.messages];
            const lastMsg = updatedMessages[updatedMessages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = chunk.text;
              
              // Handle grounding chunks
              if (chunk.groundingMetadata?.groundingChunks) {
                const links = chunk.groundingMetadata.groundingChunks
                  .filter((c: any) => c.web)
                  .map((c: any) => ({
                    title: c.web.title,
                    uri: c.web.uri
                  }));
                if (links.length > 0) {
                  lastMsg.groundingLinks = links;
                }
              }
            }
            return { ...s, messages: updatedMessages };
          }
          return s;
        }));
      }
    } catch (error) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const updatedMessages = [...s.messages];
          const lastMsg = updatedMessages[updatedMessages.length - 1];
          if (lastMsg) {
            lastMsg.content = "Sorry, I encountered an error. Please check your connection or API key.";
            lastMsg.isError = true;
          }
          return { ...s, messages: updatedMessages };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Mobile Backdrop */}
      {!isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-30 h-full w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-lg text-indigo-400">
            <Bot size={28} />
            <span>Gemini Pro</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-slate-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <button
          onClick={createNewSession}
          className="mx-4 mt-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus size={20} />
          New Chat
        </button>

        <div className="mt-6 flex-1 overflow-y-auto px-2 space-y-1">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`
                group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-colors
                ${currentSessionId === session.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
              `}
            >
              <MessageSquare size={18} className="shrink-0" />
              <span className="flex-1 truncate text-sm font-medium">{session.title}</span>
              <button
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded-md transition-all text-slate-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <div className="flex items-center gap-3 text-slate-400 text-sm">
             <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
               <User size={18} />
             </div>
             <span className="font-medium truncate">Guest User</span>
           </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h1 className="font-semibold text-slate-200 truncate">
              {currentSession?.title || 'Gemini Chat'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                <Globe size={16} className={useSearch ? 'text-indigo-400' : 'text-slate-500'} />
                <span className="text-xs font-medium text-slate-400">Web Search</span>
                <button
                  onClick={() => setUseSearch(!useSearch)}
                  className={`w-8 h-4 rounded-full relative transition-colors ${useSearch ? 'bg-indigo-600' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useSearch ? 'left-4.5' : 'left-0.5'}`} />
                </button>
             </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-0 py-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {currentSession?.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center pt-20">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-500 mb-6 border border-indigo-500/20">
                  <Bot size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome to Gemini Pro</h2>
                <p className="text-slate-400 max-w-sm">
                  The ultimate conversational AI experience. Ask me anything, solve complex problems, or browse the web together.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-2xl">
                   {['Explain quantum physics', 'Write a React component', 'Plan a travel itinerary', 'Summarize latest news'].map(prompt => (
                     <button 
                        key={prompt}
                        onClick={() => { setInput(prompt); }}
                        className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-left text-sm text-slate-300 transition-all hover:bg-slate-800"
                     >
                       "{prompt}"
                     </button>
                   ))}
                </div>
              </div>
            )}

            {currentSession?.messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <Bot size={18} className="text-white" />
                  </div>
                )}
                
                <div className={`
                  max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : msg.isError 
                      ? 'bg-red-500/10 border border-red-500/20 text-red-200'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }
                `}>
                  <div className="prose prose-invert prose-slate max-w-none text-sm leading-relaxed">
                    {msg.role === 'assistant' && !msg.content && isLoading ? (
                      <div className="flex gap-1 py-2">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                      </div>
                    ) : (
                      <ReactMarkdown 
                        components={{
                          code: ({node, inline, className, children, ...props}: any) => {
                            return (
                              <code className={`${className} bg-slate-800 rounded px-1.5 py-0.5 text-indigo-300 text-[13px]`} {...props}>
                                {children}
                              </code>
                            );
                          },
                          pre: ({children}: any) => (
                            <pre className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 my-4 overflow-x-auto">
                              {children}
                            </pre>
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>

                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                       <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                         <Search size={12} /> Sources
                       </p>
                       <div className="flex flex-wrap gap-2">
                         {msg.groundingLinks.map((link, i) => (
                           <a 
                             key={i} 
                             href={link.uri} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-400 px-3 py-1 rounded-full border border-slate-700 transition-colors inline-block max-w-[200px] truncate"
                           >
                             {link.title}
                           </a>
                         ))}
                       </div>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                    <User size={18} className="text-slate-400" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <footer className="p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800">
          <div className="max-w-3xl mx-auto relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 rounded-2xl py-4 pl-4 pr-16 resize-none min-h-[60px] max-h-[200px] text-slate-100 placeholder-slate-500 transition-all outline-none"
              rows={1}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button
                disabled={!input.trim() || isLoading}
                onClick={handleSend}
                className={`
                  p-2.5 rounded-xl transition-all flex items-center justify-center
                  ${!input.trim() || isLoading 
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95'}
                `}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-center text-slate-600 mt-3">
            Gemini Chat Pro may produce inaccurate information about people, places, or facts.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
