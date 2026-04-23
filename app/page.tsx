"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, ArrowRight, Plus, Wallet, Target,
  TrendingUp, TrendingDown, Clock, CheckCircle2, 
  Settings, LogOut, ChevronDown, Calendar, 
  CreditCard, Banknote, ShieldAlert, RefreshCw, X, Star,
  Eye, EyeOff, BarChart3, Bot, Send, Mic, Search, Bell, AlertTriangle,
  PieChart, BrainCircuit, Receipt, AlertCircle, Repeat, Users, Pencil, User, ChevronUp, ArrowRightLeft
} from "lucide-react";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [isBalanceHidden, setIsBalanceHidden] = useState(true);
  const [showAccountsBreakdown, setShowAccountsBreakdown] = useState(false);
  
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAccountId, setAdjustAccountId] = useState("");
  const [newBalance, setNewBalance] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [modalType, setModalType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [installments, setInstallments] = useState("1");
  const [isPaid, setIsPaid] = useState(true);
  
  const [amountMode, setAmountMode] = useState<"total" | "installment">("total"); 
  const [isRecurring, setIsRecurring] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false); 

  const [isPayrollDeduction, setIsPayrollDeduction] = useState(false);
  const [deductionOwner, setDeductionOwner] = useState("");
  const [deductionItem, setDeductionItem] = useState("");
  const [deductionBeneficiary, setDeductionBeneficiary] = useState("");
  
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");

  const [editingTx, setEditingTx] = useState<any>(null); 

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (userProfile?.family_id) {
      fetchMonthlyTransactions(userProfile.family_id, currentDate);
    }
  }, [currentDate, userProfile]);

  async function initApp() {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) return router.push("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, family_id, email")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserProfile(profile);
        if (profile.family_id) {
          await Promise.all([
            fetchAuxiliaryData(profile.family_id),
            fetchMonthlyTransactions(profile.family_id, currentDate),
            fetchAllTransactions(profile.family_id)
          ]);
        }
      }
    } catch (err) {
      console.error("Erro na inicialização:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAuxiliaryData(familyId: string) {
    try {
      const [accRes, cardsRes, catsRes, membersRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("family_id", familyId).order("name"),
        supabase.from("credit_cards").select("*").eq("family_id", familyId).order("name"),
        supabase.from("categories").select("*").eq("family_id", familyId).order("name"),
        supabase.from("profiles").select("id, display_name").eq("family_id", familyId)
      ]);
      
      if (accRes.data) {
        setAccounts(accRes.data);
        const defAcc = accRes.data.find((a: any) => a.is_default) || accRes.data[0];
        if (defAcc) setSelectedAccountId(defAcc.id);
      }
      
      if (cardsRes.data) {
        setCreditCards(cardsRes.data);
        const defCard = cardsRes.data.find((c: any) => c.is_default) || cardsRes.data[0];
        if (defCard) setSelectedCardId(defCard.id);
      }

      if (catsRes.data) setCategories(catsRes.data);
      if (membersRes.data) setFamilyMembers(membersRes.data);
      
    } catch (e) {
      console.error("Erro ao carregar dados auxiliares:", e);
    }
  }

  async function fetchMonthlyTransactions(familyId: string, dateObj: Date) {
    const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).toISOString();
    const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data) setTransactions(data);
  }

  async function fetchAllTransactions(familyId: string) {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", familyId);
      
    if (data) setAllTransactions(data);
  }

  function parseCurrency(value: string) {
    if (!value) return 0;
    const cleanValue = value.toString().replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  function maskValue(value: number) {
    if (isBalanceHidden) return "••••••";
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleSaveTransaction() {
    if (!userProfile?.family_id) return alert("Você precisa estar vinculado a uma família.");
    
    if (modalType === "transfer" && (!selectedAccountId || !destinationAccountId)) return alert("Selecione as contas de origem e destino.");
    if (modalType === "transfer" && selectedAccountId === destinationAccountId) return alert("A conta de destino deve ser diferente da origem.");
    
    const isCredit = paymentMethod === 'credit';
    if (isCredit && !selectedCardId) return alert("Nenhum cartão de crédito selecionado.");
    if (!isCredit && !selectedAccountId) return alert("Nenhuma conta selecionada.");

    const numAmount = parseCurrency(amount);
    
    setBusy(true);

    const selectedCat = categories.find(c => c.id === categoryId);
    const totalInstallments = parseInt(installments) || 1;
    
    let installmentAmount = numAmount;
    if (totalInstallments > 1 && !isRecurring) {
      if (amountMode === "total") {
        installmentAmount = Number((numAmount / totalInstallments).toFixed(2));
      } else {
        installmentAmount = numAmount; 
      }
    }
    
    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const parentId = generateUUID();

    let finalNotes = null;
    if (modalType === 'expense' && isPayrollDeduction) {
      const ownerName = familyMembers.find(m => m.id === deductionOwner)?.display_name || 'Desconhecido';
      finalNotes = `De: ${ownerName}`;
      if (deductionItem) finalNotes += ` | Item: ${deductionItem.trim()}`;
      if (deductionBeneficiary) finalNotes += ` | Para: ${deductionBeneficiary.trim()}`;
    }

    const rowsToInsert = [];

    for (let i = 0; i < totalInstallments; i++) {
      let rowDate = new Date(transactionDate + "T12:00:00");
      let rowStatus = "pending"; 
      
      if (!isCredit && paymentMethod !== 'carne') {
        rowStatus = (i === 0) ? (isPaid ? "completed" : "pending") : "pending";
      }

      rowDate.setMonth(rowDate.getMonth() + i);
      
      let rowDesc = description.trim() || (modalType === 'transfer' ? 'Transferência' : (selectedCat?.name || "Lançamento"));
      if (totalInstallments > 1) {
        rowDesc = isRecurring ? `${rowDesc} (Mês ${i + 1}/${totalInstallments})` : `${rowDesc} (${i + 1}/${totalInstallments})`;
      }

      const safeYear = rowDate.getFullYear();
      const safeMonth = String(rowDate.getMonth() + 1).padStart(2, '0');
      const safeDay = String(rowDate.getDate()).padStart(2, '0');
      const finalDateStr = `${safeYear}-${safeMonth}-${safeDay}`;

      const baseTx = {
        family_id: userProfile.family_id,
        profile_id: userProfile.id,
        amount: installmentAmount,
        type: modalType === 'transfer' ? 'expense' : modalType,
        category_id: modalType === 'transfer' ? null : categoryId,
        category: modalType === 'transfer' ? 'Transferência' : (selectedCat?.name || 'Geral'), 
        description: rowDesc,
        date: finalDateStr,
        payment_method: paymentMethod,
        status: rowStatus,
        installment_current: i + 1,
        installments_total: totalInstallments,
        parent_transaction_id: totalInstallments > 1 ? parentId : null,
        account_id: !isCredit ? selectedAccountId : null,
        credit_card_id: isCredit ? selectedCardId : null,
        is_payroll_deduction: modalType === 'expense' ? isPayrollDeduction : false,
        notes: finalNotes
      };

      rowsToInsert.push(baseTx);

      // Se for transferência, cria a perna de "Entrada" na conta de destino
      if (modalType === 'transfer') {
         rowsToInsert.push({
           ...baseTx,
           type: 'income',
           account_id: destinationAccountId, // Conta de entrada
           description: `${rowDesc} (Recebimento)`,
           notes: null
         });
      }
    }

    try {
      const { error } = await supabase.from("transactions").insert(rowsToInsert);
      if (error) throw error;

      setIsModalOpen(false);
      resetModal();
      
      await Promise.all([
        fetchMonthlyTransactions(userProfile.family_id, currentDate),
        fetchAllTransactions(userProfile.family_id)
      ]);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTx) return;

    setBusy(true);
    const numAmount = parseCurrency(editingTx.amount);
    
    try {
      const { error } = await supabase.from("transactions").update({
        amount: numAmount,
        description: editingTx.description,
        date: editingTx.date
      }).eq("id", editingTx.id);

      if (error) throw error;

      setEditingTx(null);
      await Promise.all([
        fetchMonthlyTransactions(userProfile.family_id, currentDate),
        fetchAllTransactions(userProfile.family_id)
      ]);
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjustBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustAccountId) return alert("Selecione uma conta.");
    
    const newDesiredBalance = parseCurrency(newBalance);
    if (isNaN(newDesiredBalance)) return alert("Valor inválido.");

    setBusy(true);
    try {
      let currentAccBalance = Number(accounts.find(a => a.id === adjustAccountId)?.initial_balance) || 0;
      
      allTransactions.forEach(t => {
        if (t.account_id === adjustAccountId && t.status === 'completed' && t.payment_method !== 'credit') {
          if (t.type === 'income') currentAccBalance += Number(t.amount);
          if (t.type === 'expense') currentAccBalance -= Number(t.amount);
        }
      });

      const difference = newDesiredBalance - currentAccBalance;
      if (Math.abs(difference) < 0.01) {
        alert("O saldo informado já é igual ao saldo atual da conta.");
        return;
      }

      const { error } = await supabase.from("transactions").insert([{
        family_id: userProfile.family_id,
        profile_id: userProfile.id,
        amount: Math.abs(difference),
        type: difference > 0 ? 'income' : 'expense',
        category: 'Ajuste de Saldo',
        description: 'Ajuste Manual de Saldo',
        date: new Date().toISOString().split("T")[0],
        payment_method: 'pix',
        status: 'completed',
        account_id: adjustAccountId
      }]);

      if (error) throw error;

      setShowAdjustModal(false);
      setNewBalance("");
      
      await Promise.all([
        fetchMonthlyTransactions(userProfile.family_id, currentDate),
        fetchAllTransactions(userProfile.family_id)
      ]);
    } catch (err: any) {
      alert("Erro ao ajustar saldo: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTransactionStatus(tx: any) {
    const newStatus = tx.status === 'completed' ? 'pending' : 'completed';
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: newStatus } : t));

    const { error } = await supabase.from("transactions").update({ status: newStatus }).eq("id", tx.id);
    if (error) {
      fetchMonthlyTransactions(userProfile.family_id, currentDate);
    } else {
      fetchMonthlyTransactions(userProfile.family_id, currentDate);
      fetchAllTransactions(userProfile.family_id); 
    }
  }

  function resetModal() {
    setModalStep(1);
    setAmount("");
    setDescription("");
    setCategoryId("");
    setInstallments("1");
    setPaymentMethod("pix");
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setIsPaid(true);
    setIsPayrollDeduction(false);
    setDeductionOwner("");
    setDeductionItem("");
    setDeductionBeneficiary("");
    setIsRecurring(false);
    setAmountMode("total");
  }

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const isCurrentMonth = currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

  const calculations = useMemo(() => {
    let realBalance = accounts.reduce((acc, curr) => acc + (Number(curr.initial_balance) || 0), 0);
    
    allTransactions.forEach(t => {
      if (t.payment_method === 'credit') return; 
      if (t.status !== 'completed') return;
      
      const val = Number(t.amount) || 0;
      if (t.type === 'income') realBalance += val;
      if (t.type === 'expense') realBalance -= val;
    });

    let monthlyIncome = 0; 
    let monthlyExpense = 0; 
    let pendingExpense = 0;
    
    transactions.forEach(t => {
      const val = Number(t.amount) || 0;
      if (t.type === 'income') { 
        monthlyIncome += val; 
      } else { 
        monthlyExpense += val; 
        if (t.status === 'pending') {
          pendingExpense += val;
        } 
      }
    });

    return { 
      realBalance,
      monthlyIncome, 
      monthlyExpense, 
      pendingExpense
    };
  }, [transactions, allTransactions, accounts]);

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    accounts.forEach(acc => balances[acc.id] = Number(acc.initial_balance) || 0);

    allTransactions.forEach(t => {
      if (t.payment_method === 'credit' || t.status !== 'completed' || !t.account_id) return;
      const val = Number(t.amount) || 0;
      if (t.type === 'income') balances[t.account_id] += val;
      if (t.type === 'expense') balances[t.account_id] -= val;
    });

    return accounts.map(acc => ({
      ...acc,
      currentBalance: balances[acc.id] || 0
    }));
  }, [accounts, allTransactions]);

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    transactions.forEach(t => {
      const dateStr = t.date.split('T')[0].split(' ')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(t);
    });
    return Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => ({
      date, items: groups[date]
    }));
  }, [transactions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white space-y-4">
        <RefreshCw className="w-10 h-10 text-zinc-600 animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse">Iniciando Ledger</p>
      </div>
    );
  }

  if (!userProfile?.family_id) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-yellow-500 mb-6" />
        <h2 className="text-3xl font-black mb-2 tracking-tighter">Acesso Restrito</h2>
        <p className="text-zinc-400 mb-8 max-w-xs">Você precisa criar ou entrar num Núcleo Familiar para usar o Dashboard financeiro.</p>
        <button onClick={() => router.push("/admin")} className="bg-white text-black font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl hover:bg-zinc-200">
          Ir para Administração
        </button>
      </div>
    );
  }

  const currentCats = categories.filter(c => c.type === modalType);
  const favoriteCats = currentCats.filter(c => c.is_favorite);
  const parentCats = currentCats.filter(c => !c.parent_id);

  async function handleSendReportEmail() {
    if (!userProfile?.email) return alert("O seu perfil não tem um e-mail válido associado.");
    
    setSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userProfile.email,
          family_id: userProfile.family_id,
          subject: `📊 Seu Relatório Camp.OS Ledger - ${new Date().toLocaleDateString('pt-BR')}`,
          name: userProfile.display_name?.split(' ')[0] || 'Usuário',
          balance: calculations.realBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2}),
          income: calculations.monthlyIncome.toLocaleString('pt-BR', {minimumFractionDigits: 2}),
          expense: calculations.monthlyExpense.toLocaleString('pt-BR', {minimumFractionDigits: 2})
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha desconhecida na API");
      }
      
      alert("Relatório Premium enviado para o seu e-mail com sucesso! Verifique a sua caixa de entrada.");
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao enviar o e-mail: ${err.message}\nVerifique se as variáveis SMTP_EMAIL e SMTP_PASS estão configuradas na Vercel.`);
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 pb-24">
      
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center border border-zinc-800 cursor-pointer" onClick={() => setIsBalanceHidden(!isBalanceHidden)}>
              {isBalanceHidden ? <EyeOff className="w-5 h-5 text-zinc-500" /> : <Eye className="w-5 h-5 text-white" />}
            </div>
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Camp.OS Ledger</p>
              <p className="text-sm font-bold text-white tracking-tight">Olá, {userProfile?.display_name?.split(' ')[0]}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={handleSendReportEmail} disabled={sendingEmail} className="p-2.5 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-xl transition disabled:opacity-50" title="Receber Relatório por E-mail">
              {sendingEmail ? <RefreshCw className="w-5 h-5 animate-spin text-yellow-500" /> : <Bell className="w-5 h-5" />}
            </button>
            <button onClick={() => router.push("/categorias")} className="p-2.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition" title="Gerir Categorias">
              <Calendar className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/contas")} className="p-2.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition" title="Gerir Contas e Cartões">
              <Banknote className="w-5 h-5" />
            </button>
            <button onClick={() => router.push("/admin")} className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="p-2.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 p-2 rounded-2xl">
          <button onClick={prevMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex flex-col items-center cursor-pointer" onClick={() => setCurrentDate(new Date())}>
            <span className="text-sm font-black tracking-tighter uppercase">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            {!isCurrentMonth && <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Voltar ao Hoje</span>}
          </div>
          <button onClick={nextMonth} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <section className="space-y-3">
          
          <div 
            onClick={() => setShowAccountsBreakdown(!showAccountsBreakdown)}
            className="cursor-pointer bg-zinc-900 rounded-[2rem] p-6 border border-zinc-800 relative overflow-hidden group transition-all"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-start justify-between relative z-10">
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Wallet className="w-3 h-3" /> Saldo Real Consolidado
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdjustAccountId(accounts[0]?.id || "");
                    setShowAdjustModal(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-zinc-300 text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded"
                >
                  Ajustar
                </button>
                {showAccountsBreakdown ? <ChevronUp className="w-4 h-4 text-zinc-500"/> : <ChevronDown className="w-4 h-4 text-zinc-500"/>}
              </div>
            </div>

            <h2 className={`text-4xl sm:text-5xl font-black mt-2 tracking-tighter relative z-10 ${calculations.realBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              <span className="text-xl sm:text-2xl text-zinc-500 mr-1">R$</span>
              {maskValue(calculations.realBalance)}
            </h2>
            
            {showAccountsBreakdown && (
              <div className="mt-6 pt-4 border-t border-zinc-800/50 space-y-3 relative z-10 animate-in fade-in slide-in-from-top-2">
                {accountBalances.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-400 flex items-center gap-2"><Banknote className="w-3 h-3"/> {acc.name}</span>
                    <span className={`text-xs font-black ${acc.currentBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
                      R$ {maskValue(acc.currentBalance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/50 rounded-3xl p-5 border border-zinc-800 flex flex-col justify-between">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 text-emerald-500">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Entrou no Mês</p>
              <p className="text-lg font-black text-emerald-400 tracking-tighter truncate">
                R$ {maskValue(calculations.monthlyIncome)}
              </p>
            </div>
            
            <div className="bg-zinc-900/50 rounded-3xl p-5 border border-zinc-800 flex flex-col justify-between">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center mb-3 text-red-500">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.1em]">Saiu no Mês</p>
              <p className="text-lg font-black text-white tracking-tighter truncate">
                R$ {maskValue(calculations.monthlyExpense)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
             <button onClick={() => router.push("/planejamento")} className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition group shadow-lg">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                   <Target className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white mt-1 text-center leading-tight">Metas<br/>& Previsto</span>
             </button>
             <button onClick={() => router.push("/analytics")} className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition group shadow-lg">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition">
                   <PieChart className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white mt-1 text-center leading-tight">Dashboard<br/>Analítico</span>
             </button>
             <button onClick={() => router.push("/faturas")} className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 transition group shadow-lg">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition">
                   <Receipt className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white mt-1 text-center leading-tight">Faturas<br/>& Cartões</span>
             </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Movimentações do Mês</h3>
            <span className="text-[10px] text-zinc-600 font-mono">{transactions.length} registros</span>
          </div>

          <div className="space-y-6">
            {groupedTransactions.length === 0 ? (
              <div className="text-center py-10 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
                <Calendar className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-500">Nenhum lançamento neste mês.</p>
              </div>
            ) : (
              groupedTransactions.map((group) => {
                const dateParts = group.date ? group.date.split('-') : [];
                let dateLabel = "DATA INVÁLIDA";
                let isToday = false;
                
                if (dateParts.length === 3) {
                   const y = parseInt(dateParts[0]);
                   const m = parseInt(dateParts[1]) - 1;
                   const d = parseInt(dateParts[2]);
                   const dateObj = new Date(y, m, d, 12, 0, 0); 
                   dateLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
                   
                   const today = new Date();
                   isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
                }
                
                return (
                  <div key={group.date} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-px bg-zinc-800 flex-1"></div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${isToday ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>
                        {isToday ? "Hoje" : dateLabel}
                      </span>
                      <div className="h-px bg-zinc-800 flex-1"></div>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((tx) => {
                        const isIncome = tx.type === 'income';
                        const isCompleted = tx.status === 'completed';
                        
                        const catInfo = categories.find(c => c.id === tx.category_id);
                        const parentCat = catInfo?.parent_id ? categories.find(c => c.id === catInfo.parent_id) : null;
                        const themeColor = parentCat?.color || catInfo?.color || 'zinc';
                        const creatorName = familyMembers.find(m => m.id === tx.profile_id)?.display_name?.split(' ')[0] || 'Auto';

                        return (
                          <div key={tx.id} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${isCompleted ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700' : 'bg-zinc-950 border-amber-500/20 border-dashed opacity-80'}`}>
                            
                            <div className={`w-12 h-12 shrink-0 rounded-[1.1rem] bg-${themeColor}-500/10 text-${themeColor}-500 border border-${themeColor}-500/20 flex items-center justify-center text-xl overflow-hidden`}>
                              {catInfo?.logo_url ? <img src={catInfo.logo_url} alt="Logo" className="w-full h-full object-cover" /> : (catInfo?.icon || '📦')}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-black text-sm truncate ${isCompleted ? 'text-zinc-100' : 'text-amber-500/90'}`}>
                                  {tx.description}
                                </p>
                                {!isCompleted && <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase">Previsto</span>}
                              </div>
                              {tx.notes && (
                                <p className="text-[10px] text-amber-500/80 truncate mt-0.5 font-medium">
                                  ↳ {tx.notes}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isIncome ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                  {catInfo?.name || "Transferência"}
                                </span>
                                <span className="text-[8px] bg-zinc-800/50 text-zinc-400 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <User className="w-2.5 h-2.5"/> {creatorName}
                                </span>
                                {tx.account_id && accounts.find(a => a.id === tx.account_id) && (
                                  <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Banknote className="w-2.5 h-2.5"/> {accounts.find(a => a.id === tx.account_id)?.name}
                                  </span>
                                )}
                                {tx.credit_card_id && creditCards.find(c => c.id === tx.credit_card_id) && (
                                  <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <CreditCard className="w-2.5 h-2.5"/> {creditCards.find(c => c.id === tx.credit_card_id)?.name}
                                  </span>
                                )}
                                {tx.installments_total > 1 && (
                                  <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                                    {tx.installment_current}/{tx.installments_total}
                                  </span>
                                )}
                                {tx.is_payroll_deduction && (
                                  <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                    Desconto em Folha
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <p className={`font-black text-sm tracking-tight ${isIncome ? 'text-emerald-400' : (isCompleted ? 'text-white' : 'text-zinc-400')}`}>
                                {isIncome ? '+' : '-'} R$ {maskValue(tx.amount)}
                              </p>
                              
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setEditingTx({ ...tx, amount: String(tx.amount).replace(".", ",") })}
                                  className="p-1 bg-zinc-800 text-zinc-400 hover:text-white rounded-md transition-colors"
                                  title="Editar Lançamento"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => toggleTransactionStatus(tx)}
                                  className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${isCompleted ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'}`}
                                >
                                  {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {isCompleted ? "Pago" : "Pend."}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

      </main>

      <div className="fixed bottom-6 left-0 right-0 px-4 z-40 max-w-md mx-auto pointer-events-none flex gap-3">
        <button onClick={() => router.push("/ia")} className="w-14 h-14 bg-indigo-600 text-white rounded-[1.5rem] hover:bg-indigo-500 active:scale-95 transition-all shadow-lg flex items-center justify-center shrink-0 pointer-events-auto group relative overflow-hidden">
          <div className="absolute inset-0 bg-white/20 translate-y-10 group-hover:translate-y-0 transition-transform"></div>
          <BrainCircuit className="w-6 h-6 relative z-10 group-hover:animate-pulse" />
        </button>
        <button onClick={() => setIsModalOpen(true)} className="flex-1 bg-white text-black font-black py-4 rounded-[1.5rem] hover:bg-zinc-200 active:scale-95 transition-all text-sm uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 pointer-events-auto">
          <Plus className="w-5 h-5" /> Lançar
        </button>
      </div>

      {/* MODAL DE EDIÇÃO DE TRANSAÇÃO */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-sm relative">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Editar Lançamento</h3>
                <button onClick={() => setEditingTx(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Altere os dados desta parcela específica.</p>
              
              <form onSubmit={handleUpdateTransaction} className="space-y-4">
                 <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Valor (R$)</label>
                    <input 
                      required 
                      type="text" 
                      inputMode="decimal"
                      value={editingTx.amount}
                      onChange={e => setEditingTx({...editingTx, amount: e.target.value})}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Descrição</label>
                    <input 
                      required 
                      type="text" 
                      value={editingTx.description}
                      onChange={e => setEditingTx({...editingTx, description: e.target.value})}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    />
                 </div>
                 <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Data</label>
                    <input 
                      required 
                      type="date" 
                      value={editingTx.date}
                      onChange={e => setEditingTx({...editingTx, date: e.target.value})}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    />
                 </div>
                 <button type="submit" disabled={busy} className="w-full bg-emerald-500/20 text-emerald-400 font-black py-4 rounded-xl hover:bg-emerald-500/30 transition uppercase tracking-widest text-xs mt-4">
                  {busy ? "Salvando..." : "Atualizar Parcela"}
                </button>
              </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE DE SALDO */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-sm relative">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Ajustar Saldo</h3>
                <button onClick={() => setShowAdjustModal(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Ajuste o saldo para corrigir diferenças. O sistema criará uma transação de compensação automaticamente.</p>
              
              <form onSubmit={handleAdjustBalance} className="space-y-6">
                 <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Conta a Ajustar</label>
                    <select 
                      required
                      value={adjustAccountId}
                      onChange={(e) => setAdjustAccountId(e.target.value)}
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">Selecione...</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Saldo Real e Correto (R$)</label>
                    <input 
                      required 
                      type="text" 
                      inputMode="decimal"
                      value={newBalance}
                      onChange={e => setNewBalance(e.target.value)}
                      placeholder="0,00"
                      className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none"
                    />
                 </div>
                 <button type="submit" disabled={busy} className="w-full bg-emerald-500/20 text-emerald-400 font-black py-4 rounded-xl hover:bg-emerald-500/30 transition uppercase tracking-widest text-xs mt-4">
                  {busy ? "Ajustando..." : "Confirmar Novo Saldo"}
                </button>
              </form>
          </div>
        </div>
      )}

      {/* MODAL DE TRANSAÇÃO (DIVIDIDO EM 2 PASSOS) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-200 sm:p-4 pointer-events-auto">
          <div className="flex-1 bg-zinc-950 sm:max-w-lg sm:mx-auto sm:rounded-[3rem] w-full flex flex-col overflow-hidden relative">
            <div className="px-6 pt-6 pb-4 flex justify-between items-center border-b border-zinc-900">
              <div className="flex items-center gap-3">
                {modalStep === 2 && (
                  <button type="button" onClick={() => setModalStep(1)} className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 rounded-full flex items-center justify-center transition">
                    <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
                  </button>
                )}
                <h2 className="text-2xl font-black italic">NOVO REGISTRO</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
              <form id="tx-form" onSubmit={(e) => {
                e.preventDefault();
                if (modalStep === 1) {
                  if (modalType !== "transfer" && !categoryId) return alert("Selecione uma categoria para o lançamento.");
                  if (parseCurrency(amount) <= 0) return alert("Insira um valor válido.");
                  if (modalType === 'expense' && isPayrollDeduction && !deductionOwner) return alert("Selecione de quem será o desconto em folha.");
                  setModalStep(2);
                } else {
                  handleSaveTransaction();
                }
              }} className="space-y-8">
                
                {/* =======================
                    PASSO 1: VALOR E CATEGORIA 
                    ======================= */}
                {modalStep === 1 && (
                  <div className="animate-in slide-in-from-left-4 fade-in">
                    <div className="flex bg-zinc-900 p-1.5 rounded-2xl mb-8">
                      <button type="button" onClick={() => {setModalType("expense"); setCategoryId(""); setPaymentMethod("credit"); setIsPayrollDeduction(false);}} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${modalType === "expense" ? "bg-zinc-800 text-white shadow-md" : "text-zinc-500"}`}>Despesa</button>
                      <button type="button" onClick={() => {setModalType("income"); setCategoryId(""); setPaymentMethod("pix"); setIsPayrollDeduction(false);}} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${modalType === "income" ? "bg-emerald-600 text-white shadow-md" : "text-zinc-500"}`}>Receita</button>
                      <button type="button" onClick={() => {setModalType("transfer"); setCategoryId("transfer"); setPaymentMethod("pix"); setIsPayrollDeduction(false);}} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${modalType === "transfer" ? "bg-blue-600 text-white shadow-md" : "text-zinc-500"}`}>Transf.</button>
                    </div>
                    
                    <div className="flex flex-col items-center mb-8">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Valor</p>
                      <div className="flex items-end justify-center"><span className="text-3xl text-zinc-600 font-black mb-1 mr-2">R$</span><input required autoFocus type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} className={`bg-transparent text-center text-6xl font-black focus:outline-none placeholder-zinc-800 w-full max-w-[250px] ${modalType === 'income' ? 'text-emerald-400' : 'text-white'}`} /></div>
                    </div>

                    {modalType === "expense" && (
                      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl space-y-4 mb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500"><Users className="w-4 h-4"/></div>
                            <div>
                              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Desconto em Folha</p>
                              <p className="text-[9px] text-zinc-500 font-medium">Debitado do salário de alguém.</p>
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isPayrollDeduction} 
                            onChange={(e) => setIsPayrollDeduction(e.target.checked)} 
                            className="w-5 h-5 accent-amber-500 bg-zinc-900 border-zinc-700 rounded" 
                          />
                        </div>
                        
                        {isPayrollDeduction && (
                          <div className="pt-4 border-t border-amber-500/10 grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2">
                            <div>
                              <label className="text-[9px] text-amber-500/70 font-bold uppercase tracking-widest ml-1">De quem descontar?</label>
                              <select 
                                required={isPayrollDeduction}
                                value={deductionOwner}
                                onChange={(e) => setDeductionOwner(e.target.value)}
                                className="w-full mt-1 bg-zinc-950/50 border border-amber-500/20 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-amber-500/50 appearance-none"
                              >
                                <option value="">Selecione o membro...</option>
                                {familyMembers.map(m => (
                                  <option key={m.id} value={m.id}>{m.display_name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] text-amber-500/70 font-bold uppercase tracking-widest ml-1">O que foi comprado?</label>
                                <input 
                                  type="text" 
                                  placeholder="Ex: Tênis..." 
                                  value={deductionItem} 
                                  onChange={(e) => setDeductionItem(e.target.value)} 
                                  className="w-full mt-1 bg-zinc-950/50 border border-amber-500/20 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-amber-500/50" 
                                  required={isPayrollDeduction}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-amber-500/70 font-bold uppercase tracking-widest ml-1">Para quem? (Op)</label>
                                <input 
                                  type="text" 
                                  placeholder="Ex: João" 
                                  value={deductionBeneficiary} 
                                  onChange={(e) => setDeductionBeneficiary(e.target.value)} 
                                  className="w-full mt-1 bg-zinc-950/50 border border-amber-500/20 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-amber-500/50" 
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {modalType !== "transfer" && (
                      <div className="space-y-6 max-h-[35vh] overflow-y-auto no-scrollbar pb-4 pr-1">
                        {favoriteCats.length > 0 && (
                          <div><p className="text-[10px] text-yellow-500 font-bold uppercase mb-3 flex items-center gap-1.5"><Star className="w-3 h-3 fill-yellow-500" /> Destaques</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{favoriteCats.map((cat) => (<button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all ${categoryId === cat.id ? `bg-zinc-800 border-yellow-500 shadow-md` : `bg-zinc-950 border-zinc-900/80`}`}><div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">{cat.logo_url ? <img src={cat.logo_url} className="w-full h-full object-cover" /> : <span className="text-2xl">{cat.icon}</span>}</div><span className={`text-[8px] font-bold uppercase tracking-tight text-center leading-tight line-clamp-2 w-full ${categoryId === cat.id ? 'text-white' : 'text-zinc-500'}`}>{cat.name}</span></button>))}</div></div>
                        )}
                        {parentCats.map((parent) => {
                          const children = currentCats.filter(c => c.parent_id === parent.id);
                          if (children.length === 0) return null;
                          return (<div key={parent.id}><p className="text-[10px] text-zinc-500 font-bold uppercase mb-3 flex items-center gap-1.5"><span>{parent.icon}</span> {parent.name}</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{children.map((cat) => (<button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all ${categoryId === cat.id ? `bg-zinc-800 border-zinc-500 shadow-md` : `bg-zinc-950 border-zinc-900/80`}`}><div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">{cat.logo_url ? <img src={cat.logo_url} className="w-full h-full object-cover" /> : <span className="text-2xl">{cat.icon}</span>}</div><span className={`text-[8px] font-bold uppercase text-center leading-tight line-clamp-2 w-full ${categoryId === cat.id ? 'text-white' : 'text-zinc-500'}`}>{cat.name}</span></button>))}</div></div>);
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* =======================
                    PASSO 2: PAGAMENTO E DATAS 
                    ======================= */}
                {modalStep === 2 && (
                  <div className="animate-in slide-in-from-right-4 fade-in space-y-6">
                    
                    <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
                       <p className="text-[10px] text-zinc-400 font-bold uppercase mb-3">Método de Pagamento</p>
                       <select value={paymentMethod} onChange={(e) => {
                         setPaymentMethod(e.target.value);
                         if (e.target.value !== 'credit' && e.target.value !== 'carne') setInstallments("1");
                       }} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white font-bold outline-none appearance-none focus:border-indigo-500 transition-colors">
                          <option value="pix">PIX</option>
                          <option value="debit">Cartão de Débito</option>
                          {modalType !== 'transfer' && <option value="credit">Cartão de Crédito</option>}
                          <option value="auto_debit">Débito Automático (Água, Luz...)</option>
                          {modalType !== 'transfer' && <option value="carne">Carnê / Boleto Parcelado</option>}
                          <option value="cash">Dinheiro Vivo</option>
                       </select>
                    </div>

                    {modalType === 'transfer' ? (
                       <div className="grid grid-cols-2 gap-3 bg-blue-900/10 p-4 rounded-2xl border border-blue-900/30">
                          <div>
                             <p className="text-[10px] text-blue-400 font-bold uppercase mb-2 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3"/> Origem (Sai)</p>
                             <select required value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full bg-zinc-950 border border-blue-900/50 rounded-xl px-3 py-3 text-sm text-white outline-none appearance-none font-bold">
                               <option value="">Selecione...</option>
                               {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <p className="text-[10px] text-emerald-400 font-bold uppercase mb-2">Destino (Entra)</p>
                             <select required value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className="w-full bg-zinc-950 border border-emerald-900/50 rounded-xl px-3 py-3 text-sm text-white outline-none appearance-none font-bold">
                               <option value="">Selecione...</option>
                               {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                             </select>
                          </div>
                       </div>
                    ) : (
                       <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                           <p className="text-[10px] text-zinc-500 font-bold uppercase mb-3">{paymentMethod === 'credit' ? 'Qual Cartão?' : 'Debitar/Creditar em qual conta?'}</p>
                           {paymentMethod === 'credit' ? (
                              <select required value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)} className="w-full bg-purple-900/20 text-purple-400 border border-purple-900/50 rounded-xl px-4 py-3 text-sm outline-none appearance-none font-bold">
                                <option value="">Escolha um cartão...</option>
                                {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                           ) : (
                              <select required value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none font-bold">
                                <option value="">Escolha uma conta...</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                           )}
                       </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                       <div className="col-span-2"><p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Data da Compra / Vencimento</p><input required type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none" /></div>
                       
                       {(paymentMethod === 'credit' || paymentMethod === 'carne') && (
                         <>
                           <div className="col-span-2">
                             <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Parcelas (Qtd)</p>
                             <input type="number" min="1" max="120" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder="Ex: 5" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" />
                           </div>
                           {parseInt(installments) > 1 && (
                             <div className="col-span-2 flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1 mt-1">
                               <button type="button" onClick={() => setAmountMode("total")} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-colors ${amountMode === 'total' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}>O valor R$ {amount} é o TOTAL</button>
                               <button type="button" onClick={() => setAmountMode("installment")} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-colors ${amountMode === 'installment' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}>O valor R$ {amount} é a PARCELA</button>
                             </div>
                           )}
                         </>
                       )}

                       {(paymentMethod !== 'credit' && paymentMethod !== 'carne') && (
                          <div className="col-span-2 flex items-center justify-between bg-zinc-900 p-4 rounded-xl border border-zinc-800 mt-2">
                             <div>
                                <p className="text-sm font-bold text-white flex items-center gap-1.5"><Repeat className="w-4 h-4 text-indigo-500" /> Repetição Fixa</p>
                                <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Projetar meses futuros</p>
                             </div>
                             <input type="checkbox" checked={isRecurring} onChange={e=>setIsRecurring(e.target.checked)} className="w-5 h-5 accent-indigo-500 bg-zinc-900 border-zinc-700 rounded" />
                          </div>
                       )}
                    </div>

                    {isRecurring && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
                           <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Por quantos meses quer projetar?</p>
                           <input type="number" min="1" max="120" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder="Ex: 12" className="w-full bg-zinc-950 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm text-indigo-300 outline-none focus:border-indigo-500" />
                        </div>
                    )}

                    {paymentMethod !== 'credit' && paymentMethod !== 'carne' && (
                      <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 mt-4">
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-1.5"><CheckCircle2 className={`w-4 h-4 ${isPaid ? 'text-emerald-500' : 'text-zinc-600'}`} /> Efetivado (Já pago)</p>
                          <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Desmarque para salvar como <span className="text-amber-500 font-bold">PREVISÃO</span></p>
                        </div>
                        <input type="checkbox" checked={isPaid} onChange={e=>setIsPaid(e.target.checked)} className="w-5 h-5 accent-emerald-500 bg-zinc-900 border-zinc-700 rounded" />
                      </div>
                    )}

                    <div><p className="text-[10px] text-zinc-500 font-bold uppercase mb-2 mt-4">Descrição (Opcional)</p><input type="text" placeholder="Ex: Conta de Luz Janeiro" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" /></div>
                  </div>
                )}
              </form>
            </div>
            
            <div className="p-4 bg-zinc-950 border-t border-zinc-900 pb-8 sm:pb-4">
              <button form="tx-form" disabled={busy} className={`w-full font-black py-4 rounded-2xl shadow-lg disabled:opacity-50 flex justify-center items-center gap-2 transition ${modalStep === 1 ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-white text-black hover:bg-zinc-200'}`}>
                {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : (modalStep === 1 ? "Avançar para Pagamento" : "Confirmar Operação")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}