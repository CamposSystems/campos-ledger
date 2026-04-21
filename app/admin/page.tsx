"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  ShieldAlert, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  UserCircle2,
  Settings2,
  LogOut,
  Pencil,
  X
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);
  
  // Estados para edição de nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  useEffect(() => {
    initAdmin();
  }, []);

  async function initAdmin() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (typeof window !== 'undefined') router.push("/login");
        return;
      }

      // 1. Buscar o seu perfil atual
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setMyProfile(profile);
      }

      // 2. Buscar todos os perfis do sistema
      fetchProfiles();
    } catch (err) {
      console.error("Erro na inicialização do Admin:", err);
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("display_name", { ascending: true });

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  }

  // Função para atualizar o próprio nome
  async function handleUpdateName() {
    if (!editNameValue.trim()) return;
    
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: editNameValue })
      .eq("id", myProfile.id);

    if (!error) {
      setMyProfile({ ...myProfile, display_name: editNameValue });
      setIsEditingName(false);
      fetchProfiles(); // Atualiza a lista global
    } else {
      alert("Erro ao atualizar o nome: " + error.message);
    }
  }

  // Função atualizada para gerar a sua Família
  async function handleInitialSetup() {
    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newFamilyId = crypto.randomUUID();

      // 1. Cria a Família
      await supabase.from("families").insert([{ id: newFamilyId, name: "Núcleo Campos" }]);

      // 2. Atualiza o seu Perfil com o ID da família criada
      const { error } = await supabase
        .from("profiles")
        .update({ family_id: newFamilyId, role: "admin" })
        .eq("id", session.user.id);

      if (!error) {
        alert("Família criada com sucesso!");
        initAdmin(); // Recarrega a página com o seu novo ID
      } else {
        alert("Erro ao criar família: " + error.message);
      }
    } catch (err) {
      alert("Erro crítico no setup inicial.");
    } finally {
      setIsResetting(false);
    }
  }

  // Vincula a Simone ao seu ID
  async function handleLinkUser(targetUserId: string) {
    if (!myProfile?.family_id) {
      alert("Crie o seu núcleo familiar primeiro no botão acima.");
      return;
    }

    const confirmAction = window.confirm("Deseja unir este utilizador à sua família?");
    if (!confirmAction) return;

    const { error } = await supabase
      .from("profiles")
      .update({ family_id: myProfile.family_id })
      .eq("id", targetUserId);

    if (!error) {
      alert("Utilizador vinculado com sucesso!");
      fetchProfiles(); // Recarrega a lista para mostrar o verdinho
    } else {
      alert("Erro ao vincular: " + error.message);
    }
  }

  // Removemos o próprio utilizador da lista para não tentar "convidar-se" a si próprio
  const usersToDisplay = users.filter(u => u.id !== myProfile?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6">
        <RefreshCw className="w-12 h-12 text-zinc-800 animate-spin mb-4" />
        <p className="font-black text-[10px] uppercase tracking-[0.4em] text-zinc-500">Sincronizando Sistema</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-white selection:text-black pb-20">
      <div className="max-w-4xl mx-auto p-6 md:p-12 space-y-12">
        
        {/* Navegação e Título */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-zinc-900 pb-12">
          <div className="space-y-4">
            <button 
              onClick={() => router.push("/")}
              className="flex items-center text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] hover:text-white transition group"
            >
              <ArrowLeft className="w-3 h-3 mr-2 group-hover:-translate-x-1 transition-transform" /> Voltar ao Ledger
            </button>
            <h1 className="text-7xl font-black italic tracking-tighter leading-none">ADMIN</h1>
            <p className="text-zinc-500 font-bold text-sm">Controle de Acessos e Núcleos Familiares</p>
          </div>

          {/* Cartão do Perfil Logado com Edição de Nome */}
          <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-800 flex items-center gap-6 w-full md:w-auto">
            <div className="p-4 bg-zinc-900 rounded-2xl">
                <UserCircle2 className="w-8 h-8 text-zinc-500" />
            </div>
            <div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">O Seu Perfil</p>
                
                {isEditingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      autoFocus
                      value={editNameValue} 
                      onChange={e => setEditNameValue(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg outline-none w-32 md:w-40"
                      placeholder="Seu Nome"
                    />
                    <button onClick={handleUpdateName} className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg hover:bg-emerald-500/30 transition">
                      <CheckCircle2 className="w-4 h-4"/>
                    </button>
                    <button onClick={() => setIsEditingName(false)} className="bg-red-500/20 text-red-400 p-2 rounded-lg hover:bg-red-500/30 transition">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-black text-white truncate max-w-[150px]">{myProfile?.display_name || "Sem Nome"}</p>
                    <button 
                      onClick={() => {setEditNameValue(myProfile?.display_name || ""); setIsEditingName(true);}} 
                      className="text-zinc-500 hover:text-white transition bg-zinc-800 p-1.5 rounded-md"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/50">
                  <Settings2 className="w-3 h-3 text-zinc-600" />
                  <p className="text-[10px] font-mono text-zinc-500 uppercase">
                    Família: {myProfile?.family_id ? `${myProfile.family_id.substring(0, 8)}...` : "Não Criada"}
                  </p>
                </div>
            </div>
          </div>
        </header>

        {/* ALERTA: BOTÃO DE SETUP DA FAMÍLIA APARECE SE NÃO TIVER FAMILY_ID */}
        {!myProfile?.family_id && (
          <div className="bg-white p-8 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_30px_60px_rgba(255,255,255,0.1)]">
            <div className="text-black flex items-start gap-5">
              <div className="p-4 bg-black rounded-3xl text-white">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight uppercase">Configuração Pendente</h3>
                <p className="text-sm font-bold opacity-60 mt-1 max-w-sm">
                  A sua conta foi criada, mas ainda não gerou um Núcleo Familiar.
                </p>
              </div>
            </div>
            <button 
              onClick={handleInitialSetup}
              disabled={isResetting}
              className="w-full md:w-auto bg-black text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
            >
              {isResetting ? "Criando..." : "Criar Meu Núcleo Familiar"}
            </button>
          </div>
        )}

        {/* Listagem de Utilizadores */}
        <section className="bg-zinc-900/20 rounded-[3.5rem] border border-zinc-900 p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-[120px] -mr-40 -mt-40"></div>
          
          <div className="flex justify-between items-center mb-12 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-800 rounded-2xl">
                <Users className="w-6 h-6 text-zinc-400" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter">Membros do Ecossistema</h2>
            </div>
            <div className="bg-zinc-900 px-5 py-2 rounded-2xl border border-zinc-800">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Listados: {usersToDisplay.length}</span>
            </div>
          </div>

          <div className="grid gap-4 relative z-10">
            {usersToDisplay.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] space-y-4">
                <UserCircle2 className="w-12 h-12 text-zinc-800 mx-auto" />
                <p className="text-zinc-700 font-black uppercase italic tracking-widest text-sm">Nenhum outro utilizador encontrado no banco</p>
              </div>
            ) : (
              usersToDisplay.map((u) => (
                <div key={u.id} className="bg-zinc-900/80 p-7 rounded-[2.5rem] border border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-zinc-600 hover:bg-zinc-900 transition-all duration-300">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner group-hover:bg-zinc-700 transition-all">
                      👤
                    </div>
                    <div>
                      <p className="font-black text-2xl tracking-tighter text-zinc-100">{u.display_name || "Sem Nome Definido"}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        <span>Status:</span>
                        <span className={u.family_id ? "text-zinc-400" : "text-yellow-600 italic"}>
                          {u.family_id ? "Núcleo Vinculado" : "Pendente de Vínculo"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto">
                    {u.family_id === myProfile?.family_id && myProfile?.family_id ? (
                      <div className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-emerald-500/10 text-emerald-400 px-8 py-4 rounded-2xl border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.2em]">
                        <CheckCircle2 className="w-4 h-4" /> Membro da Família
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleLinkUser(u.id)}
                        className="flex-1 md:flex-none bg-white text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 active:scale-95 transition-all shadow-xl"
                      >
                        Vincular à Família
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}