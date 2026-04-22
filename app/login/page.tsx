"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Inicialização Oficial e Direta do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erro ao entrar: " + error.message);
    } else {
      router.push("/"); 
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Erro ao cadastrar: " + error.message);
    } else {
      alert("Conta criada! Agora clique em Entrar.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <header className="text-center">
          <h1 className="text-gray-500 text-sm font-medium tracking-[0.2em] uppercase">Camp.OS Ledger</h1>
          <p className="text-3xl font-bold mt-4">Bem-vindo</p>
          <p className="text-neutral-500 mt-2">Sua gestão financeira familiar premium.</p>
        </header>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl outline-none focus:border-white transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Sua senha"
            className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl outline-none focus:border-white transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-bold py-4 rounded-2xl mt-4 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? "Processando..." : "Entrar"}
          </button>
        </form>

        <button 
          type="button"
          onClick={handleSignUp}
          className="text-neutral-500 text-sm hover:text-white transition-all"
        >
          Não tem conta? Criar acesso familiar
        </button>
      </div>
    </main>
  );
}