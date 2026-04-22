"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, Plus, CreditCard, Banknote, 
  Building2, ShieldAlert, RefreshCw,
  X, Trash2, Pencil, ImageIcon
} from "lucide-react";

/* =========================================================================
   ⚠️ ATENÇÃO CHARLES: NO SEU VS CODE, DESCOMENTE AS 2 LINHAS ABAIXO:
========================================================================= */
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ContasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]); // Adicionado para saldos dinâmicos

  // Estados dos Modais
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // Formulário de Conta
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("checking");
  const [accBalance, setAccBalance] = useState("");
  const [accIsDefault, setAccIsDefault] = useState(false);
  const [accLogo, setAccLogo] = useState<File | null>(null);
  const [currentAccLogoUrl, setCurrentAccLogoUrl] = useState<string | null>(null);

  // Formulário de Cartão
  const [cardName, setCardName] = useState("");
  const [cardLinkedAccId, setCardLinkedAccId] = useState("");
  const [cardLimit, setCardLimit] = useState("");
  const [cardClosingDay, setCardClosingDay] = useState("");
  const [cardDueDay, setCardDueDay] = useState("");
  const [cardBrand, setCardBrand] = useState("Mastercard");
  const [cardIsDefault, setCardIsDefault] = useState(false);
  const [cardLogo, setCardLogo] = useState<File | null>(null);
  const [currentCardLogoUrl, setCurrentCardLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    initPage();
  }, []);

  async function initPage() {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return router.push("/login");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setUserProfile(profile);

      if (profile?.family_id) {
        await loadAssets(profile.family_id);
      }
    } catch (err: any) {
      console.error("Erro ao inicializar página de contas:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssets(familyId: string) {
    try {
      const [accRes, cardRes, txRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("family_id", familyId).order("name"),
        supabase.from("credit_cards").select("*").eq("family_id", familyId).order("name"),
        supabase.from("transactions").select("amount, type, account_id, credit_card_id, status, payment_method").eq("family_id", familyId)
      ]);
      
      if (accRes.data) setAccounts(accRes.data);
      if (cardRes.data) setCreditCards(cardRes.data);
      if (txRes.data) setTransactions(txRes.data);
    } catch (err) {
      console.error("Erro ao carregar ativos:", err);
    }
  }

  function parseCurrency(value: string | number) {
    if (!value && value !== 0) return 0;
    const strVal = String(value);
    const cleanValue = strVal.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  async function uploadLogo(file: File, folder: string): Promise<string> {
    const extension = file.name.split(".").pop() || "png";
    const path = `${userProfile.family_id}/${folder}/logo-${Date.now()}.${extension}`;
    
    const { error } = await supabase.storage.from("family-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });

    if (error) throw new Error(`Falha no upload da imagem: ${error.message}`);

    const { data } = supabase.storage.from("family-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  // ================= CONTAS =================
  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile?.family_id) return alert("Atenção: Precisa de ter uma Família registada.");
    if (!accName.trim()) return alert("Informe o nome da conta.");
    
    setBusy(true);
    try {
      const forceDefault = accounts.length === 0 ? true : accIsDefault;

      if (forceDefault && accounts.length > 0) {
        await supabase.from("accounts").update({ is_default: false }).eq("family_id", userProfile.family_id);
      }

      let finalLogoUrl = currentAccLogoUrl;
      if (accLogo) finalLogoUrl = await uploadLogo(accLogo, 'accounts');

      const numericBalance = parseCurrency(accBalance);

      const payload = {
        family_id: userProfile.family_id,
        name: accName.trim(),
        type: accType,
        initial_balance: numericBalance,
        is_default: forceDefault,
        ...(finalLogoUrl && { logo_url: finalLogoUrl })
      };

      if (editingAccountId) {
        const { error } = await supabase.from("accounts").update(payload).eq("id", editingAccountId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accounts").insert([payload]);
        if (error) throw error;
      }

      setIsAccountModalOpen(false);
      resetAccountForm();
      loadAssets(userProfile.family_id);
    } catch (err: any) {
      alert("Erro ao guardar conta: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  function openEditAccount(acc: any) {
    setEditingAccountId(acc.id);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccBalance(String(acc.initial_balance).replace(".", ","));
    setAccIsDefault(acc.is_default);
    setCurrentAccLogoUrl(acc.logo_url || null);
    setAccLogo(null);
    setIsAccountModalOpen(true);
  }

  async function handleDeleteAccount(id: string) {
    if (!window.confirm("Atenção! Apagar esta conta pode afetar cartões vinculados. Continuar?")) return;
    setBusy(true);
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (!error) loadAssets(userProfile.family_id);
    else alert("Erro ao apagar: " + error.message);
    setBusy(false);
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccName("");
    setAccType("checking");
    setAccBalance("");
    setAccIsDefault(false);
    setAccLogo(null);
    setCurrentAccLogoUrl(null);
  }

  // ================= CARTÕES =================
  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile?.family_id) return alert("Família não encontrada.");
    if (!cardName.trim()) return alert("Informe o nome do cartão.");
    if (!cardLinkedAccId) return alert("Vincule o cartão a uma conta.");
    
    const closing = parseInt(cardClosingDay, 10);
    const due = parseInt(cardDueDay, 10);
    if (isNaN(closing) || isNaN(due) || closing < 1 || closing > 31 || due < 1 || due > 31) {
      return alert("Informe dias válidos (1 a 31).");
    }

    setBusy(true);
    try {
      const forceDefault = creditCards.length === 0 ? true : cardIsDefault;

      if (forceDefault && creditCards.length > 0) {
        await supabase.from("credit_cards").update({ is_default: false }).eq("family_id", userProfile.family_id);
      }

      let finalLogoUrl = currentCardLogoUrl;
      if (cardLogo) finalLogoUrl = await uploadLogo(cardLogo, 'cards');

      const numericLimit = parseCurrency(cardLimit);

      const payload = {
        family_id: userProfile.family_id,
        account_id: cardLinkedAccId,
        name: cardName.trim(),
        limit_amount: numericLimit,
        closing_day: closing,
        due_day: due,
        is_default: forceDefault,
        brand: cardBrand,
        ...(finalLogoUrl && { logo_url: finalLogoUrl })
      };

      if (editingCardId) {
        const { error } = await supabase.from("credit_cards").update(payload).eq("id", editingCardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credit_cards").insert([payload]);
        if (error) throw error;
      }

      setIsCardModalOpen(false);
      resetCardForm();
      loadAssets(userProfile.family_id);
    } catch (err: any) {
      alert("Erro ao guardar cartão: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  function openEditCard(card: any) {
    setEditingCardId(card.id);
    setCardName(card.name);
    setCardLinkedAccId(card.account_id);
    setCardLimit(String(card.limit_amount).replace(".", ","));
    setCardClosingDay(String(card.closing_day));
    setCardDueDay(String(card.due_day));
    setCardBrand(card.brand || "Mastercard");
    setCardIsDefault(card.is_default);
    setCurrentCardLogoUrl(card.logo_url || null);
    setCardLogo(null);
    setIsCardModalOpen(true);
  }

  async function handleDeleteCard(id: string) {
    if (!window.confirm("Deseja realmente apagar este cartão?")) return;
    setBusy(true);
    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (!error) loadAssets(userProfile.family_id);
    setBusy(false);
  }

  function resetCardForm() {
    setEditingCardId(null);
    setCardName("");
    setCardLinkedAccId("");
    setCardLimit("");
    setCardClosingDay("");
    setCardDueDay("");
    setCardBrand("Mastercard");
    setCardIsDefault(false);
    setCardLogo(null);
    setCurrentCardLogoUrl(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-10 h-10 text-zinc-600 animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse">A Carregar Ativos</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 pb-20">
      
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
              <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Fundação Financeira</p>
              <p className="text-sm font-bold text-white tracking-tight">Contas e Cartões</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-10">

        {/* SECÇÃO DE CONTAS COM SALDO DINÂMICO */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Contas Correntes
            </h2>
            <button onClick={() => {resetAccountForm(); setIsAccountModalOpen(true);}} className="text-[10px] uppercase font-black tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition flex items-center gap-1">
              <Plus className="w-3 h-3" /> Nova
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-[2rem] p-6 text-center">
              <Building2 className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm font-bold text-zinc-500">Nenhuma conta registada.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {accounts.map(acc => {
                // Cálculo de Saldo Dinâmico
                let currentBalance = Number(acc.initial_balance) || 0;
                transactions.forEach(t => {
                  if (t.account_id === acc.id && t.status === 'completed' && t.payment_method !== 'credit') {
                    if (t.type === 'income') currentBalance += Number(t.amount);
                    if (t.type === 'expense') currentBalance -= Number(t.amount);
                  }
                });

                return (
                  <div key={acc.id} className="bg-zinc-900 border border-zinc-800 rounded-[1.5rem] p-4 flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 shrink-0 text-xl shadow-inner overflow-hidden">
                        {acc.logo_url ? (
                          <img src={acc.logo_url} alt={acc.name} className="w-full h-full object-cover" />
                        ) : (
                          acc.type === 'checking' ? '🏦' : acc.type === 'wallet' ? '📱' : '💰'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white truncate">{acc.name}</p>
                          {acc.is_default && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Favorita</span>}
                        </div>
                        {/* AQUI MOSTRAMOS O SALDO ATUALIZADO */}
                        <p className={`text-sm font-black mt-0.5 ${currentBalance >= 0 ? 'text-zinc-300' : 'text-red-400'}`}>R$ {currentBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditAccount(acc)} disabled={busy} className="p-2 text-zinc-500 hover:text-emerald-400 transition" title="Editar Conta">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteAccount(acc.id)} disabled={busy} className="p-2 text-zinc-600 hover:text-red-400 transition" title="Excluir Conta">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* SECÇÃO DE CARTÕES COM LIMITE DINÂMICO */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Cartões de Crédito
            </h2>
            <button 
              onClick={() => {
                if (accounts.length === 0) return alert("Registe uma conta primeiro.");
                resetCardForm();
                setIsCardModalOpen(true);
              }} 
              className="text-[10px] uppercase font-black tracking-widest bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Novo
            </button>
          </div>

          <div className="grid gap-3">
            {creditCards.map(card => {
              const accLinked = accounts.find(a => a.id === card.account_id);
              
              // Cálculo de Limite Utilizado (Faturas Pendentes)
              let usedLimit = 0;
              transactions.forEach(t => {
                if (t.credit_card_id === card.id && t.status === 'pending' && t.type === 'expense') {
                  usedLimit += Number(t.amount);
                }
              });
              
              const totalLimit = Number(card.limit_amount) || 0;
              const availableLimit = totalLimit - usedLimit;
              const usedPercentage = totalLimit > 0 ? (usedLimit / totalLimit) * 100 : 0;

              return (
                <div key={card.id} className="bg-gradient-to-tr from-zinc-900 to-zinc-800 border border-zinc-700 rounded-[1.5rem] p-5 shadow-lg relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                    <CreditCard className="w-24 h-24" />
                  </div>
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                        {card.logo_url ? (
                          <img src={card.logo_url} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <CreditCard className="w-5 h-5 text-zinc-700" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-lg text-white">{card.name}</p>
                          {card.is_default && <span className="text-[8px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Favorito</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-950 px-1.5 py-0.5 rounded">{card.brand}</span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Fatura debita em: {accLinked?.name || "?"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCard(card)} disabled={busy} className="p-1.5 text-zinc-500 hover:text-emerald-400 transition bg-zinc-950/50 rounded-lg" title="Editar Cartão">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCard(card.id)} disabled={busy} className="p-1.5 text-zinc-500 hover:text-red-400 transition bg-zinc-950/50 rounded-lg" title="Excluir Cartão">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-zinc-950/50 px-3 py-2 rounded-xl flex-1 border border-zinc-800">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Disponível</p>
                        <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">{usedPercentage.toFixed(0)}% Usado</p>
                      </div>
                      <p className={`font-mono text-sm font-black ${availableLimit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>R$ {availableLimit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                      
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${usedPercentage > 85 ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${Math.min(usedPercentage, 100)}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-zinc-950/50 px-3 py-2 rounded-xl border border-zinc-800 text-center">
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Fecho / Venc.</p>
                      <p className="font-mono text-sm text-zinc-300 mt-0.5 flex items-center justify-center gap-1.5">
                        <span className="text-yellow-500">{card.closing_day}</span> / <span className="text-red-400">{card.due_day}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </main>

      {/* MODAL: CONTA */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-sm my-auto shadow-2xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic">{editingAccountId ? "EDITAR CONTA" : "NOVA CONTA"}</h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-5">
              
              <div className="flex flex-col items-center justify-center">
                <label className="relative cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 border-dashed flex flex-col items-center justify-center hover:bg-zinc-800 transition overflow-hidden shadow-inner">
                    {accLogo ? (
                      <img src={URL.createObjectURL(accLogo)} alt="Preview" className="w-full h-full object-cover" />
                    ) : currentAccLogoUrl ? (
                      <img src={currentAccLogoUrl} alt="Logo Atual" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
                        <span className="text-[8px] uppercase font-bold text-zinc-500 tracking-widest">Logo</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => setAccLogo(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Instituição (Nome)</label>
                <input required value={accName} onChange={e=>setAccName(e.target.value)} placeholder="Ex: Banrisul, Caixa" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Tipo</label>
                  <select value={accType} onChange={e=>setAccType(e.target.value)} className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none">
                    <option value="checking">Conta Corrente</option>
                    <option value="savings">Poupança</option>
                    <option value="wallet">Carteira / Espécie</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Saldo Real (R$)</label>
                  <input type="text" inputMode="decimal" value={accBalance} onChange={e=>setAccBalance(e.target.value)} placeholder="0,00" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <input type="checkbox" id="accDefault" checked={accIsDefault} onChange={e=>setAccIsDefault(e.target.checked)} className="w-5 h-5 accent-emerald-500 bg-zinc-900 border-zinc-700 rounded" />
                <label htmlFor="accDefault" className="text-sm font-bold text-zinc-300">Definir como conta principal</label>
              </div>

              <button type="submit" disabled={busy} className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-zinc-200 transition uppercase tracking-widest text-xs mt-4 disabled:opacity-50 shadow-lg active:scale-95">
                {busy ? <RefreshCw className="animate-spin mx-auto w-4 h-4" /> : (editingAccountId ? "ATUALIZAR CONTA" : "GUARDAR CONTA")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CARTÃO */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-sm my-auto shadow-2xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic">{editingCardId ? "EDITAR CARTÃO" : "NOVO CARTÃO"}</h3>
              <button onClick={() => setIsCardModalOpen(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-5">
              
              <div className="flex gap-4 items-center">
                <label className="relative cursor-pointer group shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 border-dashed flex flex-col items-center justify-center hover:bg-zinc-800 transition overflow-hidden shadow-inner">
                    {cardLogo ? (
                      <img src={URL.createObjectURL(cardLogo)} alt="Preview" className="w-full h-full object-cover" />
                    ) : currentCardLogoUrl ? (
                      <img src={currentCardLogoUrl} alt="Logo Atual" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-zinc-500 mb-1" />
                        <span className="text-[7px] uppercase font-bold text-zinc-500 tracking-widest">Logo</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => setCardLogo(e.target.files?.[0] || null)} className="hidden" />
                </label>
                
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Nome do Cartão</label>
                  <input required value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Ex: Visa Platinum" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Bandeira</label>
                  <select required value={cardBrand} onChange={e=>setCardBrand(e.target.value)} className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none">
                    <option value="Mastercard">Mastercard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="American Express">Amex</option>
                    <option value="Hipercard">Hipercard</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1 flex items-center gap-1"><Banknote className="w-3 h-3"/> Pagar com:</label>
                  <select required value={cardLinkedAccId} onChange={e=>setCardLinkedAccId(e.target.value)} className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none">
                    <option value="">Conta...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Limite Global (R$)</label>
                  <input required type="text" inputMode="decimal" value={cardLimit} onChange={e=>setCardLimit(e.target.value)} placeholder="0,00" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                </div>
                <div className="col-span-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1 text-yellow-500">Dia Fecho</label>
                    <input required type="number" min="1" max="31" value={cardClosingDay} onChange={e=>setCardClosingDay(e.target.value)} placeholder="Ex: 5" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1 text-red-400">Dia Vencimento</label>
                    <input required type="number" min="1" max="31" value={cardDueDay} onChange={e=>setCardDueDay(e.target.value)} placeholder="Ex: 12" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <input type="checkbox" id="cardDefault" checked={cardIsDefault} onChange={e=>setCardIsDefault(e.target.checked)} className="w-5 h-5 accent-purple-500 bg-zinc-900 border-zinc-700 rounded" />
                <label htmlFor="cardDefault" className="text-sm font-bold text-zinc-300">Definir como cartão principal</label>
              </div>

              <button type="submit" disabled={busy} className="w-full bg-purple-600 text-white font-black py-4 rounded-xl hover:bg-purple-500 transition uppercase tracking-widest text-xs mt-4 disabled:opacity-50 shadow-lg active:scale-95">
                {busy ? <RefreshCw className="animate-spin mx-auto w-4 h-4" /> : (editingCardId ? "ATUALIZAR CARTÃO" : "GUARDAR CARTÃO")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}