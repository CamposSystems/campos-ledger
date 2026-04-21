"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Inicialização do cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dicionário de Categorias - Experiência 100% Clicável
const CATEGORIAS_DESPESA = [
  { id: "mercado", nome: "Mercado", icon: "🛒", cor: "bg-orange-500/10 text-orange-500" },
  { id: "combustivel", nome: "Combustível", icon: "⛽", cor: "bg-blue-500/10 text-blue-500" },
  { id: "lanche", nome: "Lanches/Ifood", icon: "🍔", cor: "bg-yellow-500/10 text-yellow-500" },
  { id: "casa", nome: "Casa/Contas", icon: "🏠", cor: "bg-purple-500/10 text-purple-500" },
  { id: "carro", nome: "Viatura/Manut.", icon: "🔧", cor: "bg-zinc-500/10 text-zinc-400" },
  { id: "saude", nome: "Saúde/Farm.", icon: "💊", cor: "bg-red-500/10 text-red-500" },
  { id: "lazer", nome: "Lazer/Passeio", icon: "🍿", cor: "bg-pink-500/10 text-pink-500" },
  { id: "outros", nome: "Outros", icon: "📦", cor: "bg-zinc-800 text-zinc-400" },
];

const CATEGORIAS_RECEITA = [
  { id: "salario", nome: "Salário", icon: "💰", cor: "bg-emerald-500/10 text-emerald-500" },
  { id: "renda_extra", nome: "Renda Extra", icon: "🚀", cor: "bg-cyan-500/10 text-cyan-500" },
  { id: "reembolso", nome: "Reembolso", icon: "🔄", cor: "bg-indigo-500/10 text-indigo-500" },
];

export default function App() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userName, setUserName] = useState("Usuário");
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Estados do Formulário Avançado
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [metodo, setMetodo] = useState("pix");
  const [parcelas, setParcelas] = useState("1");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    initDashboard();
  }, []);

  async function initDashboard() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, family_id")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserName(profile.display_name || "Charles");
        setFamilyId(profile.family_id);
        if (profile.family_id) {
          fetchTransactions(profile.family_id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Erro ao iniciar dashboard:", err);
      setLoading(false);
    }
  }

  async function fetchTransactions(fId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", fId)
      .order("date", { ascending: false });

    if (!error && data) setTransactions(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const valorNumerico = parseFloat(valor.replace(",", "."));

    if (!familyId) return alert("Erro: Vínculo familiar não encontrado. Acesse o Painel Admin.");
    if (!categoriaSelecionada) return alert("Por favor, selecione uma categoria.");

    const catObj = (tipo === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA)
      .find(c => c.id === categoriaSelecionada);

    const payload = {
      profile_id: session?.user.id,
      family_id: familyId,
      amount: valorNumerico,
      type: tipo === "receita" ? "income" : "expense",
      category: catObj?.nome,
      date: data,
      // Redundância para colunas em PT
      valor: valorNumerico,
      tipo: tipo,
      descricao: catObj?.nome,
      metodo_pagamento: metodo,
      data: data
    };

    const { error } = await supabase.from("transactions").insert([payload]);

    if (!error) {
      setIsModalOpen(false);
      setValor("");
      setCategoriaSelecionada("");
      setParcelas("1");
      fetchTransactions(familyId);
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  }

  // Lógica de Dashboards (Previsto vs Realizado)
  const totalReceitas = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalDespesas = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + (t.amount || 0), 0);
  const saldoAtual = totalReceitas - totalDespesas;

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white space-y-4">
      <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      <p className="font-black tracking-widest text-xs uppercase animate-pulse">Sincronizando Camp.OS</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-white selection:text-black">
      <div className="max-w-md mx-auto p-6 space-y-8 pb-32">
        
        {/* Header de Alto Nível */}
        <div className="flex justify-between items-center pt-4">
          <div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Ledger v2.0</p>
            <h1 className="text-3xl font-black tracking-tighter mt-1 italic">Olá, {userName}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/admin")} className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all shadow-lg">
              ⚙️
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all shadow-lg">
              🚪
            </button>
          </div>
        </div>

        {/* Dashboard de Saldo e Previsão */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-zinc-800 to-zinc-900 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div className="relative bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Patrimônio Familiar</p>
            <h2 className={`text-5xl font-black mt-3 tracking-tighter tabular-nums ${saldoAtual >= 0 ? "text-white" : "text-red-500"}`}>
              R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-zinc-800/50">
              <div className="space-y-1">
                <p className="text-zinc-500 text-[9px] font-black uppercase">Ganhos Reais</p>
                <p className="text-emerald-400 font-black text-lg">R$ {totalReceitas.toFixed(2)}</p>
              </div>
              <div className="space-y-1 text-right border-l border-zinc-800/50 pl-4">
                <p className="text-zinc-500 text-[9px] font-black uppercase">Gastos Reais</p>
                <p className="text-red-400 font-black text-lg">R$ {totalDespesas.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão de Ação Principal */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-white text-black font-black py-6 rounded-[2.2rem] hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_20px_60px_rgba(255,255,255,0.08)] text-xl tracking-tighter uppercase"
        >
          + Novo Lançamento
        </button>

        {/* Lista de Transações - Visual de App Bancário */}
        <div className="space-y-6 pt-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Timeline Financeira</h3>
            <div className="flex gap-2">
               <span className="text-[9px] bg-zinc-900 px-3 py-1 rounded-full text-zinc-400 font-black border border-zinc-800 uppercase">Mês Atual</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="bg-zinc-900/20 border border-dashed border-zinc-800 rounded-3xl p-10 text-center">
                <p className="text-zinc-600 text-sm font-bold uppercase italic tracking-widest">Aguardando Lançamentos...</p>
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-zinc-900/30 p-5 rounded-[2rem] border border-transparent hover:border-zinc-800 hover:bg-zinc-900/50 transition-all group cursor-default">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-2xl shadow-inner ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-400 group-hover:bg-zinc-800'}`}>
                      {t.type === 'income' ? '💰' : '💳'}
                    </div>
                    <div>
                      <p className="font-black text-sm text-zinc-100 capitalize tracking-tight">{t.descricao || t.category}</p>
                      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">
                        {t.metodo_pagamento?.replace('_', ' ') || 'Outro'} • {new Date(t.date || t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-lg tracking-tighter ${t.type === 'income' ? 'text-emerald-400' : 'text-zinc-100'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {(t.amount || t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE LANÇAMENTO - 100% CLICÁVEL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-2xl transition-all">
          <div className="bg-zinc-950 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-[3.5rem] rounded-t-[3.5rem] p-8 border border-zinc-800/50 flex flex-col animate-in slide-in-from-bottom-full duration-500 overflow-hidden shadow-[0_-20px_80px_rgba(0,0,0,0.5)]">
            
            <div className="flex justify-between items-center mb-8 pt-2">
              <h2 className="text-4xl font-black tracking-tighter italic">REGISTRO</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-10 overflow-y-auto pb-10 no-scrollbar">
              
              {/* Seletor Tipo (Entrada/Saída) */}
              <div className="flex bg-zinc-900 p-2 rounded-3xl border border-zinc-800">
                <button type="button" onClick={() => {setTipo("despesa"); setCategoriaSelecionada("");}} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${tipo === "despesa" ? "bg-zinc-800 text-white shadow-2xl scale-[1.02]" : "text-zinc-600 hover:text-zinc-400"}`}>Saída de Capital</button>
                <button type="button" onClick={() => {setTipo("receita"); setCategoriaSelecionada("");}} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${tipo === "receita" ? "bg-emerald-600 text-white shadow-2xl scale-[1.02]" : "text-zinc-600 hover:text-zinc-400"}`}>Entrada de Capital</button>
              </div>

              {/* Quantia Principal */}
              <div className="flex flex-col items-center py-4 bg-zinc-900/20 rounded-[2.5rem] border border-zinc-900">
                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-4">Montante</span>
                <div className="flex items-center text-7xl font-black tracking-tighter">
                  <span className="text-zinc-800 text-2xl mr-4">R$</span>
                  <input required autoFocus type="number" step="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} className="bg-transparent w-full max-w-[280px] text-center text-white focus:outline-none placeholder-zinc-900" />
                </div>
              </div>

              {/* Categorias - Seleção Clicável (UX FOCUSED) */}
              <div className="space-y-4">
                <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] ml-2">Finalidade do Gasto</span>
                <div className="grid grid-cols-4 gap-4">
                  {(tipo === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoriaSelecionada(cat.id)}
                      className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[2rem] transition-all border-2 relative group ${categoriaSelecionada === cat.id ? 'bg-white border-white text-black scale-105 shadow-[0_20px_40px_rgba(255,255,255,0.1)]' : 'bg-zinc-900/50 border-zinc-900 text-zinc-500 hover:border-zinc-800'}`}
                    >
                      <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                      <span className="text-[9px] font-black uppercase tracking-tighter leading-none text-center">{cat.nome}</span>
                      {categoriaSelecionada === cat.id && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detalhes de Pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] ml-2">Modalidade</span>
                  <select value={metodo} onChange={e => setMetodo(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-xs font-black text-white outline-none appearance-none hover:border-zinc-700 transition-colors">
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="dinheiro">Dinheiro Espécie</option>
                    <option value="carne">Carnê / Boleto</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] ml-2">Data Registro</span>
                  <input required type="date" value={data} onChange={e => setData(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-xs font-black text-white outline-none focus:border-zinc-700 transition-colors" />
                </div>
              </div>

              {/* Parcelamento Inteligente */}
              {(metodo === 'cartao_credito' || metodo === 'carne') && tipo === 'despesa' && (
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] flex items-center justify-between animate-in zoom-in duration-300">
                   <div>
                      <p className="text-base font-black text-white">Parcelamento</p>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1 italic">Projeção de dívida futura</p>
                   </div>
                   <select value={parcelas} onChange={e => setParcelas(e.target.value)} className="bg-white text-black border-none rounded-xl px-6 py-3 text-xs font-black outline-none shadow-2xl hover:bg-zinc-200 transition-colors">
                      <option value="1">À vista (1x)</option>
                      {[2,3,4,5,6,10,12].map(n => <option key={n} value={n}>{n}x vezes</option>)}
                   </select>
                </div>
              )}

              {/* Botão de Confirmação Final */}
              <div className="pt-4 mt-auto">
                <button type="submit" className="w-full bg-white text-black font-black py-6 rounded-3xl hover:bg-zinc-200 active:scale-95 transition-all text-2xl shadow-[0_20px_50px_rgba(255,255,255,0.15)] uppercase tracking-tighter">
                  Efetivar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}