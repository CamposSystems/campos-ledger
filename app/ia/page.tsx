"use client";

import React, { useState } from "react";
import { ArrowLeft, Bot, Sparkles, Send, Mic, UploadCloud, FileText } from "lucide-react";

const mockRouter = { push: (url: string) => console.log(`Routing to: ${url}`) };
let useRouterSafe: any;
try { useRouterSafe = require("next/navigation").useRouter; } catch { useRouterSafe = () => mockRouter; }

export default function IAPage() {
  const router = typeof useRouterSafe === 'function' ? useRouterSafe() : mockRouter;
  
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<{role: string, text: string}[]>([
    { role: 'ai', text: 'Bem-vindo ao Centro de Comando IA, Charles! Pode enviar-me mensagens de áudio com os seus gastos, ou fazer upload de um Extrato Bancário em PDF para eu conciliar automaticamente o "De/Para" das categorias.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    setChat(prev => [...prev, { role: 'user', text: input }]);
    const val = input;
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setChat(prev => [...prev, { role: 'ai', text: `Analisei a sua mensagem: "${val}". A minha engine Gemini já está treinada para sugerir categorias e apontar excessos orçamentais no Cloudflare.` }]);
      setIsTyping(false);
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="bg-zinc-950 border-b border-zinc-900 px-4 py-4 shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400"><Bot className="w-4 h-4"/></div>
             <div>
                <h1 className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">Consultor Camp.OS <Sparkles className="w-3 h-3"/></h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Motor NLP Ativado</p>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-4">
        
        {/* DRAG & DROP DE EXTRATO (MOCK) */}
        <div className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-3xl p-6 text-center cursor-pointer hover:bg-zinc-900 transition" onClick={() => alert("Upload de Extrato PDF ativado no Cloudflare Workers!")}>
           <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
           <p className="text-xs font-black uppercase tracking-widest text-zinc-300 mb-1">Conciliação Inteligente</p>
           <p className="text-[10px] text-zinc-500">Faça upload do extrato PDF do banco. A IA mapeia o De/Para automaticamente.</p>
        </div>

        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-zinc-900 text-zinc-300 rounded-tl-sm border border-zinc-800' : 'bg-indigo-600 text-white rounded-tr-sm shadow-lg'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
             <div className="p-4 rounded-2xl bg-zinc-900 text-zinc-500 rounded-tl-sm flex gap-1 border border-zinc-800">
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce delay-200"></span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-950 border-t border-zinc-900 shrink-0 max-w-md mx-auto w-full pb-8">
        <form onSubmit={handleSend} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-colors">
          <button type="button" className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Falar Lançamento">
            <Mic className="w-4 h-4" />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva o gasto..."
            className="flex-1 bg-transparent border-none text-sm text-white px-2 outline-none"
          />
          <button type="submit" disabled={!input.trim() || isTyping} className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}