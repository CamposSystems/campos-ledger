"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, Plus, FolderTree, Star, 
  Trash2, Pencil, X, RefreshCw, ChevronDown, ImageIcon, Zap
} from "lucide-react";

/* =========================================================
 * ⚠️ ATENÇÃO, CHARLES (PARA O VS CODE):
 * 1. DESCOMENTE as duas linhas abaixo para a Cloudflare:
 * ========================================================= */
 import { createClient } from "@supabase/supabase-js";
 import { useRouter } from "next/navigation";

// Inicialização Oficial do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CORES_DISPONIVEIS = [
  { nome: 'Cinza', valor: 'zinc' },
  { nome: 'Vermelho', valor: 'red' },
  { nome: 'Laranja', valor: 'orange' },
  { nome: 'Amarelo', valor: 'yellow' },
  { nome: 'Verde', valor: 'emerald' },
  { nome: 'Ciano', valor: 'cyan' },
  { nome: 'Azul', valor: 'blue' },
  { nome: 'Roxo', valor: 'purple' },
  { nome: 'Rosa', valor: 'pink' },
];

export default function CategoriasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [categories, setCategories] = useState<any[]>([]);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState("expense");
  const [catIcon, setCatIcon] = useState("📦");
  const [catColor, setCatColor] = useState("zinc");
  const [catParentId, setCatParentId] = useState("");
  const [catIsFavorite, setCatIsFavorite] = useState(false);
  const [catLogo, setCatLogo] = useState<File | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    initPage();
  }, []);

  async function initPage() {
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return router.push("/login");

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setUserProfile(profile);

      if (profile?.family_id) {
        await loadCategories(profile.family_id);
      }
    } catch (err: any) {
      console.error("Erro:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories(familyId: string) {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("family_id", familyId)
      .order("name");
    
    if (data && !error) setCategories(data);
  }

  // Upload de Logótipo (Ícones 3D)
  async function uploadLogo(file: File): Promise<string> {
    const extension = file.name.split(".").pop() || "png";
    const path = `${userProfile.family_id}/categories/logo-${Date.now()}.${extension}`;
    
    const { error } = await supabase.storage.from("family-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true
    });

    if (error) throw new Error(`Falha no upload da imagem: ${error.message}`);

    const { data } = supabase.storage.from("family-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return alert("Informe o nome da categoria.");
    
    setBusy(true);
    try {
      let finalType = catType;
      if (catParentId) {
        const parent = categories.find(c => c.id === catParentId);
        if (parent) finalType = parent.type;
      }

      let finalLogoUrl = currentLogoUrl;
      if (catLogo) {
        finalLogoUrl = await uploadLogo(catLogo);
      }

      const payload = {
        family_id: userProfile.family_id,
        name: catName.trim(),
        type: finalType,
        icon: catIcon.trim(),
        color: catColor,
        parent_id: catParentId || null,
        is_favorite: catIsFavorite,
        ...(finalLogoUrl !== undefined && { logo_url: finalLogoUrl })
      };

      if (editingId) {
        // Atualiza a categoria existente
        const { error } = await supabase.from("categories").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        // Cria uma nova
        const { error } = await supabase.from("categories").insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      loadCategories(userProfile.family_id);
    } catch (err: any) {
      alert("Erro ao guardar categoria: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    const hasChildren = categories.some(c => c.parent_id === id);
    if (hasChildren) {
      return alert("Não pode apagar esta categoria pois ela possui subcategorias. Apague as subcategorias primeiro.");
    }

    if (!window.confirm("Deseja realmente apagar esta categoria?")) return;
    
    setBusy(true);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (!error) loadCategories(userProfile.family_id);
    setBusy(false);
  }

  function openEditModal(cat: any) {
    setEditingId(cat.id);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatIcon(cat.icon || "📦");
    setCatColor(cat.color || "zinc");
    setCatParentId(cat.parent_id || "");
    setCatIsFavorite(cat.is_favorite || false);
    setCatLogo(null);
    setCurrentLogoUrl(cat.logo_url || null);
    setIsModalOpen(true);
  }

  // =========================================================================
  // GERADOR AUTOMÁTICO DE CATEGORIAS (PREMIUM)
  // =========================================================================
  async function generateDefaultCategories() {
    if (!userProfile?.family_id) return;
    setBusy(true);
    try {
      const familyId = userProfile.family_id;

      // 1. Criar Grupos Pais
      const parentGroups = [
        { name: "Habitação & Moradia", icon: "🏠", color: "purple", type: "expense" },
        { name: "Transporte", icon: "🚗", color: "blue", type: "expense" },
        { name: "Alimentação", icon: "🍔", color: "orange", type: "expense" },
        { name: "Assinaturas & Streaming", icon: "📺", color: "red", type: "expense" },
        { name: "Despesas Pessoais", icon: "🛍️", color: "pink", type: "expense" },
        { name: "Rendimentos", icon: "💰", color: "emerald", type: "income" }
      ];

      const { data: parents, error: pError } = await supabase.from("categories").insert(
        parentGroups.map(g => ({ family_id: familyId, ...g }))
      ).select();

      if (pError) throw pError;

      const pMap = parents.reduce((acc: any, curr: any) => {
        acc[curr.name] = curr.id; return acc;
      }, {});

      // 2. Criar Subcategorias baseadas nos Pais
      const subCategories = [
        { name: "Supermercado", icon: "🛒", parent_id: pMap["Habitação & Moradia"], is_favorite: true },
        { name: "Energia", icon: "⚡", parent_id: pMap["Habitação & Moradia"], is_favorite: false },
        { name: "Internet / TV", icon: "🌐", parent_id: pMap["Habitação & Moradia"], is_favorite: false },
        { name: "Combustível", icon: "⛽", parent_id: pMap["Transporte"], is_favorite: true },
        { name: "Uber/App", icon: "🚕", parent_id: pMap["Transporte"], is_favorite: false },
        { name: "Restaurante/Ifood", icon: "🛵", parent_id: pMap["Alimentação"], is_favorite: false },
        { name: "Churrasco/Amigos", icon: "🥩", parent_id: pMap["Alimentação"], is_favorite: false },
        { name: "Netflix", icon: "🍿", parent_id: pMap["Assinaturas & Streaming"], is_favorite: false },
        { name: "Spotify", icon: "🎵", parent_id: pMap["Assinaturas & Streaming"], is_favorite: false },
        { name: "Prime Video", icon: "📦", parent_id: pMap["Assinaturas & Streaming"], is_favorite: false },
        { name: "UniTV", icon: "📺", parent_id: pMap["Assinaturas & Streaming"], is_favorite: false },
        { name: "Telefone Charles", icon: "📱", parent_id: pMap["Despesas Pessoais"], is_favorite: false },
        { name: "Telefone Simone", icon: "📱", parent_id: pMap["Despesas Pessoais"], is_favorite: false },
        { name: "Academia", icon: "🏋️", parent_id: pMap["Despesas Pessoais"], is_favorite: false },
        { name: "Salário Charles", icon: "💵", parent_id: pMap["Rendimentos"], is_favorite: false, type: "income" },
        { name: "Salário Simone", icon: "💵", parent_id: pMap["Rendimentos"], is_favorite: false, type: "income" },
      ];

      const { error: sError } = await supabase.from("categories").insert(
        subCategories.map(s => ({
          family_id: familyId,
          type: s.type || "expense",
          color: "zinc",
          ...s
        }))
      );

      if (sError) throw sError;

      alert("Estrutura Premium de Categorias gerada com sucesso!");
      loadCategories(familyId);

    } catch (err: any) {
      alert("Erro ao gerar: " + err.message);
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setCatName("");
    setCatIcon("📦");
    setCatColor("zinc");
    setCatParentId("");
    setCatIsFavorite(false);
    setCatLogo(null);
    setCurrentLogoUrl(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-10 h-10 text-zinc-600 animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 animate-pulse">A Carregar Estrutura</p>
      </div>
    );
  }

  const parentCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-20">
      
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="w-10 h-10 bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center transition">
              <ArrowLeft className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Motor Financeiro</p>
              <p className="text-sm font-bold text-white tracking-tight">Categorias Personalizadas</p>
            </div>
          </div>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="text-[10px] uppercase font-black tracking-widest bg-white text-black px-3 py-2 rounded-lg hover:bg-zinc-200 transition flex items-center gap-1">
            <Plus className="w-3 h-3" /> Criar
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">

        {parentCategories.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800 border-dashed rounded-[2rem] p-8 text-center mt-10">
            <FolderTree className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
            <p className="text-lg font-black text-white mb-2">Base em Branco</p>
            <p className="text-xs text-zinc-400 mb-6 max-w-[250px] mx-auto">Para poupar tempo, posso gerar toda a estrutura familiar ideal de forma automática (Pode editar tudo depois).</p>
            
            <button onClick={generateDefaultCategories} disabled={busy} className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black py-4 rounded-2xl hover:bg-emerald-500/20 transition uppercase tracking-widest text-xs flex justify-center items-center gap-2">
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Gerar Categorias Base</>}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {parentCategories.map(parent => (
              <div key={parent.id} className="bg-zinc-900 border border-zinc-800 rounded-[1.5rem] overflow-hidden">
                
                {/* CABEÇALHO DO GRUPO (PAI) */}
                <div className="p-4 flex items-center justify-between bg-zinc-950/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-${parent.color}-500/10 text-${parent.color}-500 border border-${parent.color}-500/20 overflow-hidden`}>
                      {parent.logo_url ? <img src={parent.logo_url} alt={parent.name} className="w-full h-full object-cover" /> : parent.icon}
                    </div>
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {parent.name}
                        {parent.is_favorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                        {parent.type === 'income' ? 'Receita' : 'Despesa'} • {getChildren(parent.id).length} subcategorias
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(parent)} className="p-2 text-zinc-500 hover:text-emerald-400 transition" title="Editar Grupo">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCategory(parent.id)} className="p-2 text-zinc-600 hover:text-red-400 transition" title="Apagar Grupo">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* LISTA DE SUBCATEGORIAS (FILHOS) */}
                <div className="px-4 pb-4 pt-1 space-y-2">
                  {getChildren(parent.id).length === 0 ? (
                    <div className="text-center py-3">
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Sem subcategorias</p>
                    </div>
                  ) : (
                    getChildren(parent.id).map(child => (
                      <div key={child.id} className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition group">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden border border-white/5">
                            {child.logo_url ? <img src={child.logo_url} alt={child.name} className="w-full h-full object-cover" /> : <span className="text-sm opacity-80">{child.icon}</span>}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-300 group-hover:text-white transition flex items-center gap-1.5">
                              {child.name}
                              {child.is_favorite && <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => openEditModal(child)} className="p-1.5 text-zinc-500 hover:text-emerald-400 transition" title="Editar Subcategoria">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteCategory(child.id)} className="p-1.5 text-zinc-700 hover:text-red-400 transition" title="Apagar Subcategoria">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-sm my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">{editingId ? "Editar Categoria" : "Nova Categoria"}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-5">
              
              {/* TIPO (Só visível se for categoria PAI e não estivermos a editar) */}
              {!catParentId && !editingId && (
                <div className="flex bg-zinc-900 p-1.5 rounded-2xl">
                  <button type="button" onClick={() => setCatType("expense")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${catType === "expense" ? "bg-zinc-800 text-white shadow-md" : "text-zinc-500"}`}>
                    Despesa
                  </button>
                  <button type="button" onClick={() => setCatType("income")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${catType === "income" ? "bg-emerald-600 text-white shadow-md" : "text-zinc-500"}`}>
                    Receita
                  </button>
                </div>
              )}

              {/* GRUPO PAI */}
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1">É Subcategoria de?</label>
                <div className="relative">
                  <select 
                    value={catParentId} 
                    onChange={e => setCatParentId(e.target.value)} 
                    className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none appearance-none disabled:opacity-50"
                    disabled={!!editingId && !catParentId} // Não pode transformar pai em filho na edição
                  >
                    <option value="">Nenhum (Grupo Principal)</option>
                    {parentCategories.filter(p => p.id !== editingId).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type === 'income' ? 'Receita' : 'Despesa'})</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-4 top-1/2 pointer-events-none" />
                </div>
              </div>

              {/* UPLOAD DE ÍCONE 3D OU EMOJI */}
              <div className="flex gap-4 items-center">
                <label className="relative cursor-pointer group shrink-0">
                  <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 border-dashed flex flex-col items-center justify-center hover:bg-zinc-800 transition overflow-hidden">
                    {catLogo ? (
                      <img src={URL.createObjectURL(catLogo)} alt="Preview" className="w-full h-full object-cover" />
                    ) : currentLogoUrl ? (
                      <img src={currentLogoUrl} alt="Atual" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
                        <span className="text-[7px] uppercase font-bold text-zinc-500 tracking-widest px-1 text-center">Ícone 3D</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => setCatLogo(e.target.files?.[0] || null)} className="hidden" />
                </label>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 shrink-0">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Emoji</label>
                      <input required={!catLogo && !currentLogoUrl} value={catIcon} onChange={e=>setCatIcon(e.target.value)} disabled={!!catLogo || !!currentLogoUrl} className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-3 text-xl text-center outline-none focus:border-zinc-600 disabled:opacity-30" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest ml-1">Nome</label>
                      <input required value={catName} onChange={e=>setCatName(e.target.value)} placeholder="Ex: Netflix" className="w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-zinc-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* COR (Apenas para Grupos Pai) */}
              {!catParentId && (
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-1 mb-2 block">Cor Tema do Grupo</label>
                  <div className="grid grid-cols-5 gap-2">
                    {CORES_DISPONIVEIS.map(cor => (
                      <button 
                        key={cor.valor} 
                        type="button" 
                        onClick={() => setCatColor(cor.valor)}
                        className={`h-8 rounded-lg bg-${cor.valor}-500 transition-all ${catColor === cor.valor ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110' : 'opacity-50 hover:opacity-80'}`}
                        title={cor.nome}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* FAVORITO */}
              <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-500" /> Destaque Diário</p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Exibir no topo na hora de lançar</p>
                </div>
                <input type="checkbox" checked={catIsFavorite} onChange={e=>setCatIsFavorite(e.target.checked)} className="w-5 h-5 accent-yellow-500 bg-zinc-900 border-zinc-700 rounded" />
              </div>

              <button type="submit" disabled={busy} className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-zinc-200 transition uppercase tracking-widest text-xs mt-4 disabled:opacity-50">
                {busy ? "A Guardar..." : (editingId ? "Atualizar Categoria" : "Guardar Categoria")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}