"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, CreditCard, Clock, Calendar, CheckCircle2, Bot, Sparkles, UploadCloud, PieChart, BarChart3, TrendingUp, AlertTriangle, FileText, ChevronRight } from "lucide-react";

let supabase: any;
let useRouterSafe: any;
const mockRouter = { push: (url: string) => console.log(`Routing to: ${url}`) };

try {
  const sb = require("@supabase/supabase-js");
  const nextNav = require("next/navigation");
  supabase = sb.createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
  useRouterSafe = nextNav.useRouter;
} catch (e) {
  useRouterSafe = () => mockRouter;
  supabase = { auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) };
}

export default function FaturasPage() {
  const router = typeof useRouterSafe === 'function' ? useRouterSafe() : mockRouter;
  const [cards, setCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("family_id").eq("id", session.user.id).single();
      if (profile?.family_id) {
        const [cardsRes, txRes, catRes] = await Promise.all([
           supabase.from("credit_cards").select("*").eq("family_id", profile.family_id),
           supabase.from("transactions").select("*").eq("family_id", profile.family_id).eq("payment_method", "credit"),
           supabase.from("categories").select("*").eq("family_id", profile.family_id)
        ]);
        if (cardsRes.data) setCards(cardsRes.data);
        if (txRes.data) setTransactions(txRes.data);
        if (catRes.data) setCategories(catRes.data);
      }
    }
    load();
  }, []);

  // --- MÁQUINA DE ANÁLISE E GRÁFICOS (KPIs) ---
  const analytics = useMemo(() => {
     let totalLimit = 0;
     let totalUsed = 0;
     const cardStats: Record<string, any> = {};
     
     cards.forEach(c => {
        totalLimit += Number(c.limit_amount);
        cardStats[c.id] = { ...c, used: 0, bestDay: c.closing_day };
     });

     const thisMonth = new Date().getMonth();
     let currentMonthFatura = 0;
     let nextMonthFatura = 0;

     const catSpend: Record<string, number> = {};

     transactions.forEach(tx => {
        const txVal = Number(tx.amount);
        if (cardStats[tx.credit_card_id]) {
           cardStats[tx.credit_card_id].used += txVal;
           totalUsed += txVal;
        }

        const txDate = new Date(tx.date);
        if (txDate.getMonth() === thisMonth) currentMonthFatura += txVal;
        else if (txDate.getMonth() === (thisMonth + 1) % 12) nextMonthFatura += txVal;

        const cId = tx.category_id || 'outros';
        catSpend[cId] = (catSpend[cId] || 0) + txVal;
     });

     const topCategories = Object.entries(catSpend)
        .map(([id, val]) => ({ cat: categories.find(c => c.id === id), val }))
        .sort((a, b) => b.val - a.val);

     return { totalLimit, totalUsed, cardStats, currentMonthFatura, nextMonthFatura, topCategories };
  }, [cards, transactions, categories]);

  // --- CONSULTOR IA DE EXTRATOS ---
  const aiInsights = useMemo(() => {
     const insights = [];
     if (analytics.totalLimit > 0) {
        const usage = (analytics.totalUsed / analytics.totalLimit) * 100;
        if (usage > 80) insights.push({ type: 'danger', text: `Risco de Crédito: Já comprometeu ${usage.toFixed(1)}% do seu limite global. O ideal para manter um bom Score é abaixo de 30%.`});
        else if (usage > 50) insights.push({ type: 'warning', text: `Atenção: Uso de crédito em ${usage.toFixed(1)}%. Prepare a liquidez na conta corrente para o vencimento destas faturas.`});
        else insights.push({ type: 'success', text: `Excelente! O seu uso de crédito (${usage.toFixed(1)}%) está num nível ótimo para a sua saúde financeira.`});
     }

     if (analytics.nextMonthFatura > analytics.currentMonthFatura && analytics.currentMonthFatura > 0) {
        insights.push({ type: 'warning', text: `Alerta Efeito Bola de Neve: A sua fatura projetada para o próximo mês já é maior que a atual devido aos parcelamentos acumulados.`});
     }

     const today = new Date().getDate();
     cards.forEach(c => {
        if (today === c.closing_day - 1 || today === c.closing_day) {
           insights.push({ type: 'info', text: `Dica Ninja: O cartão ${c.name} fecha hoje/amanhã. Concentre as compras nele após o fecho para ganhar até 40 dias de prazo!`});
        }
     });

     if (analytics.topCategories.length > 0) {
        const top = analytics.topCategories[0];
        insights.push({ type: 'info', text: `Análise Comportamental: A sua maior fuga de crédito é "${top.cat?.name || 'Outros'}" (R$ ${top.val.toFixed(2)}).`});
     }

     return insights;
  }, [analytics, cards]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <div>
            <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Inteligência & Extratos</p>
            <p className="text-sm font-bold text-white">Gestão Profissional de Cartões</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        {/* IA CONSULTOR DE EXTRATOS */}
        <section className="bg-indigo-900/20 border border-indigo-500/30 rounded-[2rem] p-6 relative overflow-hidden shadow-[0_0_40px_rgba(79,70,229,0.15)]">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
           <div className="flex items-center justify-between mb-5 relative z-10">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50">
                 <Bot className="w-5 h-5 text-indigo-400" />
               </div>
               <div>
                 <h3 className="text-sm font-black text-white uppercase tracking-wider">Consultor de Crédito</h3>
                 <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1">Lendo faturas <Sparkles className="w-3 h-3"/></p>
               </div>
             </div>
           </div>
           
           <div className="space-y-3 relative z-10">
              {aiInsights.length === 0 ? (
                 <p className="text-xs text-zinc-400">Aguardando dados de cartões para gerar insights de crédito.</p>
              ) : (
                 aiInsights.map((insight, i) => (
                    <div key={i} className={`p-4 rounded-2xl text-xs font-medium leading-relaxed border ${
                       insight.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                       insight.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200' :
                       insight.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' :
                       'bg-indigo-500/10 border-indigo-500/20 text-indigo-200'
                    }`}>
                       {insight.text}
                    </div>
                 ))
              )}
           </div>

           <div className="mt-5 relative z-10">
              <button 
                 onClick={() => setIsUploading(true)} 
                 className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-300 font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                 <UploadCloud className="w-4 h-4" /> Conciliar Extrato PDF / CSV
              </button>
           </div>
        </section>

        {/* DASHBOARD DE GRÁFICOS GLOBAIS DE CRÉDITO */}
        {cards.length > 0 && (
           <section className="grid grid-cols-2 gap-3">
              <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
                 <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><PieChart className="w-4 h-4"/> Limite Global Usado</h3>
                 <div className="flex items-end gap-5">
                    <div className="w-20 h-20 rounded-full border-[6px] border-zinc-800 relative flex items-center justify-center" style={{ background: `conic-gradient(#a855f7 ${analytics.totalLimit ? (analytics.totalUsed/analytics.totalLimit)*360 : 0}deg, transparent 0)` }}>
                       <div className="w-16 h-16 bg-zinc-950 rounded-full flex items-center justify-center">
                          <span className="text-xs font-black text-white">{analytics.totalLimit ? ((analytics.totalUsed/analytics.totalLimit)*100).toFixed(0) : 0}%</span>
                       </div>
                    </div>
                    <div className="flex-1 space-y-2">
                       <div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Utilizado</p>
                          <p className="text-sm font-black text-white">R$ {analytics.totalUsed.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                       </div>
                       <div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Disponível</p>
                          <p className="text-sm font-black text-emerald-400">R$ {(analytics.totalLimit - analytics.totalUsed).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between">
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2"><Calendar className="w-3 h-3 inline mr-1"/> Fatura Atual</p>
                 <p className="text-lg font-black text-white">R$ {analytics.currentMonthFatura.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between">
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2"><TrendingUp className="w-3 h-3 inline mr-1"/> Próximo Mês</p>
                 <p className="text-lg font-black text-yellow-500">R$ {analytics.nextMonthFatura.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
              </div>
           </section>
        )}

        {/* DETALHAMENTO DE CARTÕES */}
        <section className="space-y-4">
           <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
             <CreditCard className="w-4 h-4" /> Detalhamento por Cartão
           </h3>

        {cards.length === 0 ? (
           <p className="text-zinc-500 text-center text-sm">Nenhum cartão registado no sistema.</p>
        ) : cards.map(card => {
          const stats = analytics.cardStats[card.id];
          const limiteUsado = stats ? stats.used : 0;
          const limiteLivre = card.limit_amount - limiteUsado;
          const percUsed = card.limit_amount ? (limiteUsado / card.limit_amount) * 100 : 0;

          return (
            <div key={card.id} className="bg-gradient-to-tr from-zinc-900 to-zinc-800 border border-zinc-700 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none"><CreditCard className="w-40 h-40" /></div>
               
               <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                     <p className="text-xl font-black text-white">{card.name}</p>
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{card.brand}</p>
                  </div>
                  {card.logo_url && <img src={card.logo_url} className="w-12 h-12 rounded-lg object-cover bg-white" />}
               </div>

               <div className="space-y-2 mb-6 relative z-10">
                 <div className="flex justify-between text-xs font-bold">
                   <span className="text-red-400">Usado: R$ {limiteUsado.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                   <span className="text-emerald-400">Livre: R$ {limiteLivre.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                 </div>
                 <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                   <div className={`h-full transition-all duration-1000 ${percUsed > 80 ? 'bg-red-500' : percUsed > 50 ? 'bg-yellow-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(percUsed, 100)}%` }}></div>
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Limite Total: R$ {Number(card.limit_amount).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                 <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 text-center">
                   <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Fechamento</p>
                   <p className="text-sm font-bold text-white flex justify-center items-center gap-1"><Clock className="w-3 h-3 text-yellow-500"/> Dia {card.closing_day}</p>
                 </div>
                 <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 text-center">
                   <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Vencimento</p>
                   <p className="text-sm font-bold text-white flex justify-center items-center gap-1"><Calendar className="w-3 h-3 text-red-500"/> Dia {card.due_day}</p>
                 </div>
               </div>

               <div className="flex flex-col gap-2 relative z-10">
                  <button onClick={() => alert(`Conciliação ativada para ${card.name}. Selecione o PDF da fatura.`)} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl hover:bg-zinc-900 transition flex items-center justify-center gap-2">
                     <FileText className="w-4 h-4" /> Conferir De/Para (Extrato)
                  </button>
                  <button onClick={() => alert("Simulando visualização da fatura detalhada no Ledger...")} className="w-full bg-purple-500/20 text-purple-400 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-purple-500/30 transition">
                     Ver Lançamentos do Cartão
                  </button>
               </div>
            </div>
          )
        })}
        </section>
      </main>

      {/* Modal de Simulação de Upload de Extrato */}
      {isUploading && (
         <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-indigo-500/30 rounded-[2rem] p-8 max-w-sm w-full text-center">
               <Bot className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-bounce" />
               <h3 className="text-xl font-black text-white mb-2">Conciliador IA</h3>
               <p className="text-xs text-zinc-400 mb-6">Arraste o PDF do seu extrato bancário ou fatura do cartão. A IA irá ler o OCR e cruzar as despesas com o seu Ledger.</p>
               <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl p-8 mb-4 hover:bg-zinc-800 transition cursor-pointer" onClick={() => { alert("Upload efetuado! A IA começará o processamento na nuvem no próximo deploy."); setIsUploading(false); }}>
                  <UploadCloud className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Selecionar PDF / CSV</span>
               </div>
               <button onClick={() => setIsUploading(false)} className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-white">Cancelar Mapeamento</button>
            </div>
         </div>
      )}
    </div>
  );
}