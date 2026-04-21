"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<any>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setMyProfile(profile);
    fetchUsers();
  }

  async function fetchUsers() {
    const { data } = await supabase.from("profiles").select("*");
    if (data) setUsers(data);
    setLoading(false);
  }

  async function linkToMyFamily(targetUserId: string) {
    if (!myProfile?.family_id) {
        // Se você não tiver um ID de família, gera um novo agora mesmo
        const newFamilyId = crypto.randomUUID();
        
        // Primeiro, atualiza o seu próprio perfil
        const { error: myError } = await supabase
          .from("profiles")
          .update({ family_id: newFamilyId })
          .eq("id", myProfile.id);
          
        if (myError) return alert("Erro ao criar família: " + myError.message);
        
        myProfile.family_id = newFamilyId;
    }

    // Agora vincula o outro usuário ao seu ID de família
    const { error } = await supabase
      .from("profiles")
      .update({ family_id: myProfile.family_id })
      .eq("id", targetUserId);

    if (!error) {
      alert("Sucesso! Usuário agora faz parte do seu núcleo familiar.");
      fetchUsers();
    } else {
      alert("Erro ao vincular: " + error.message);
    }
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold">Acessando Central de Comando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 sm:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        
        <header className="flex justify-between items-end border-b border-zinc-900 pb-8">
          <div>
            <button onClick={() => router.push("/")} className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-4 hover:text-white transition">← Voltar ao Ledger</button>
            <h1 className="text-4xl font-black tracking-tighter italic">ADMINISTRAÇÃO</h1>
            <p className="text-zinc-500 font-bold mt-2">Gestão de Usuários e Núcleos Familiares</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 font-black uppercase">Família Ativa</p>
            <p className="text-xs font-mono text-zinc-400">{myProfile?.family_id || "Não Criada"}</p>
          </div>
        </header>

        <section className="bg-zinc-900/50 rounded-[3rem] border border-zinc-900 p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black tracking-tight">Membros do Ecossistema</h2>
            <span className="bg-zinc-800 text-[10px] font-black px-3 py-1.5 rounded-full text-zinc-400 uppercase tracking-widest">Total: {users.length}</span>
          </div>

          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900 p-6 rounded-3xl border border-zinc-800/50 group hover:border-zinc-700 transition">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl shadow-inner group-hover:bg-zinc-700 transition">
                    👤
                  </div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{u.display_name || "Usuário sem Nome"}</p>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter mt-1">ID: {u.id.substring(0, 18)}...</p>
                  </div>
                </div>

                <div className="mt-4 sm:mt-0 flex items-center gap-4 w-full sm:w-auto">
                   <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-black text-zinc-600 uppercase">Status Família</p>
                      <p className="text-xs font-bold text-zinc-400">{u.family_id ? "Vinculado" : "Solo"}</p>
                   </div>
                   
                   {u.family_id !== myProfile?.family_id ? (
                      <button 
                        onClick={() => linkToMyFamily(u.id)}
                        className="flex-1 sm:flex-none bg-white text-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition shadow-lg"
                      >
                        Unir à minha Família
                      </button>
                    ) : (
                      <div className="flex-1 sm:flex-none bg-emerald-500/10 border border-emerald-500/20 px-6 py-3 rounded-2xl text-emerald-400 font-black text-[10px] uppercase tracking-widest text-center">
                        Membro Ativo
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="bg-zinc-900/30 border border-zinc-900 border-dashed rounded-[2.5rem] p-10 text-center">
           <p className="text-zinc-600 text-sm font-bold italic">
              Aviso: Unir um usuário à sua família permitirá que ele visualize e edite todos os gastos compartilhados.
           </p>
        </footer>
      </div>
    </div>
  );
}