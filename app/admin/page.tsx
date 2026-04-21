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
  Pencil,
  X
} from "lucide-react";

/**
 * Nota: No ambiente de produção real (Next.js/Cloudflare), as bibliotecas abaixo
 * devem estar no seu package.json. No preview (Canvas), nós silenciamos os erros 
 * não utilizando os imports diretamente na raiz se eles causarem falha no bundler.
 * O código abaixo simula o comportamento da API ou tenta usar variáveis globais se disponíveis.
 */
let supabase: any;
let useRouter: any;

// Simulação de roteamento para evitar quebras no Canvas
const mockRouter = { push: (url: string) => console.log(`Routing to: ${url}`) };

try {
  // Tentativa dinâmica de require apenas se estiver num ambiente que suporte
  if (typeof window !== 'undefined') {
    const sb = require("@supabase/supabase-js");
    const nextNav = require("next/navigation");
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-key";
    
    supabase = sb.createClient(supabaseUrl, supabaseAnonKey);
    useRouter = nextNav.useRouter;
  }
} catch (e) {
  // Mock para o ambiente de preview do Canvas
  console.log("Running in isolated preview environment");
  useRouter = () => mockRouter;
  supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "mock-admin-id" } } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: "mock-admin-id", display_name: "Admin Preview", family_id: null } }) }), order: async () => ({ data: [], error: null }) }),
      insert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) })
    })
  };
}


export default function App() {
  // Inicialização segura do router
  const router = typeof useRouter === 'function' ? useRouter() : mockRouter;
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);
  
  // Estados para edição do PRÓPRIO nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Estados para edição do nome de OUTROS usuários
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);
  const [otherNameValue, setOtherNameValue] = useState("");

  useEffect(() => {
    initAdmin();
  }, []);

  async function initAdmin() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (typeof window !== 'undefined' && typeof router.push === 'function') {
           router.push("/login");
        }
        setLoading(false);
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
      // Fallback para preview visual
      setMyProfile({ id: "mock-id", display_name: "Charles Campos", family_id: null });
      setUsers([{ id: "mock-user-2", display_name: "Simone Carli", family_id: null }]);
      setLoading(false);
    }
  }

  async function fetchProfiles() {
    try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("display_name", { ascending: true });

        if (!error && data) {
          setUsers(data);
        }
    } catch(e) {
        // Preview visual
    }
    setLoading(false);
  }

  // Atualizar próprio nome
  async function handleUpdateName() {
    if (!editNameValue.trim()) return;
    
    try {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: editNameValue })
          .eq("id", myProfile.id);

        if (!error) {
          setMyProfile({ ...myProfile, display_name: editNameValue });
          setIsEditingName(false);
          fetchProfiles();
        } else {
          alert("Erro ao atualizar o nome: " + error.message);
        }
    } catch (e) {
         setMyProfile({ ...myProfile, display_name: editNameValue });
         setIsEditingName(false);
    }
  }

  // Atualizar nome de OUTRO membro
  async function handleUpdateOtherName(targetId: string) {
    if (!otherNameValue.trim()) return;
    
    try {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: otherNameValue })
          .eq("id", targetId);

        if (!error) {
          setEditingOtherId(null);
          
          // Otimista update no preview
          const updatedUsers = users.map(u => u.id === targetId ? {...u, display_name: otherNameValue} : u);
          setUsers(updatedUsers);
          
          fetchProfiles();
        } else {
          alert("Erro de Permissão: O banco de dados bloqueou a edição. Leia o aviso no chat para liberar esta função com o SQL.");
        }
    } catch (e) {
        const updatedUsers = users.map(u => u.id === targetId ? {...u, display_name: otherNameValue} : u);
        setUsers(updatedUsers);
        setEditingOtherId(null);
    }
  }

  // Gerar Família
  async function handleInitialSetup() {
    setIsResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
         // Preview mode logic
         const mockFamilyId = "preview-family-id-1234";
         setMyProfile({...myProfile, family_id: mockFamilyId});
         setIsResetting(false);
         alert("Família criada com sucesso no modo Preview!");
         return;
      }

      const newFamilyId = crypto.randomUUID();

      await supabase.from("families").insert([{ id: newFamilyId, name: "Núcleo Campos" }]);

      const { error } = await supabase
        .from("profiles")
        .update({ family_id: newFamilyId, role: "admin" })
        .eq("id", session.user.id);

      if (!error) {
        alert("Família criada com sucesso!");
        initAdmin(); 
      } else {
        alert("Erro ao criar família: " + error.message);
      }
    } catch (err) {
      // Preview mode
      const mockFamilyId = "preview-family-id-1234";
      setMyProfile({...myProfile, family_id: mockFamilyId});
      setIsResetting(false);
    } finally {
      setIsResetting(false);
    }
  }

  // Vincular membro à Família
  async function handleLinkUser(targetUserId: string) {
    if (!myProfile?.family_id) {
      alert("Crie o seu núcleo familiar primeiro no botão acima.");
      return;
    }

    const confirmAction = window.confirm("Deseja unir este utilizador à sua família?");
    if (!confirmAction) return;

    try {
        const { error } = await supabase
          .from("profiles")
          .update({ family_id: myProfile.family_id })
          .eq("id", targetUserId);

        if (!error) {
          alert("Utilizador vinculado com sucesso!");
          fetchProfiles();
        } else {
          alert("Erro ao vincular: " + error.message);
        }
    } catch (e) {
         // Preview mode
         const updatedUsers = users.map(u => u.id === targetUserId ? {...u, family_id: myProfile.family_id} : u);
         setUsers(updatedUsers);
    }
  }

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
        
        {/* Cabeçalho */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-zinc-900 pb-12">
          <div className="space-y-4">
            <button 
              onClick={() => typeof router.push === 'function' ? router.push("/") : console.log("Back")}
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
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">O Seu Perfil (Admin)</p>
                
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
                    <p className="text-xl font-black text-white truncate max-w-[150px]">{myProfile?.display_name || "Usuário"}</p>
                    <button 
                      onClick={() => {setEditNameValue(myProfile?.display_name || ""); setIsEditingName(true);}} 
                      className="text-zinc-500 hover:text-white transition bg-zinc-800 p-1.5 rounded-md shadow-lg hover:scale-110"
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

        {/* ALERTA: BOTÃO DE SETUP DA FAMÍLIA */}
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
                      {/* EDICAO DE NOME INLINE PARA OUTROS USUARIOS */}
                      {editingOtherId === u.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input 
                            autoFocus
                            value={otherNameValue} 
                            onChange={e => setOtherNameValue(e.target.value)}
                            className="bg-zinc-950 border border-zinc-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg outline-none w-40"
                            placeholder="Nome do Membro"
                          />
                          <button onClick={() => handleUpdateOtherName(u.id)} className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg hover:bg-emerald-500/30 transition">
                            <CheckCircle2 className="w-4 h-4"/>
                          </button>
                          <button onClick={() => setEditingOtherId(null)} className="bg-red-500/20 text-red-400 p-2 rounded-lg hover:bg-red-500/30 transition">
                            <X className="w-4 h-4"/>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <p className="font-black text-2xl tracking-tighter text-zinc-100">{u.display_name || "Usuário sem Nome"}</p>
                          <button 
                            onClick={() => { setEditingOtherId(u.id); setOtherNameValue(u.display_name || ""); }} 
                            className="text-zinc-500 hover:text-white transition bg-zinc-800 p-1.5 rounded-md shadow-lg hover:scale-110"
                            title="Editar Nome do Membro"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
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
                        Unir à minha Família
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