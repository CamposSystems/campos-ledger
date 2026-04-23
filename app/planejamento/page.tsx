"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, ArrowRight, Target, CheckCircle2, AlertTriangle, 
  RefreshCw, TrendingDown, TrendingUp, Pencil, X, Check, ChevronDown, ChevronUp
} from "lucide-react";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function PlanejamentoPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  
  // Abas para separar Rendas e Gastos
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  
  // Controle da Sanfona (Accordion) das Categorias
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (userProfile?.family_id) {
      loadTransactions(userProfile.family_id, currentDate);
    }
  }, [currentDate, userProfile]);

  async function initApp() {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      const { data: profile } = await supabase.from("profiles").select("id, display_name, family_id").eq("id", session.user.id).single();

      if (profile) {
        setUserProfile(profile);
        if (profile.family_id) {
          await loadCategories(profile.family_id);
          await loadTransactions(profile.family_id, currentDate);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories(familyId: string) {
    const { data } = await supabase.from("categories").select("*").eq("family_id", familyId).order("name");
    if (data) {
      setCategories(data);
      // Inicia com todos os grupos "pai" OCULTOS (false)
      const parents = data.filter(c => !c.parent_id);
      const initialExpanded: any = {};
      parents.forEach(p => initialExpanded[p.id] = false);
      setExpandedParents(initialExpanded);
    }
  }

  async function loadTransactions(familyId: string, dateObj: Date) {
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
    const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("transactions")
      .select("amount, category_id, type, status")
      .eq("family_id", familyId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (data) setTransactions(data);
  }

  function parseCurrency(value: string) {
    if (!value) return 0;
    return parseFloat(value.toString().replace(/\./g, "").replace(",", ".")) || 0;
  }

  async function handleSaveGoal(categoryId: string) {
    const newAmount = parseCurrency(editAmount);
    setBusy(true);

    try {
      const { error } = await supabase.from("categories").update({ planned_amount: newAmount }).eq("id", categoryId);
      if (error) throw error;

      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, planned_amount: newAmount } : c));
      setEditingCatId(null);
    } catch (err: any) {
      alert("Erro ao salvar meta: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  const toggleParent = (parentId: string) => {
    setExpandedParents(prev => ({ ...prev, [parentId]: !prev[parentId] }));
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // MOTOR INTELIGENTE DE AGRUPAMENTO (Pai/Filho) E COMPARAÇÃO DE RENDA/GASTOS
  const { macroStats, groupedExpenses, groupedIncomes } = useMemo(() => {
    let totalPlannedIncome = 0;
    let totalRealIncome = 0;
    let totalPlannedExpense = 0;
    let totalRealExpense = 0;

    const buildStats = (type: "expense" | "income") => {
      const typeCats = categories.filter(c => c.type === type);
      const parentCats = typeCats.filter(c => !c.parent_id);
      const childCats = typeCats.filter(c => c.parent_id);

      return parentCats.map(parent => {
        const children = childCats.filter(c => c.parent_id === parent.id);
        const parentFamily = [parent, ...children]; 
        
        let familyPlanned = 0;
        let familyReal = 0;

        const childrenStats = parentFamily.map(cat => {
          const planned = Number(cat.planned_amount) || 0;
          const real = transactions.filter(t => t.category_id === cat.id && t.type === type).reduce((acc, t) => acc + Number(t.amount), 0);
          
          familyPlanned += planned;
          familyReal += real;
          
          if(type === 'income') {
            totalPlannedIncome += planned;
            totalRealIncome += real;
          } else {
            totalPlannedExpense += planned;
            totalRealExpense += real;
          }

          const percentage = planned > 0 ? (real / planned) * 100 : (real > 0 ? 100 : 0);
          
          let status = type === 'expense' ? "safe" : "danger";
          if (type === 'expense') {
             if (percentage >= 85 && percentage <= 100) status = "warning";
             if (percentage > 100) status = "danger";
          } else {
             if (percentage >= 100) status = "safe";
             else if (percentage >= 80) status = "warning";
          }
          if (planned === 0 && real > 0) status = "unplanned";

          return { ...cat, planned, real, percentage, status };
        }).filter(c => c.id !== parent.id || children.length === 0 || c.planned > 0 || c.real > 0); 

        const familyPercentage = familyPlanned > 0 ? (familyReal / familyPlanned) * 100 : 0;
        
        return {
          parent,
          familyPlanned,
          familyReal,
          familyPercentage,
          children: childrenStats
        };
      }).filter(g => g.children.length > 0 || g.familyPlanned > 0 || g.familyReal > 0);
    };

    return {
      macroStats: {
        totalPlannedIncome, totalRealIncome,
        totalPlannedExpense, totalRealExpense,
        plannedBalance: totalPlannedIncome - totalPlannedExpense
      },
      groupedExpenses: buildStats("expense"),
      groupedIncomes: buildStats("income")
    };
  }, [categories, transactions]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><RefreshCw className="w-10 h-10 text-zinc-600 animate-spin" /></div>;

  const currentGroups = activeTab === 'expense' ? groupedExpenses : groupedIncomes;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
            <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
          </button>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Controle Ativo</p>
            <p className="text-sm font-bold text-white tracking-tight">Metas & Previsto</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        
        {/* NAVEGAÇÃO DE MÊS */}
        <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 p-2 rounded-2xl">
          <button onClick={prevMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-black tracking-tighter uppercase">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          </div>
          <button onClick={nextMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition"><ArrowRight className="w-4 h-4" /></button>
        </div>

        {/* MACRO CARD - PREVISÃO DE RENDA VS GASTOS */}
        <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 relative overflow-hidden group">
          <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none ${macroStats.plannedBalance >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}></div>
          
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4">Saúde do Orçamento Projetado</p>
          
          <div className="grid grid-cols-2 gap-4 relative z-10 mb-6">
             <div>
                <p className="text-[9px] text-emerald-500/80 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Renda Prevista</p>
                <p className="text-lg font-black text-emerald-400">R$ {macroStats.totalPlannedIncome.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
             </div>
             <div>
                <p className="text-[9px] text-red-500/80 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3"/> Gastos Previstos</p>
                <p className="text-lg font-black text-red-400">R$ {macroStats.totalPlannedExpense.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
             </div>
          </div>

          <div className={`p-4 rounded-xl border relative z-10 flex justify-between items-center ${macroStats.plannedBalance >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div>
               <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${macroStats.plannedBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Saldo Final Projetado</p>
               <p className={`text-2xl font-black ${macroStats.plannedBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {Math.abs(macroStats.plannedBalance).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
            </div>
            {macroStats.plannedBalance < 0 && (
               <div className="flex items-center gap-1.5 text-red-400 bg-red-500/20 px-2 py-1 rounded">
                 <AlertTriangle className="w-4 h-4" /><span className="text-[9px] font-black uppercase">Deficit!</span>
               </div>
            )}
          </div>
        </div>

        {/* ABAS RECEITAS / DESPESAS */}
        <div className="flex bg-zinc-900 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab("expense")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "expense" ? "bg-red-500/20 text-red-400 border border-red-500/20 shadow-md" : "text-zinc-500"}`}>Gastos</button>
          <button onClick={() => setActiveTab("income")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "income" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-md" : "text-zinc-500"}`}>Rendas</button>
        </div>

        {/* LISTA AGRUPADA (SANFONA) DE CATEGORIAS */}
        <div className="space-y-4">
           {currentGroups.map(group => (
             <div key={group.parent.id} className="bg-zinc-900/50 border border-zinc-800 rounded-[1.5rem] overflow-hidden">
                {/* CABEÇALHO DO GRUPO PAI - CLICÁVEL */}
                <button onClick={() => toggleParent(group.parent.id)} className="w-full p-4 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 transition-colors">
                   <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-${group.parent.color}-500/10 text-${group.parent.color}-500 flex items-center justify-center text-lg border border-${group.parent.color}-500/20 overflow-hidden`}>
                         {group.parent.logo_url ? <img src={group.parent.logo_url} className="w-full h-full object-cover" /> : group.parent.icon}
                      </div>
                      <div className="text-left">
                         <p className="font-bold text-white text-sm">{group.parent.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                             Meta: R$ {group.familyPlanned.toLocaleString('pt-BR')}
                           </span>
                           <span className="text-zinc-600 text-[9px]">•</span>
                           <span className={`text-[9px] font-bold uppercase tracking-widest ${activeTab === 'expense' ? (group.familyReal > group.familyPlanned ? 'text-red-400' : 'text-emerald-400') : 'text-emerald-400'}`}>
                             Real: R$ {group.familyReal.toLocaleString('pt-BR')}
                           </span>
                         </div>
                      </div>
                   </div>
                   {expandedParents[group.parent.id] ? <ChevronUp className="w-5 h-5 text-zinc-500" /> : <ChevronDown className="w-5 h-5 text-zinc-500" />}
                </button>

                {/* SUBCATEGORIAS (FILHOS) - OCULTAS ATÉ CLICAR */}
                {expandedParents[group.parent.id] && (
                  <div className="p-4 pt-2 space-y-4 bg-zinc-950/30">
                    {group.children.map(cat => {
                       const isEditing = editingCatId === cat.id;
                       const diff = cat.planned - cat.real;

                       return (
                         <div key={cat.id} className="relative pl-4">
                           {/* Linha conectora visual */}
                           <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-800"></div>
                           <div className="absolute left-0 top-6 w-3 h-px bg-zinc-800"></div>

                           <div className="flex items-center justify-between ml-2">
                             <div>
                               <p className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                                 {cat.logo_url ? <img src={cat.logo_url} className="w-4 h-4 rounded-sm object-cover"/> : <span className="text-xs">{cat.icon}</span>}
                                 {cat.name}
                               </p>
                             </div>
                             
                             {!isEditing ? (
                               <button onClick={() => {setEditingCatId(cat.id); setEditAmount(String(cat.planned).replace(".", ","));}} className="p-1.5 text-zinc-500 hover:text-white transition">
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                             ) : null}
                           </div>

                           {/* MODO DE EDIÇÃO */}
                           {isEditing ? (
                              <div className="flex items-center gap-2 mt-2 ml-2">
                                 <div className="flex-1 relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-black">R$</span>
                                    <input autoFocus type="text" inputMode="decimal" value={editAmount} onChange={e=>setEditAmount(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500" />
                                 </div>
                                 <button onClick={() => handleSaveGoal(cat.id)} disabled={busy} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition"><Check className="w-4 h-4" /></button>
                                 <button onClick={() => setEditingCatId(null)} disabled={busy} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition"><X className="w-4 h-4" /></button>
                              </div>
                           ) : (
                              <div className="mt-2 ml-2">
                                 <div className="flex justify-between items-end mb-1.5">
                                    <p className="text-xs font-black text-white">R$ {cat.real.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span className="text-[9px] text-zinc-500 font-medium">{activeTab === 'expense' ? 'gasto' : 'recebido'} / R$ {cat.planned.toLocaleString('pt-BR')}</span></p>
                                    
                                    {cat.status === 'unplanned' ? (
                                       <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Sem Meta</span>
                                    ) : cat.status === 'danger' ? (
                                       <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">{activeTab === 'expense' ? `Passou R$ ${Math.abs(diff).toLocaleString('pt-BR')}` : `Falta R$ ${diff.toLocaleString('pt-BR')}`}</span>
                                    ) : cat.status === 'warning' ? (
                                       <span className="text-[8px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Atenção</span>
                                    ) : (
                                       <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5"/> {activeTab === 'expense' ? `Sobra R$ ${diff.toLocaleString('pt-BR')}` : 'Meta Batida'}</span>
                                    )}
                                 </div>
                                 <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${cat.status === 'danger' ? 'bg-red-500' : cat.status === 'warning' ? 'bg-yellow-500' : cat.status === 'unplanned' ? 'bg-zinc-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(cat.percentage, 100)}%` }}></div>
                                 </div>
                              </div>
                           )}
                         </div>
                       )
                    })}
                  </div>
                )}
             </div>
           ))}

           {currentGroups.length === 0 && (
              <div className="text-center py-8 bg-zinc-900/30 rounded-2xl border border-zinc-800 border-dashed">
                <p className="text-sm text-zinc-500 font-bold">Nenhuma categoria encontrada nesta visão.</p>
              </div>
           )}
        </div>

      </main>
    </div>
  );
}