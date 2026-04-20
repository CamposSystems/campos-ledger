"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { useRouter } from "next/navigation";

interface Transacao {
  id: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  date: string;
}

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [tipo, setTipo] = useState<"expense" | "income">("expense");

  const [userData, setUserData] = useState<{ familyId: string; profileId: string; nome: string } | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const buscarTransacoes = useCallback(async (familyId: string) => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("family_id", familyId)
        .order("date", { ascending: false })
        .limit(10);

      if (!error && data) {
        const linhas = data as Transacao[];
        setTransacoes(linhas);
        const saldoCalculado = linhas.reduce((acc: number, atual: Transacao) => {
          return atual.type === "income" ? acc + atual.amount : acc - atual.amount;
        }, 0);
        setSaldo(saldoCalculado);
      }
    } catch (err) {
      console.error("Erro ao buscar transações:", err);
    }
  }, []);

  useEffect(() => {
    const inicializarSistema = async () => {
      try {
        await supabase.auth.getSession();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, family_id, full_name")
          .eq("id", user.id)
          .limit(1);

        if (profileError) {
          alert(`Erro Supabase (iOS): Não foi possível carregar o perfil. Motivo: ${profileError.message}`);
          setIsLoading(false);
          return;
        }

        const profile = profileData && profileData.length > 0 ? profileData[0] : null;

        if (!profile) {
          alert("Aviso: Esta conta não possui um perfil financeiro. Provavelmente você logou com um e-mail/conta diferente do PC. Vamos voltar para o Login.");
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        setUserData({
          familyId: profile.family_id,
          profileId: profile.id,
          nome: profile.full_name || "Usuário",
        });

        await buscarTransacoes(profile.family_id);
      } catch (err: any) {
        alert(`Erro Inesperado: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    inicializarSistema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorLimpo = e.target.value.replace(/\D/g, "");
    if (valorLimpo === "") {
      setValor("");
      return;
    }
    const valorDecimal = Number(valorLimpo) / 100;
    const valorFormatado = valorDecimal.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setValor(valorFormatado);
  };

  const handleConfirmar = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    if (!userData) {
      alert("Alerta iOS [Perfil]: O seu perfil não carregou corretamente. Atualize a página.");
      return;
    }

    if (!categoria) {
      alert("Alerta iOS [Categoria]: Toque em uma categoria antes de confirmar.");
      return;
    }

    const digitos = String(valor).replace(/\D/g, "");
    const valorNumerico = Number(digitos) / 100;

    if (!valor || isNaN(valorNumerico) || valorNumerico <= 0) {
      alert(`Alerta iOS [Valor]: O valor lido pelo sistema foi R$ ${valorNumerico}. Digite um valor válido.`);
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("transactions").insert({
        family_id: userData.familyId,
        profile_id: userData.profileId,
        amount: valorNumerico,
        type: tipo,
        category: categoria,
        date: new Date().toISOString(),
      });

      if (error) throw error;

      setIsModalOpen(false);
      setValor("");
      setCategoria("");

      await buscarTransacoes(userData.familyId);
    } catch (error: any) {
      alert("Erro ao salvar no banco de dados: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const iconesCategoria: Record<string, string> = {
    lanche: "🍔",
    carro: "🚗",
    mercado: "🛒",
    outros: "➕",
  };

  const nomesCategoria: Record<string, string> = {
    lanche: "Lanche",
    carro: "Carro",
    mercado: "Mercado",
    outros: "Outros",
  };

  if (isLoading) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">A carregar o seu perfil...</div>;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex justify-center pb-20 relative overflow-hidden">
      <div className="w-full max-w-md p-6 flex flex-col gap-8 mt-4">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-gray-400 text-sm font-medium tracking-wider uppercase">Camp.OS Ledger</h1>
            <p className="text-2xl font-semibold mt-1 capitalize">Olá, {userData?.nome.split(".")[0] || "Visitante"} 👋</p>
          </div>
          <div
            className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center cursor-pointer hover:bg-neutral-700 transition-colors"
            onClick={() => supabase.auth.signOut().then(() => router.replace("/login"))}
            title="Sair"
          >
            <span className="text-xl">🚪</span>
          </div>
        </header>

        <section className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl">
          <p className="text-neutral-400 text-sm mb-1">Saldo Atual</p>
          <h2 className={`text-5xl font-light tracking-tight ${saldo < 0 ? "text-red-400" : "text-white"}`}>
            <span className="text-2xl text-neutral-500 mr-1">R$</span>
            {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </h2>
        </section>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-white text-black text-lg font-semibold py-4 rounded-2xl active:scale-95 transition-all"
        >
          + Lançar Movimentação
        </button>

        <section className="flex flex-col gap-4 mt-2">
          <h3 className="text-neutral-300 font-medium">Últimos Lançamentos</h3>

          {transacoes.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center mt-4">Nenhuma movimentação ainda.</p>
          ) : (
            transacoes.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xl">
                    {iconesCategoria[t.category] || "💸"}
                  </div>
                  <div>
                    <p className="font-medium text-white">{nomesCategoria[t.category] || "Transação"}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                </div>
                <p className={`font-medium ${t.type === "income" ? "text-green-500" : "text-white"}`}>
                  {t.type === "income" ? "+" : "-"} R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))
          )}
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>

          <div className="relative w-full max-w-md bg-neutral-900 border-t border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 pb-12 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div className="flex gap-2 bg-neutral-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTipo("expense")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tipo === "expense" ? "bg-neutral-700 text-white shadow" : "text-neutral-400"}`}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("income")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tipo === "income" ? "bg-green-600 text-white shadow" : "text-neutral-400"}`}
                >
                  Receita
                </button>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-neutral-500 p-2 text-xl hover:text-white">
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center justify-center mb-8">
              <p className="text-neutral-400 text-sm mb-2">{tipo === "expense" ? "Valor da despesa" : "Valor da receita"}</p>
              <div className="flex items-center justify-center text-5xl font-light">
                <span className={`${tipo === "expense" ? "text-neutral-500" : "text-green-500"} text-3xl mr-2`}>R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={valor}
                  onChange={handleValorChange}
                  placeholder="0,00"
                  className={`bg-transparent text-white outline-none w-full text-center placeholder:text-neutral-700 ${tipo === "income" && "text-green-400"}`}
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-8">
              <button
                type="button"
                onClick={() => setCategoria("lanche")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${categoria === "lanche" ? "bg-neutral-800 border-orange-500" : "bg-neutral-800/50 border-transparent hover:bg-neutral-800"}`}
              >
                <span className="text-2xl">🍔</span>
                <span className={`text-xs ${categoria === "lanche" ? "text-white" : "text-neutral-400"}`}>Lanche</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoria("carro")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${categoria === "carro" ? "bg-neutral-800 border-blue-500" : "bg-neutral-800/50 border-transparent hover:bg-neutral-800"}`}
              >
                <span className="text-2xl">🚗</span>
                <span className={`text-xs ${categoria === "carro" ? "text-white" : "text-neutral-400"}`}>Carro</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoria("mercado")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${categoria === "mercado" ? "bg-neutral-800 border-green-500" : "bg-neutral-800/50 border-transparent hover:bg-neutral-800"}`}
              >
                <span className="text-2xl">🛒</span>
                <span className={`text-xs ${categoria === "mercado" ? "text-white" : "text-neutral-400"}`}>Mercado</span>
              </button>

              <button
                type="button"
                onClick={() => setCategoria("outros")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${categoria === "outros" ? "bg-neutral-800 border-purple-500" : "bg-neutral-800/50 border-transparent hover:bg-neutral-800"}`}
              >
                <span className="text-2xl">➕</span>
                <span className={`text-xs ${categoria === "outros" ? "text-white" : "text-neutral-400"}`}>Outros</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleConfirmar}
              disabled={isSaving}
              className={`w-full text-white text-lg font-semibold py-4 rounded-2xl active:scale-95 transition-all ${
                isSaving ? "bg-neutral-600 cursor-not-allowed" : tipo === "income" ? "bg-green-600 hover:bg-green-500" : "bg-orange-500 hover:bg-orange-400"
              }`}
            >
              {isSaving ? "Processando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}