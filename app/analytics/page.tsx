"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, Download, Bot, Sparkles, TrendingUp, TrendingDown, 
  PieChart, BarChart3, Activity, Target, Clock, AlertTriangle, 
  CreditCard, Banknote, CalendarDays, Zap, ShieldAlert, Wallet
} from "lucide-react";

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
  supabase = {
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }), gte: () => ({ lte: () => ({ data: [] }) }) }) }) })
  };
}

export default function AnalyticsProPage() {
  const router = typeof useRouterSafe === 'function' ? useRouterSafe() : mockRouter;
  
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // Para disparar animações CSS
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setUserProfile(profile);

      if (profile?.family_id) {
        const familyId = profile.family_id;
        
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const [txRes, allTxRes, accRes, cardRes, catRes] = await Promise.all([
          supabase.from("transactions").select("*").eq("family_id", familyId).gte("date", startOfMonth).lte("date", endOfMonth),
          supabase.from("transactions").select("*").eq("family_id", familyId).eq("status", "completed"),
          supabase.from("accounts").select("*").eq("family_id", familyId),
          supabase.from("credit_cards").select("*").eq("family_id", familyId),
          supabase.from("categories").select("*").eq("family_id", familyId)
        ]);

        if (txRes.data) setTransactions(txRes.data);
        if (allTxRes.data) setAllTransactions(allTxRes.data);
        if (accRes.data) setAccounts(accRes.data);
        if (cardRes.data) setCreditCards(cardRes.data);
        if (catRes.data) setCategories(catRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setTimeout(() => setMounted(true), 100); // Dispara animações
    }
  }

  // ==========================================
  // MOTOR DE CÁLCULO DE 15+ MÉTRICAS E GRÁFICOS
  // ==========================================
  const metrics = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const incomes = transactions.filter(t => t.type === 'income');
    
    const totalExp = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalInc = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Saldo Real Global
    let realBalance = accounts.reduce((acc, curr) => acc + (Number(curr.initial_balance) || 0), 0);
    allTransactions.forEach(t => {
      if (t.payment_method === 'credit') return;
      if (t.type === 'income') realBalance += Number(t.amount);
      if (t.type === 'expense') realBalance -= Number(t.amount);
    });

    // 1. Taxa de Poupança
    const savingsRate = totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : 0;

    // 2. Fixo vs Variável (Assumindo que is_essential na categoria = fixo)
    let fixedExp = 0; let varExp = 0;
    expenses.forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      if (cat?.is_essential) fixedExp += Number(t.amount);
      else varExp += Number(t.amount);
    });

    // 3. Regra 50/30/20 (Adaptado)
    const rule50 = totalInc * 0.50; // Essenciais ideais
    const rule30 = totalInc * 0.30; // Supérfluos ideais
    const rule20 = totalInc * 0.20; // Poupança ideal

    // 4. Métodos de Pagamento
    const methodTotals = { pix: 0, credit: 0, debit: 0, cash: 0 };
    expenses.forEach(t => {
      if (t.payment_method in methodTotals) methodTotals[t.payment_method as keyof typeof methodTotals] += Number(t.amount);
    });

    // 5. Dias da Semana
    const weekDays = [0, 0, 0, 0, 0, 0, 0]; // Dom a Sab
    expenses.forEach(t => {
      const day = new Date(t.date).getDay();
      weekDays[day] += Number(t.amount);
    });
    const maxDay = Math.max(...weekDays) || 1;

    // 6. Heatmap Diário (Mês de 31 dias)
    const heatmap = Array.from({ length: 31 }, (_, i) => 0);
    expenses.forEach(t => {
      const d = new Date(t.date).getDate() - 1;
      if (d >= 0 && d < 31) heatmap[d] += Number(t.amount);
    });
    const maxHeat = Math.max(...heatmap) || 1;

    // 7. Top Categorias
    const catMap: Record<string, number> = {};
    expenses.forEach(t => {
      const cId = t.category_id || 'outros';
      catMap[cId] = (catMap[cId] || 0) + Number(t.amount);
    });
    const topCats = Object.entries(catMap)
      .map(([id, val]) => ({ cat: categories.find(c => c.id === id), val }))
      .sort((a, b) => b.val - a.val);

    // 8. Custo Médio Diário
    const daysPassed = new Date().getDate() || 1;
    const dailyAvg = totalExp / daysPassed;

    // 9. Runway (Dias de Saldo Restante no ritmo atual)
    const runwayDays = dailyAvg > 0 ? Math.floor(realBalance / dailyAvg) : 999;

    // 10. Limite Global de Cartões
    const totalCreditLimit = creditCards.reduce((acc, c) => acc + Number(c.limit_amount), 0);
    const totalCreditUsed = methodTotals.credit;
    const creditUsagePerc = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;

    // 11. Maiores Transações Individuais
    const topTransactions = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);

    // 12. Projeção Faturas (Somando pendentes futuras de crédito)
    // Simplificando: vamos contar as parcelas futuras na tabela allTransactions
    const futureFaturas = { mes1: 0, mes2: 0, mes3: 0 };
    const currentMonth = new Date().getMonth();
    allTransactions.forEach(t => {
       if (t.payment_method === 'credit' && t.status === 'pending') {
          const m = new Date(t.date).getMonth();
          if (m === (currentMonth + 1) % 12) futureFaturas.mes1 += Number(t.amount);
          if (m === (currentMonth + 2) % 12) futureFaturas.mes2 += Number(t.amount);
          if (m === (currentMonth + 3) % 12) futureFaturas.mes3 += Number(t.amount);
       }
    });

    return {
      totalExp, totalInc, realBalance, savingsRate, 
      fixedExp, varExp, rule50, rule30, rule20,
      methodTotals, weekDays, maxDay, heatmap, maxHeat,
      topCats, dailyAvg, runwayDays, totalCreditLimit, totalCreditUsed, creditUsagePerc,
      topTransactions, futureFaturas
    };
  }, [transactions, allTransactions, accounts, creditCards, categories]);

  // ==========================================
  // IA CONSULTANT: GERAÇÃO DE INSIGHTS PROFUNDOS
  // ==========================================
  const aiInsights = useMemo(() => {
    const i = [];
    const m = metrics;

    // Análise de Sobrevivência (Runway)
    if (m.runwayDays < 15 && m.realBalance > 0) {
      i.push({ type: 'danger', icon: '🚨', title: 'Alerta de Liquidez', text: `Atenção: Ao ritmo de gasto de R$ ${m.dailyAvg.toFixed(0)}/dia, o seu saldo esgota-se em ${m.runwayDays} dias.`});
    } else if (m.runwayDays > 60) {
      i.push({ type: 'success', icon: '🛡️', title: 'Fundo de Emergência', text: `Segurança: Você tem caixa para suportar mais de ${m.runwayDays} dias com o seu padrão de custo atual.`});
    }

    // Análise de Custo Fixo
    const fixedRatio = m.totalExp > 0 ? (m.fixedExp / m.totalExp) * 100 : 0;
    if (fixedRatio > 60) {
      i.push({ type: 'warning', icon: '🏗️', title: 'Orçamento Engessado', text: `Custos Fixos representam ${fixedRatio.toFixed(0)}% das suas despesas. Tente renegociar contratos para ter mais liberdade.`});
    }

    // Análise de Risco de Crédito
    if (m.creditUsagePerc > 70) {
      i.push({ type: 'danger', icon: '💳', title: 'Risco de Endividamento', text: `Comprometeu ${m.creditUsagePerc.toFixed(0)}% do limite dos seus cartões de crédito. Evite novas compras parceladas.`});
    } else if (m.methodTotals.credit > m.realBalance) {
      i.push({ type: 'warning', icon: '⚠️', title: 'Alerta de Fatura', text: `A sua fatura de crédito gerada (R$ ${m.methodTotals.credit.toFixed(0)}) já é superior ao seu saldo em conta. Prepare capital.`});
    }

    // Análise de Categorias (Gargalos)
    if (m.topCats.length > 0) {
      const top1 = m.topCats[0];
      const top1Ratio = (top1.val / m.totalExp) * 100;
      if (top1Ratio > 35) {
        i.push({ type: 'info', icon: '🔍', title: 'Gargalo Identificado', text: `A categoria "${top1.cat?.name || 'Outros'}" está drenando ${top1Ratio.toFixed(0)}% do seu orçamento mensal.`});
      }
    }

    // Comportamento de Dias
    const weekendSpend = m.weekDays[0] + m.weekDays[6];
    const weekdaySpend = m.weekDays.reduce((a,b)=>a+b,0) - weekendSpend;
    if (weekendSpend > weekdaySpend) {
      i.push({ type: 'info', icon: '🎉', title: 'Padrão de Fim de Semana', text: `Você gasta mais nos fins de semana do que em todos os dias úteis somados. Controle os passeios.`});
    }

    if (i.length === 0) {
      i.push({ type: 'success', icon: '🤖', title: 'Saúde Perfeita', text: 'Os seus indicadores de crédito, saldo e despesas estão em harmonia. Continue o bom trabalho!' });
    }

    return i;
  }, [metrics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <Sparkles className="w-12 h-12 text-indigo-500 animate-pulse mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Inicializando IA Analítica</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 selection:bg-indigo-500/30 font-sans">
      
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
            </button>
            <div>
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">Camp.OS Pro <Sparkles className="w-3 h-3"/></p>
              <p className="text-sm font-bold text-white">Centro de Inteligência</p>
            </div>
          </div>
          <button onClick={() => alert("Gerando Relatório Executivo PDF...")} className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl flex gap-2 items-center text-[10px] font-black uppercase tracking-widest px-3 transition">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">

        {/* 1. MÓDULO IA CONSULTOR - RELATÓRIO EXECUTIVO */}
        <section className="bg-gradient-to-br from-indigo-900/30 to-zinc-950 border border-indigo-500/30 rounded-[2rem] p-5 relative overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.1)]">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>
           
           <div className="flex items-center gap-3 mb-5 relative z-10">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0">
                 <Bot className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                 <h2 className="text-lg font-black text-white uppercase tracking-tight">Análise da IA</h2>
                 <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Leitura de 15 dimensões financeiras</p>
              </div>
           </div>

           <div className="grid grid-cols-1 gap-3 relative z-10">
              {aiInsights.map((insight, idx) => (
                 <div key={idx} className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] ${
                    insight.type === 'danger' ? 'bg-red-950/20 border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' :
                    insight.type === 'warning' ? 'bg-yellow-950/20 border-yellow-500/20 shadow-[inset_0_0_20px_rgba(234,179,8,0.05)]' :
                    insight.type === 'success' ? 'bg-emerald-950/20 border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' :
                    'bg-indigo-950/20 border-indigo-500/20 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]'
                 }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                       <span className="text-base">{insight.icon}</span>
                       <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                          insight.type === 'danger' ? 'text-red-400' :
                          insight.type === 'warning' ? 'text-yellow-400' :
                          insight.type === 'success' ? 'text-emerald-400' : 'text-indigo-400'
                       }`}>{insight.title}</h4>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-medium">{insight.text}</p>
                 </div>
              ))}
           </div>
        </section>

        {/* 2. KPIS GLOBAIS (OS 4 PILARES) */}
        <section className="grid grid-cols-2 gap-3">
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between group hover:border-zinc-700 transition">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><Wallet className="w-3 h-3 text-white"/> Saldo Real</p>
              <p className={`text-xl font-black tracking-tighter ${metrics.realBalance >= 0 ? 'text-white' : 'text-red-400'}`}>R$ {metrics.realBalance.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between group hover:border-zinc-700 transition">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-emerald-500"/> Receita</p>
              <p className="text-xl font-black text-emerald-400 tracking-tighter">R$ {metrics.totalInc.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between group hover:border-zinc-700 transition">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-red-500"/> Despesa Mês</p>
              <p className="text-xl font-black text-white tracking-tighter">R$ {metrics.totalExp.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex flex-col justify-between group hover:border-emerald-500/50 transition">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-3 flex items-center gap-1.5"><Target className="w-3 h-3 text-blue-500"/> Poupança Global</p>
              <p className={`text-xl font-black tracking-tighter ${metrics.savingsRate >= 20 ? 'text-emerald-400' : metrics.savingsRate > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                 {metrics.savingsRate.toFixed(1)}%
              </p>
           </div>
        </section>

        {/* 3. A GRELHA DOS 15 GRÁFICOS AVANÇADOS */}
        <section className="grid grid-cols-1 gap-5">
          
          {/* Gráfico 1: Fluxo de Caixa (Bar vs Bar) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-6"><Activity className="w-4 h-4"/> 1. Fluxo de Caixa e Poder de Compra</h3>
            <div className="flex justify-between items-end h-32 gap-3">
              <div className="w-1/2 bg-emerald-500/10 rounded-t-2xl relative group flex flex-col justify-end overflow-hidden">
                 <div className="w-full bg-emerald-500 transition-all duration-1000 ease-out flex items-start justify-center pt-2" style={{ height: mounted ? '80%' : '0%' }}>
                    <span className="text-[10px] font-black text-emerald-950 -rotate-90 md:rotate-0">R$ {metrics.totalInc.toFixed(0)}</span>
                 </div>
              </div>
              <div className="w-1/2 bg-red-500/10 rounded-t-2xl relative group flex flex-col justify-end overflow-hidden">
                 <div className="w-full bg-red-500 transition-all duration-1000 ease-out flex items-start justify-center pt-2" style={{ height: mounted ? `${Math.min((metrics.totalExp/(metrics.totalInc||1))*80, 100)}%` : '0%' }}>
                    <span className="text-[10px] font-black text-red-950 -rotate-90 md:rotate-0">R$ {metrics.totalExp.toFixed(0)}</span>
                 </div>
              </div>
            </div>
            <div className="flex justify-between mt-3 text-[9px] font-black uppercase text-zinc-500 tracking-widest px-4">
               <span>Receitas Recebidas</span><span>Despesas Pagas</span>
            </div>
          </div>

          {/* Gráfico 2: Velocidade Diária (Runway) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5 flex flex-col justify-center items-center text-center relative overflow-hidden">
             <Zap className="w-24 h-24 text-zinc-800 absolute -right-4 -bottom-4 opacity-50" />
             <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-2"><Clock className="w-4 h-4"/> 2. Runway & Custo Dia</h3>
             <p className="text-4xl font-black text-white mt-4">{metrics.runwayDays}</p>
             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-2">Dias de sobrevivência</p>
             
             <div className="mt-6 pt-5 border-t border-zinc-800 w-full flex justify-between items-center">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Custo Médio/Dia:</span>
                <span className="text-sm font-black text-white">R$ {metrics.dailyAvg.toFixed(2)}</span>
             </div>
          </div>

          {/* Gráfico 3: Regra 50/30/20 */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-5"><Target className="w-4 h-4"/> 3. Orçamento (Regra 50/30/20)</h3>
            <div className="h-5 w-full flex rounded-full overflow-hidden mb-5 bg-zinc-950 border border-zinc-800">
              <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: mounted ? `${(metrics.fixedExp / (metrics.totalExp||1)) * 100}%` : '0%' }} title="Fixo"></div>
              <div className="bg-purple-500 h-full transition-all duration-1000 delay-300" style={{ width: mounted ? `${(metrics.varExp / (metrics.totalExp||1)) * 100}%` : '0%' }} title="Variável"></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
               <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500"><span className="text-blue-500">●</span> Fixos</p>
                  <p className="text-sm font-black text-white mt-1">R$ {metrics.fixedExp.toFixed(0)}</p>
                  <p className="text-[8px] text-zinc-500 font-mono mt-1">Ideal: {metrics.rule50.toFixed(0)}</p>
               </div>
               <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500"><span className="text-purple-500">●</span> Variáveis</p>
                  <p className="text-sm font-black text-white mt-1">R$ {metrics.varExp.toFixed(0)}</p>
                  <p className="text-[8px] text-zinc-500 font-mono mt-1">Ideal: {metrics.rule30.toFixed(0)}</p>
               </div>
               <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500"><span className="text-emerald-500">●</span> Poupança</p>
                  <p className="text-sm font-black text-white mt-1">R$ {Math.max(metrics.totalInc - metrics.totalExp, 0).toFixed(0)}</p>
                  <p className="text-[8px] text-zinc-500 font-mono mt-1">Meta: {metrics.rule20.toFixed(0)}</p>
               </div>
            </div>
          </div>

          {/* Gráfico 4: Meios de Pagamento */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5 flex flex-col items-center justify-center">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-5 w-full"><PieChart className="w-4 h-4"/> 4. Meios de Pagamento</h3>
            
            {/* Gráfico Donut CSS */}
            <div className="w-32 h-32 rounded-full border-[8px] border-zinc-950 relative flex items-center justify-center transition-all duration-1000" 
                 style={{ 
                   background: mounted && metrics.totalExp > 0 ? `conic-gradient(
                     #a855f7 0% ${(metrics.methodTotals.credit/metrics.totalExp)*100}%, 
                     #10b981 ${(metrics.methodTotals.credit/metrics.totalExp)*100}% ${((metrics.methodTotals.credit+metrics.methodTotals.pix)/metrics.totalExp)*100}%, 
                     #3b82f6 ${((metrics.methodTotals.credit+metrics.methodTotals.pix)/metrics.totalExp)*100}% ${((metrics.methodTotals.credit+metrics.methodTotals.pix+metrics.methodTotals.debit)/metrics.totalExp)*100}%, 
                     #f59e0b ${((metrics.methodTotals.credit+metrics.methodTotals.pix+metrics.methodTotals.debit)/metrics.totalExp)*100}% 100%
                   )` : 'transparent' 
                 }}>
               <div className="w-24 h-24 bg-zinc-900 rounded-full flex flex-col items-center justify-center shadow-inner">
                  <CreditCard className="w-5 h-5 text-zinc-500" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6 w-full bg-zinc-950/30 p-4 rounded-2xl border border-zinc-800/50">
               <div className="text-[10px] font-bold text-zinc-300"><span className="text-purple-500">●</span> Crédito ({((metrics.methodTotals.credit/(metrics.totalExp||1))*100).toFixed(0)}%)</div>
               <div className="text-[10px] font-bold text-zinc-300"><span className="text-emerald-500">●</span> PIX ({((metrics.methodTotals.pix/(metrics.totalExp||1))*100).toFixed(0)}%)</div>
               <div className="text-[10px] font-bold text-zinc-300"><span className="text-blue-500">●</span> Débito ({((metrics.methodTotals.debit/(metrics.totalExp||1))*100).toFixed(0)}%)</div>
               <div className="text-[10px] font-bold text-zinc-300"><span className="text-yellow-500">●</span> Caixa ({((metrics.methodTotals.cash/(metrics.totalExp||1))*100).toFixed(0)}%)</div>
            </div>
          </div>

          {/* Gráfico 5: Mapa de Calor Diário */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-5"><CalendarDays className="w-4 h-4"/> 5. Mapa de Frequência Mensal</h3>
            <div className="grid grid-cols-7 gap-1">
              {metrics.heatmap.map((val, i) => {
                 const intensity = val > 0 ? Math.max(0.2, val / metrics.maxHeat) : 0;
                 return (
                   <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold border border-zinc-800/50 transition-all hover:scale-110 cursor-help" 
                        style={{ backgroundColor: intensity > 0 ? `rgba(99, 102, 241, ${intensity})` : 'transparent' }}
                        title={`Dia ${i+1}: R$ ${val.toFixed(2)}`}>
                      <span className={intensity > 0.5 ? 'text-white' : 'text-zinc-500'}>{i+1}</span>
                   </div>
                 );
              })}
            </div>
          </div>

          {/* Gráfico 6: Dias da Semana */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 mb-5"><BarChart3 className="w-4 h-4"/> 6. Gastos por Dia da Semana</h3>
            <div className="flex items-end justify-between h-32 mt-4 px-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => {
                 const h = metrics.maxDay > 0 ? (metrics.weekDays[i] / metrics.maxDay) * 100 : 0;
                 const isWeekend = i === 0 || i === 6;
                 return (
                   <div key={day} className="flex flex-col items-center gap-2 group w-8">
                     <div className="w-full bg-zinc-950 rounded-t-lg relative flex flex-col justify-end h-full">
                        <div className={`w-full rounded-t-lg transition-all duration-1000 delay-${i*100} ${isWeekend ? 'bg-purple-500' : 'bg-indigo-500'}`} style={{ height: mounted ? `${h}%` : '0%' }}></div>
                     </div>
                     <span className="text-[8px] font-black uppercase text-zinc-500">{day}</span>
                   </div>
                 )
              })}
            </div>
          </div>

          {/* Gráfico 7: Limite de Crédito Global Usado */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5 flex flex-col items-center">
             <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6 w-full flex items-center gap-2"><CreditCard className="w-4 h-4"/> 7. Pressão de Crédito Global</h3>
             <div className="w-40 h-40 rounded-full border-[10px] border-zinc-950 relative flex items-center justify-center transition-all duration-1000 shadow-[0_0_30px_rgba(0,0,0,0.5)]" 
                  style={{ background: mounted ? `conic-gradient(${metrics.creditUsagePerc > 80 ? '#ef4444' : metrics.creditUsagePerc > 50 ? '#eab308' : '#3b82f6'} ${metrics.creditUsagePerc * 3.6}deg, transparent 0)` : 'transparent' }}>
                <div className="w-32 h-32 bg-zinc-900 rounded-full flex flex-col items-center justify-center">
                   <span className={`text-2xl font-black ${metrics.creditUsagePerc > 80 ? 'text-red-400' : 'text-white'}`}>{metrics.creditUsagePerc.toFixed(0)}%</span>
                   <span className="text-[8px] uppercase tracking-widest text-zinc-500 mt-1">Utilizado</span>
                </div>
             </div>
             <p className="text-[10px] text-zinc-400 font-bold mt-6 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">Limite Total: R$ {metrics.totalCreditLimit.toLocaleString('pt-BR')}</p>
          </div>

          {/* Gráfico 8: Top Categorias (Barras Horizontais) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
             <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-5 flex items-center gap-2"><PieChart className="w-4 h-4"/> 8. Drenagem por Categoria (Top 5)</h3>
             <div className="space-y-4">
               {metrics.topCats.slice(0, 5).map((tc, idx) => {
                 const p = metrics.totalExp > 0 ? (tc.val / metrics.totalExp) * 100 : 0;
                 return (
                   <div key={idx}>
                      <div className="flex justify-between text-[10px] font-bold text-white mb-1.5">
                        <span className="flex items-center gap-1.5 truncate">
                           {tc.cat?.logo_url ? <img src={tc.cat.logo_url} className="w-4 h-4 rounded-sm object-cover"/> : <span>{tc.cat?.icon || '📦'}</span>}
                           <span className="truncate max-w-[120px]">{tc.cat?.name || 'Outros'}</span>
                        </span>
                        <span className="shrink-0">R$ {tc.val.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                      </div>
                      <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800/50">
                         <div className={`h-full transition-all duration-1000 delay-${idx*200} ${tc.cat?.color && tc.cat.color !== 'zinc' ? `bg-${tc.cat.color}-500` : 'bg-indigo-500'}`} style={{ width: mounted ? `${p}%` : '0%' }}></div>
                      </div>
                   </div>
                 )
               })}
               {metrics.topCats.length === 0 && <p className="text-xs text-zinc-500 text-center py-4">Sem dados suficientes.</p>}
             </div>
          </div>

          {/* Gráfico 9: Maiores Transações do Mês */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
             <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-5 flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> 9. Transações Pesadas</h3>
             <div className="space-y-3">
                {metrics.topTransactions.map(tx => {
                   const cat = categories.find(c => c.id === tx.category_id);
                   return (
                     <div key={tx.id} className="flex items-center justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                           <p className="text-[11px] font-bold text-white truncate">{tx.description}</p>
                           <p className="text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">{cat?.name || 'Geral'} • {new Date(tx.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</p>
                        </div>
                        <p className="text-xs font-black text-red-400 shrink-0 ml-2">R$ {Number(tx.amount).toFixed(0)}</p>
                     </div>
                   )
                })}
                {metrics.topTransactions.length === 0 && <p className="text-xs text-zinc-500 text-center py-4">Sem grandes compras.</p>}
             </div>
          </div>

          {/* Gráfico 10: Projeção de Faturas Futuras (Barras Verticais) */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-5">
             <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> 10. Efeito Bola de Neve</h3>
             <p className="text-[9px] text-zinc-400 mb-5 leading-relaxed">Valores já comprometidos em parcelamentos futuros de crédito.</p>
             <div className="flex items-end gap-4 h-28 mt-2 px-2">
                {[
                   { label: 'Mês 1', val: metrics.futureFaturas.mes1 },
                   { label: 'Mês 2', val: metrics.futureFaturas.mes2 },
                   { label: 'Mês 3', val: metrics.futureFaturas.mes3 }
                ].map((f, i) => {
                   const maxF = Math.max(metrics.futureFaturas.mes1, metrics.futureFaturas.mes2, metrics.futureFaturas.mes3) || 1;
                   const h = (f.val / maxF) * 100;
                   return (
                     <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full max-w-[40px] bg-zinc-950 rounded-t-xl relative flex flex-col justify-end h-full border border-zinc-800/50">
                           <div className="w-full bg-yellow-500/80 rounded-t-xl transition-all duration-1000 flex items-start justify-center pt-2" style={{ height: mounted ? `${h}%` : '0%' }}>
                              {f.val > 0 && <span className="text-[8px] font-black text-yellow-950 -rotate-90 mt-2">R${f.val.toFixed(0)}</span>}
                           </div>
                        </div>
                        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest text-center">{f.label}</span>
                     </div>
                   )
                })}
             </div>
          </div>

        </section>

      </main>
    </div>
  );
}