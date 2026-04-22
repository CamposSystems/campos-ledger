"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Calendar as CalendarIcon, CheckCircle2, AlertCircle, RefreshCw, Banknote } from "lucide-react";

/* =========================================================================
   ⚠️ ATENÇÃO CHARLES: NO SEU VS CODE E VERCEL, USE AS IMPORTAÇÕES REAIS:
   Descomente as duas linhas abaixo e apague o bloco MOCK a seguir.
========================================================================= */
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";



// INICIALIZAÇÃO DO SUPABASE
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function FaturasPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, family_id")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
        if (profile.family_id) {
          await loadData(profile.family_id);
        }
      }
    } catch (err) {
      console.error("Erro na inicialização:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadData(familyId: string) {
    try {
      const [cardsRes, accRes, txRes] = await Promise.all([
        supabase.from("credit_cards").select("*").eq("family_id", familyId).order("name"),
        supabase.from("accounts").select("*").eq("family_id", familyId),
        supabase.from("transactions").select("*").eq("family_id", familyId).eq("payment_method", "credit")
      ]);
      
      if (cardsRes.data) {
        setCreditCards(cardsRes.data);
        if (cardsRes.data.length > 0 && !selectedCardId) {
          setSelectedCardId(cardsRes.data[0].id);
        }
      }
      if (accRes.data) setAccounts(accRes.data);
      if (txRes.data) setAllTransactions(txRes.data);
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  }

  const selectedCard = creditCards.find(c => c.id === selectedCardId);
  const linkedAccount = accounts.find(a => a.id === selectedCard?.account_id);

  // Filtra as transações do cartão selecionado PARA O MÊS SELECIONADO
  const currentMonthTransactions = useMemo(() => {
    if (!selectedCardId) return [];
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    return allTransactions.filter(tx => {
      if (tx.credit_card_id !== selectedCardId) return false;
      const txDate = new Date(tx.date + "T12:00:00");
      return txDate.getFullYear() === year && txDate.getMonth() === month;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, selectedCardId, currentDate]);

  const invoiceStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let isClosed = false;

    currentMonthTransactions.forEach(tx => {
      const val = Number(tx.amount) || 0;
      total += val;
      if (tx.status === 'pending') pending += val;
    });

    if (selectedCard) {
      const today = new Date();
      const closingDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedCard.closing_day);
      if (today >= closingDate) isClosed = true;
    }

    return { total, pending, isClosed, allPaid: total > 0 && pending === 0 };
  }, [currentMonthTransactions, selectedCard, currentDate]);

  async function handlePayInvoice() {
    if (!selectedCard || !linkedAccount) return alert("Erro: Cartão ou conta não encontrada.");
    
    const pendingTxs = currentMonthTransactions.filter(t => t.status === 'pending');
    if (pendingTxs.length === 0) return alert("Não há valores pendentes nesta fatura para pagar.");

    const amountToPay = pendingTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const confirm = window.confirm(`Deseja registar o pagamento de R$ ${amountToPay.toFixed(2)} da sua conta ${linkedAccount.name}?`);
    
    if (!confirm) return;

    setBusy(true);
    try {
      // 1. Marcar todas as compras do cartão como pagas
      const txIds = pendingTxs.map(t => t.id);
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ status: 'completed' })
        .in('id', txIds);
      
      if (updateError) throw updateError;

      // 2. Lançar o pagamento na conta corrente real para abater o saldo
      const { error: insertError } = await supabase.from("transactions").insert([{
        family_id: userProfile.family_id,
        profile_id: userProfile.id,
        amount: amountToPay,
        type: 'expense',
        category: 'Pagamento de Cartão',
        description: `Pagamento Fatura ${selectedCard.name} (${MESES[currentDate.getMonth()]})`,
        date: new Date().toISOString().split("T")[0],
        payment_method: 'debit',
        status: 'completed',
        account_id: linkedAccount.id
      }]);

      if (insertError) throw insertError;

      alert("Fatura paga com sucesso! O valor foi debitado da sua conta.");
      await loadData(userProfile.family_id);
    } catch (err: any) {
      alert("Erro ao pagar fatura: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-10 h-10 text-zinc-600 animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse">A Carregar Faturas</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-24">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
              <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Gestor de</p>
              <p className="text-sm font-bold text-white tracking-tight">Faturas & Cartões</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        
        {/* SELETOR DE CARTÃO */}
        {creditCards.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {creditCards.map(card => (
              <button 
                key={card.id} 
                onClick={() => setSelectedCardId(card.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border whitespace-nowrap transition-all ${selectedCardId === card.id ? 'bg-purple-900/20 border-purple-500/50 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                <CreditCard className={`w-4 h-4 ${selectedCardId === card.id ? 'text-purple-400' : ''}`} />
                <span className="text-xs font-bold">{card.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 text-center">
            <p className="text-sm text-zinc-500 font-bold">Nenhum cartão registado.</p>
          </div>
        )}

        {selectedCard && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            <div className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800 p-2 rounded-2xl">
              <button onClick={prevMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-black tracking-tighter uppercase text-white">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
              </div>
              <button onClick={nextMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* CARD DA FATURA */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-[2rem] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <Receipt className="w-32 h-32" />
              </div>
              
              <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Total da Fatura</p>
                  <h2 className="text-4xl font-black text-white mt-1">
                    <span className="text-xl text-zinc-500 mr-1">R$</span>{invoiceStats.total.toFixed(2).replace('.', ',')}
                  </h2>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border ${invoiceStats.allPaid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : (invoiceStats.isClosed ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400')}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest">
                    {invoiceStats.allPaid ? 'Paga' : (invoiceStats.isClosed ? 'Fechada' : 'Aberta')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Vencimento</p>
                  <p className="text-sm font-bold text-zinc-300 flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-red-400"/> Dia {selectedCard.due_day}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Débito em Conta</p>
                  <p className="text-sm font-bold text-zinc-300 flex items-center gap-1 truncate"><Banknote className="w-3 h-3 text-emerald-400"/> {linkedAccount?.name || 'Não definida'}</p>
                </div>
              </div>

              {/* BOTÃO DE PAGAMENTO */}
              {!invoiceStats.allPaid && currentMonthTransactions.length > 0 && (
                <button 
                  onClick={handlePayInvoice}
                  disabled={busy}
                  className="w-full mt-6 bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl transition uppercase tracking-widest text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Pagar R$ {invoiceStats.pending.toFixed(2).replace('.', ',')}
                </button>
              )}
            </div>

            {/* LISTA DE COMPRAS */}
            <div>
              <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Detalhes da Fatura</h3>
              
              {currentMonthTransactions.length === 0 ? (
                 <div className="text-center py-8 bg-zinc-900/30 rounded-2xl border border-zinc-800 border-dashed">
                   <p className="text-sm text-zinc-500 font-bold">Nenhuma compra nesta fatura.</p>
                 </div>
              ) : (
                <div className="space-y-3">
                  {currentMonthTransactions.map(tx => {
                    const isPaid = tx.status === 'completed';
                    return (
                      <div key={tx.id} className={`flex justify-between items-center p-4 rounded-2xl border ${isPaid ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-zinc-900 border-zinc-800'}`}>
                        <div className="min-w-0 flex-1 pr-4">
                          <p className={`text-sm font-bold truncate ${isPaid ? 'text-zinc-500 line-through' : 'text-white'}`}>{tx.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{tx.date.split('-').reverse().join('/')}</span>
                            {tx.installments_total > 1 && (
                              <span className="text-[8px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black">
                                {tx.installment_current}/{tx.installments_total}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-sm font-black ${isPaid ? 'text-zinc-600' : 'text-zinc-300'}`}>R$ {Number(tx.amount).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}