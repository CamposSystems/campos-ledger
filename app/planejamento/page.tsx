"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, ArrowRight, Target, CheckCircle2, AlertTriangle, 
  RefreshCw, TrendingDown, Wallet, Pencil, X, Check
} from "lucide-react";

/* =========================================================================
   ⚠️ ATENÇÃO CHARLES: PARA O SEU VS CODE E VERCEL, USE AS IMPORTAÇÕES REAIS:
   Descomente as duas linhas abaixo e apague o bloco MOCK a seguir.
========================================================================= */
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";


// INICIALIZAÇÃO DO SUPABASE
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
    const { data } = await supabase.from("categories").select("*").eq("family_id", familyId).eq("type", "expense").order("name");
    if (data) setCategories(data);
  }

  async function loadTransactions(familyId: string, dateObj: Date) {
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
    const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("transactions")
      .select("amount, category_id, type")
      .eq("family_id", familyId)
      .eq("type", "expense")
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

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // Motor de cruzamento de dados (Orçado vs Gasto)
  const budgetStats = useMemo(() => {
    let globalPlanned = 0;
    let globalSpent = 0;

    const categoryStats = categories.map(cat => {
      const planned = Number(cat.planned_amount) || 0;
      const spent = transactions
        .filter(t => t.category_id === cat.id)
        .reduce((acc, t) => acc + Number(t.amount), 0);
      
      globalPlanned += planned;
      globalSpent += spent;

      const remaining = planned - spent;
      const percentage = planned > 0 ? (spent / planned) * 100 : (spent > 0 ? 100 : 0);

      let status = "safe"; // verde
      if (percentage >= 80 && percentage <= 100) status = "warning"; // amarelo
      if (percentage > 100) status = "danger"; // vermelho
      if (planned === 0 && spent > 0) status = "unplanned"; // cinza

      return { ...cat, planned, spent, remaining, percentage, status };
    }).sort((a, b) => b.spent - a.spent); // Ordena pelos maiores gastos

    return { globalPlanned, globalSpent, globalRemaining: globalPlanned - globalSpent, categoryStats };
  }, [categories, transactions]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><RefreshCw className="w-10 h-10 text-zinc-600 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
            <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
          </button>
          <div>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Controle Ativo</p>
            <p className="text-sm font-bold text-white tracking-tight">Previsto vs Realizado</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        
        {/* NAVEGAÇÃO */}
        <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 p-2 rounded-2xl">
          <button onClick={prevMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-black tracking-tighter uppercase">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          </div>
          <button onClick={nextMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition"><ArrowRight className="w-4 h-4" /></button>
        </div>

        {/* RESUMO GLOBAL */}
        <div className="bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="relative z-10 flex justify-between items-start mb-6">
             <div>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-1">Total Planejado (Gastos)</p>
                <h2 className="text-3xl font-black text-white"><span className="text-lg text-zinc-500 mr-1">R$</span>{budgetStats.globalPlanned.toLocaleString('pt-BR', {minimumFractionDigits:2})}</h2>
             </div>
             <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <Target className="w-5 h-5" />
             </div>
          </div>

          <div className="relative z-10 w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-800 mb-4">
             <div className={`h-full transition-all duration-1000 ${budgetStats.globalSpent > budgetStats.globalPlanned ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((budgetStats.globalSpent / (budgetStats.globalPlanned || 1)) * 100, 100)}%` }}></div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
             <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400"/> Já Gasto</p>
                <p className="text-sm font-black text-white">R$ {budgetStats.globalSpent.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
             </div>
             <div className={`p-3 rounded-xl border ${budgetStats.globalRemaining >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 ${budgetStats.globalRemaining >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {budgetStats.globalRemaining >= 0 ? <CheckCircle2 className="w-3 h-3"/> : <AlertTriangle className="w-3 h-3"/>}
                  {budgetStats.globalRemaining >= 0 ? 'Disponível' : 'Estourado'}
                </p>
                <p className={`text-sm font-black ${budgetStats.globalRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {Math.abs(budgetStats.globalRemaining).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
             </div>
          </div>
        </div>

        {/* LISTA DE CATEGORIAS */}
        <div>
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Orçamentos por Categoria</h3>
           </div>

           <div className="space-y-4">
             {budgetStats.categoryStats.map(cat => {
               const isEditing = editingCatId === cat.id;

               return (
                 <div key={cat.id} className="bg-zinc-900 border border-zinc-800 rounded-[1.5rem] p-4 flex flex-col gap-3 group transition-all hover:border-zinc-700">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-${cat.color}-500/10 text-${cat.color}-500 flex items-center justify-center text-lg border border-${cat.color}-500/20 overflow-hidden`}>
                             {cat.logo_url ? <img src={cat.logo_url} className="w-full h-full object-cover" /> : cat.icon}
                          </div>
                          <div>
                             <p className="font-bold text-white text-sm">{cat.name}</p>
                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                               Meta: R$ {cat.planned.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                             </p>
                          </div>
                       </div>
                       
                       {/* BOTÃO MÁGICO DE EDITAR A META */}
                       {!isEditing && (
                          <button onClick={() => {setEditingCatId(cat.id); setEditAmount(String(cat.planned).replace(".", ","));}} className="p-2 bg-zinc-950 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition">
                             <Pencil className="w-3 h-3" />
                          </button>
                       )}
                    </div>

                    {/* MODO DE EDIÇÃO */}
                    {isEditing ? (
                       <div className="flex items-center gap-2 mt-2 pt-3 border-t border-zinc-800/50">
                          <div className="flex-1 relative">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-black">R$</span>
                             <input 
                               autoFocus
                               type="text" 
                               inputMode="decimal"
                               value={editAmount} 
                               onChange={e=>setEditAmount(e.target.value)} 
                               className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-indigo-500" 
                             />
                          </div>
                          <button onClick={() => handleSaveGoal(cat.id)} disabled={busy} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition">
                             <Check className="w-5 h-5" />
                          </button>
                          <button onClick={() => setEditingCatId(null)} disabled={busy} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition">
                             <X className="w-5 h-5" />
                          </button>
                       </div>
                    ) : (
                       /* MODO VISUALIZAÇÃO: BARRA DE PROGRESSO */
                       <div className="mt-1">
                          <div className="flex justify-between items-end mb-2">
                             <p className="text-xs font-black text-white">R$ {cat.spent.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span className="text-[10px] text-zinc-500 font-medium">gasto</span></p>
                             
                             {cat.status === 'unplanned' ? (
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-bold uppercase tracking-wider">Sem Meta</span>
                             ) : cat.status === 'danger' ? (
                                <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Passou R$ {Math.abs(cat.remaining).toLocaleString('pt-BR')}</span>
                             ) : cat.status === 'warning' ? (
                                <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1">Atenção (Sobra R$ {cat.remaining.toLocaleString('pt-BR')})</span>
                             ) : (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Sobra R$ {cat.remaining.toLocaleString('pt-BR')}</span>
                             )}
                          </div>
                          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                             <div className={`h-full transition-all duration-1000 ${cat.status === 'danger' ? 'bg-red-500' : cat.status === 'warning' ? 'bg-yellow-500' : cat.status === 'unplanned' ? 'bg-zinc-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(cat.percentage, 100)}%` }}></div>
                          </div>
                       </div>
                    )}
                 </div>
               )
             })}

             {categories.length === 0 && (
                <div className="text-center py-8 bg-zinc-900/30 rounded-2xl border border-zinc-800 border-dashed">
                  <p className="text-sm text-zinc-500 font-bold">Nenhuma categoria de despesa encontrada.</p>
                </div>
             )}
           </div>
        </div>

      </main>
    </div>
  );
}