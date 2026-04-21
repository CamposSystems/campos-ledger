"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userName, setUserName] = useState("Usuário");
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Estados do Formulário (Interface em Português)
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [metodo, setMetodo] = useState("pix");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    initDashboard();
  }, []);

  async function initDashboard() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push("/login");
      return;
    }

    // Busca o perfil do usuário para pegar o family_id e o nome
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, family_id")
      .eq("id", session.user.id)
      .single();

    if (profile) {
      setUserName(profile.display_name || "Charles");
      setFamilyId(profile.family_id);
      fetchTransactions(profile.family_id);
    } else {
      setLoading(false);
    }
  }

  async function fetchTransactions(fId: string | null) {
    if (!fId) return setLoading(false);

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", fId)
      .order("date", { ascending: false }); // Usando a coluna 'date' original para ordenar

    if (!error && data) {
        setTransactions(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    const valorNumerico = parseFloat(valor.replace(",", "."));

    if (!familyId) return alert("Erro: Perfil sem família vinculada.");
    if (isNaN(valorNumerico)) return alert("Digite um valor numérico válido.");

    // Mapeamos os estados do React para as colunas exatas que existem no seu Supabase!
    // Como você criou as colunas em PT, vamos alimentá-las diretamente.
    const { error } = await supabase.from("transactions").insert([
      {
        profile_id: session?.user.id,
        family_id: familyId,
        
        // Salvando nas colunas originais em Inglês (Para manter compatibilidade)
        amount: valorNumerico,
        type: tipo === "receita" ? "income" : "expense", // Traduzimos para o padrão do banco antigo
        category: descricao, // O antigo usava category como descrição
        date: data, // Salvando na 'date' original (timestamptz)

        // Salvando TAMBÉM nas novas colunas em PT que você criou
        valor: valorNumerico,
        tipo: tipo,
        descricao: descricao,
        metodo_pagamento: metodo,
        data: data // Salvando na nova 'data'
      },
    ]);

    if (!error) {
      setIsModalOpen(false);
      setDescricao("");
      setValor("");
      fetchTransactions(familyId); // Recarrega a lista
    } else {
      alert("Erro ao salvar no banco de dados: " + error.message);
    }
  }

  // Cálculos do Resumo (Lendo das colunas originais em inglês, pois são numéricas puras)
  const totalReceitas = transactions.filter(t => t.type === "income").reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalDespesas = transactions.filter(t => t.type === "expense").reduce((acc, t) => acc + (t.amount || 0), 0);
  const saldoAtual = totalReceitas - totalDespesas;

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando Camp.OS...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Camp.OS Ledger</p>
            <h1 className="text-2xl font-bold mt-1">Olá, {userName} 👋</h1>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-xl hover:bg-zinc-700 transition">
            🚪
          </button>
        </div>

        {/* Card de Saldo */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-xl">
          <p className="text-zinc-400 text-sm">Saldo Familiar</p>
          <h2 className={`text-4xl font-bold mt-2 ${saldoAtual >= 0 ? "text-white" : "text-red-500"}`}>
            R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex flex-col">
              <span className="text-zinc-500">Receitas</span>
              <span className="text-emerald-400 font-bold">R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-zinc-500">Despesas</span>
              <span className="text-red-400 font-bold">R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition active:scale-95 shadow-lg"
        >
          + Lançar Movimentação
        </button>

        {/* Lista de Movimentações */}
        <div>
          <h3 className="text-zinc-400 text-sm mb-4 font-bold uppercase tracking-widest">Últimos Lançamentos</h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-zinc-600 text-sm text-center py-4">Nenhuma movimentação encontrada para esta família.</p>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    {/* Define a cor e o ícone com base no tipo original ('income' ou 'expense') */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {t.type === 'income' ? '▲' : '▼'}
                    </div>
                    <div>
                      {/* Tenta ler a descrição nova, se não existir, lê a categoria antiga */}
                      <p className="font-bold text-sm capitalize">{t.descricao || t.category || 'Sem descrição'}</p>
                      {/* Tenta ler o método de pagamento, se não tiver, oculta */}
                      <p className="text-xs text-zinc-500 capitalize">
                        {t.metodo_pagamento ? `${t.metodo_pagamento} • ` : ''} 
                        {new Date(t.date || t.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <p className={`font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {(t.amount || t.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Novo Lançamento</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white p-2 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button type="button" onClick={() => setTipo("despesa")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tipo === "despesa" ? "bg-red-500 text-white shadow-lg" : "text-zinc-500"}`}>Despesa</button>
                <button type="button" onClick={() => setTipo("receita")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tipo === "receita" ? "bg-emerald-500 text-white shadow-lg" : "text-zinc-500"}`}>Receita</button>
              </div>

              <input required type="text" placeholder="Descrição (ex: Grêmio Shop)" value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-zinc-500 outline-none" />
              <input required type="number" step="0.01" placeholder="Valor (R$)" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-zinc-500 outline-none" />

              <div className="flex gap-3">
                <select value={metodo} onChange={e => setMetodo(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white outline-none">
                  <option value="pix">PIX</option>
                  <option value="cartao_credito">Crédito</option>
                  <option value="debito">Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
                <input required type="date" value={data} onChange={e => setData(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white outline-none" />
              </div>

              <button type="submit" className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-zinc-200 active:scale-95 transition shadow-lg">
                Confirmar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}