"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Settings2,
  Pencil,
  X,
  Link2,
  Crown,
  AlertTriangle,
  UserPlus2,
  UserMinus2,
  UserCog2,
  Power,
  PowerOff,
  House,
  ChevronRight,
  BadgeCheck,
  Mail,
  ImagePlus,
  Upload,
  Ban,
} from "lucide-react";

/**
 * Ambiente preparado para Next.js App Router e Supabase
 */
let supabase: any;
let useRouter: any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const mockRouter = { push: (url: string) => console.log(`Routing to: ${url}`) };

try {
  if (typeof window !== 'undefined') {
    const sb = require("@supabase/supabase-js");
    const nextNav = require("next/navigation");
    
    supabase = sb.createClient(
      supabaseUrl || "https://mock.supabase.co",
      supabaseAnonKey || "mock-key"
    );
    useRouter = nextNav.useRouter;
  }
} catch (e) {
  useRouter = () => mockRouter;
  supabase = {
    auth: { 
      getSession: async () => ({ data: { session: { user: { id: "mock-admin-id", email: "admin@mock.com" } } } }),
      getUser: async () => ({ data: { user: { id: "mock-admin-id", email: "admin@mock.com" } } }),
      updateUser: async () => ({ error: null })
    },
    rpc: async () => ({ data: {}, error: null }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "mock-url" } })
      })
    }
  };
}

type ProfileRole = "owner" | "admin" | "member";
type InviteStatus = "pending" | "accepted" | "cancelled" | "expired";

type Profile = {
  id: string;
  family_id: string | null;
  email?: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  role: ProfileRole | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Family = {
  id: string;
  name: string;
  avatar_url?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FamilyInvite = {
  id: string;
  family_id: string;
  email: string;
  invited_name?: string | null;
  role: "admin" | "member";
  invite_token: string;
  status: InviteStatus;
  invited_by?: string | null;
  accepted_by?: string | null;
  expires_at: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type DashboardData = {
  family_id: string | null;
  my_role: ProfileRole | null;
  family: Family | null;
  counts: {
    members_total: number;
    members_active: number;
    admins_total: number;
    unassigned_total: number;
    invites_pending?: number;
  };
};

function withTimeout(promise: Promise<any>, ms = 20000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout na operação com Supabase.")), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .toLowerCase();
}

export default function AdminPage() {
  const router = typeof useRouter === 'function' ? useRouter() : mockRouter;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [sessionUser, setSessionUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [myFamily, setMyFamily] = useState<Family | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [familyInvites, setFamilyInvites] = useState<FamilyInvite[]>([]);

  const [isEditingMe, setIsEditingMe] = useState(false);
  const [myNameInput, setMyNameInput] = useState("");

  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState("");

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberNameInput, setMemberNameInput] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  const canManageMembers = myProfile?.role === "owner" || myProfile?.role === "admin";
  const isOwner = myProfile?.role === "owner";

  const normalizedAvailableProfiles = useMemo(() => {
    return (availableProfiles || []).filter((p) => p.id !== myProfile?.id);
  }, [availableProfiles, myProfile?.id]);

  const normalizedFamilyMembers = useMemo(() => {
    return [...(familyMembers || [])].sort((a, b) => {
      const weight = (role?: string | null) => {
        if (role === "owner") return 0;
        if (role === "admin") return 1;
        return 2;
      };
      return weight(a.role) - weight(b.role);
    });
  }, [familyMembers]);

  const pendingInvites = useMemo(() => {
    return (familyInvites || []).filter((invite) => invite.status === "pending");
  }, [familyInvites]);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    setErrorMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não estão definidas.");
      }

      const user = await getAuthenticatedUser();
      setSessionUser(user);

      const profile = await ensureProfileViaRpc(user);
      setMyProfile(profile);

      await refreshAllData(profile);
    } catch (error: any) {
      console.error("Erro no initialize()", error);
      setErrorMessage(error?.message || "Erro ao carregar o painel admin.");
    } finally {
      setLoading(false);
    }
  }

  async function getAuthenticatedUser() {
    const userResponse = await withTimeout(supabase.auth.getUser(), 15000);
    const user = userResponse.data?.user;

    if (!user) {
      if (typeof window !== 'undefined' && typeof router.push === 'function') {
        router.push("/login");
      }
      throw new Error("Usuário não autenticado.");
    }

    return user;
  }

  async function ensureProfileViaRpc(user: any): Promise<Profile> {
    const fallbackName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Usuário";

    const { data, error } = await withTimeout(
      supabase.rpc("upsert_my_profile", {
        p_email: user.email ?? null,
        p_display_name: fallbackName,
        p_full_name: fallbackName,
      }),
      15000
    );

    if (error) {
      throw new Error(`Erro ao sincronizar perfil: ${error.message}`);
    }

    return data as Profile;
  }

  async function refreshAllData(baseProfile?: Profile | null) {
    const profile = baseProfile || myProfile;

    const dashboardResponse = await withTimeout(supabase.rpc("get_my_admin_dashboard"), 15000);
    if (dashboardResponse.error) {
      throw new Error(`Erro ao carregar dashboard: ${dashboardResponse.error.message}`);
    }

    const dashboardData = dashboardResponse.data as DashboardData;
    setDashboard(dashboardData || null);
    setMyFamily((dashboardData?.family as Family) || null);

    if (profile?.family_id || dashboardData?.family_id) {
      const familyMembersResponse = await withTimeout(supabase.rpc("list_my_family_members"), 15000);
      if (familyMembersResponse.error) {
        throw new Error(`Erro ao carregar membros da família: ${familyMembersResponse.error.message}`);
      }

      const members = (familyMembersResponse.data || []) as Profile[];
      setFamilyMembers(members);

      const meFromMembers = members.find((member) => member.id === profile?.id);
      if (meFromMembers) {
        setMyProfile(meFromMembers);
      }

      const invitesResponse = await withTimeout(supabase.rpc("list_my_family_invites"), 15000);
      if (invitesResponse.error) {
        throw new Error(`Erro ao carregar convites: ${invitesResponse.error.message}`);
      }

      setFamilyInvites((invitesResponse.data || []) as FamilyInvite[]);
    } else {
      setFamilyMembers(profile ? [profile] : []);
      setFamilyInvites([]);
    }

    const availableResponse = await withTimeout(supabase.rpc("list_unassigned_profiles"), 15000);
    if (availableResponse.error) {
      throw new Error(`Erro ao carregar perfis disponíveis: ${availableResponse.error.message}`);
    }

    setAvailableProfiles((availableResponse.data || []) as Profile[]);
  }

  function getDisplayName(profile: Profile | null) {
    if (!profile) return "Usuário";
    return profile.display_name || profile.full_name || profile.email || "Usuário sem nome";
  }

  function getRoleLabel(role?: string | null) {
    if (role === "owner") return "OWNER";
    if (role === "admin") return "ADMIN";
    return "MEMBER";
  }

  function getFamilyStatusLabel(profile: Profile) {
    if (!profile.family_id) return "Sem família";
    if (myProfile?.family_id && profile.family_id === myProfile.family_id) return "Na sua família";
    return "Outra família";
  }

  function getInitials(name?: string | null) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function formatDate(date?: string | null) {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleString("pt-BR");
    } catch {
      return date;
    }
  }

  async function syncAuthMetadata(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { error } = await withTimeout(
      supabase.auth.updateUser({
        data: {
          full_name: trimmed,
          display_name: trimmed,
          name: trimmed,
        },
      }),
      15000
    );

    if (error) {
      throw new Error(`Erro ao atualizar metadados do Auth: ${error.message}`);
    }
  }

  async function uploadProfileAvatar(file: File, targetUserId?: string) {
    const userId = targetUserId || myProfile?.id || sessionUser?.id;
    if (!userId) throw new Error("Usuário inválido para upload de avatar.");

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}-${safeFileName(file.name || `file.${extension}`)}`;

    const uploadResponse = await withTimeout(
      supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      }),
      30000
    );

    if (uploadResponse.error) {
      throw new Error(`Erro no upload do avatar: ${uploadResponse.error.message}`);
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    if (!publicUrl) {
      throw new Error("Não foi possível obter a URL pública do avatar.");
    }

    return publicUrl;
  }

  async function uploadFamilyAvatar(file: File) {
    const fId = myProfile?.family_id || myFamily?.id;
    if (!fId) throw new Error("Família não encontrada para upload.");
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${fId}/family-${Date.now()}-${safeFileName(file.name || `file.${extension}`)}`;

    const uploadResponse = await withTimeout(
      supabase.storage.from("family-assets").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      }),
      30000
    );

    if (uploadResponse.error) {
      throw new Error(`Erro no upload da foto da família: ${uploadResponse.error.message}`);
    }

    const { data } = supabase.storage.from("family-assets").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    if (!publicUrl) {
      throw new Error("Não foi possível obter a URL pública da foto da família.");
    }

    return publicUrl;
  }

  async function handleRefresh() {
    setBusy(true);
    setErrorMessage("");

    try {
      const user = await getAuthenticatedUser();
      setSessionUser(user);

      const profile = await ensureProfileViaRpc(user);
      setMyProfile(profile);

      await refreshAllData(profile);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar painel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMyName() {
    const name = myNameInput.trim();
    if (!name) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const profileResponse = await withTimeout(
        supabase.rpc("update_my_profile_name", {
          p_display_name: name,
          p_full_name: name,
        }),
        15000
      );

      if (profileResponse.error) {
        throw new Error(profileResponse.error.message);
      }

      await syncAuthMetadata(name);

      setMyProfile(profileResponse.data as Profile);
      setIsEditingMe(false);
      setMyNameInput("");

      const user = await getAuthenticatedUser();
      setSessionUser(user);

      await refreshAllData(profileResponse.data as Profile);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar seu nome.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMyAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const publicUrl = await uploadProfileAvatar(file);

      const { data, error } = await withTimeout(
        supabase.rpc("update_my_avatar", {
          p_avatar_url: publicUrl,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      setMyProfile(data as Profile);
      await refreshAllData(data as Profile);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar avatar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFamilyAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const publicUrl = await uploadFamilyAvatar(file);

      const { data, error } = await withTimeout(
        supabase.rpc("update_my_family_avatar", {
          p_avatar_url: publicUrl,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      setMyFamily(data as Family);
      await refreshAllData();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar foto da família.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFamily() {
    const baseName = myProfile?.display_name || myProfile?.full_name || "Minha";
    const firstName = baseName.split(" ")[0];
    const fallbackFamilyName = `Família ${firstName}`;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("create_my_family", {
          p_family_name: fallbackFamilyName,
        }),
        15000
      );

      if (error) {
        throw new Error(`Erro ao criar família: ${error.message}`);
      }

      const user = await getAuthenticatedUser();
      const profile = await ensureProfileViaRpc(user);
      setMyProfile(profile);

      await refreshAllData(profile);
      alert("Família criada com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao criar família.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameFamily() {
    const name = familyNameInput.trim();
    if (!name) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { data, error } = await withTimeout(
        supabase.rpc("rename_my_family", {
          p_family_name: name,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      setMyFamily(data as Family);
      setIsEditingFamilyName(false);
      setFamilyNameInput("");
      await refreshAllData();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao renomear família.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMemberName(targetId: string) {
    const name = memberNameInput.trim();
    if (!name) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_update_member_name", {
          p_target_profile_id: targetId,
          p_display_name: name,
          p_full_name: name,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      setEditingMemberId(null);
      setMemberNameInput("");
      await refreshAllData();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar nome do membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMemberAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>,
    targetId: string
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const publicUrl = await uploadProfileAvatar(file, targetId);

      const { error } = await withTimeout(
        supabase.rpc("admin_update_member_avatar", {
          p_target_profile_id: targetId,
          p_avatar_url: publicUrl,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao atualizar avatar do membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(targetId: string) {
    const confirmed = window.confirm("Deseja unir este usuário à sua família?");
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_add_member_to_my_family", {
          p_target_profile_id: targetId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Usuário vinculado com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao vincular usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(targetId: string) {
    const confirmed = window.confirm("Deseja remover este membro da sua família?");
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_remove_member_from_my_family", {
          p_target_profile_id: targetId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Membro removido com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao remover membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeMemberRole(targetId: string, newRole: "admin" | "member") {
    const confirmed = window.confirm(`Deseja alterar o papel deste usuário para ${newRole.toUpperCase()}?`);
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_change_member_role", {
          p_target_profile_id: targetId,
          p_new_role: newRole,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Papel atualizado com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao alterar papel.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership(targetId: string) {
    const confirmed = window.confirm(
      "Deseja transferir o ownership da família? Você deixará de ser OWNER e passará a ser ADMIN."
    );
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("transfer_family_ownership", {
          p_target_profile_id: targetId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Ownership transferido com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao transferir ownership.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivateMember(targetId: string) {
    const confirmed = window.confirm("Deseja desativar este membro?");
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_deactivate_member", {
          p_target_profile_id: targetId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Membro desativado com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao desativar membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivateMember(targetId: string) {
    const confirmed = window.confirm("Deseja reativar este membro?");
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("admin_reactivate_member", {
          p_target_profile_id: targetId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Membro reativado com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao reativar membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateInvite() {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();

    if (!email) {
      setErrorMessage("Informe o e-mail do convidado.");
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("create_family_invite", {
          p_email: email,
          p_invited_name: name || null,
          p_role: inviteRole,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
      await refreshAllData();
      alert("Convite criado com sucesso.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao criar convite.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    const confirmed = window.confirm("Deseja cancelar este convite?");
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");

    try {
      const { error } = await withTimeout(
        supabase.rpc("cancel_family_invite", {
          p_invite_id: inviteId,
        }),
        15000
      );

      if (error) {
        throw new Error(error.message);
      }

      await refreshAllData();
      alert("Convite cancelado.");
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error?.message || "Erro ao cancelar convite.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6">
        <RefreshCw className="w-10 h-10 text-zinc-600 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
          Carregando painel admin
        </p>
        <p className="text-xs text-zinc-600 mt-3">Aguarde enquanto sincronizamos seu ambiente.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-10 space-y-8">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-zinc-900 pb-8">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Ledger
            </button>

            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight">ADMIN</h1>
              <p className="text-sm text-zinc-500 font-semibold mt-2">
                Gestão completa de perfis, fotos, família, convites, papéis e membros
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </header>

        {errorMessage && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-bold">Erro detectado</p>
                <p className="text-sm opacity-90 break-words">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* CARD 1: SEU PERFIL */}
          <div className="xl:col-span-2 rounded-3xl border border-zinc-900 bg-zinc-900/40 p-6">
            <div className="flex items-start gap-4">
              <div className="relative">
                {myProfile?.avatar_url ? (
                  <img
                    src={myProfile.avatar_url}
                    alt="Foto do perfil"
                    className="w-20 h-20 rounded-2xl object-cover border border-zinc-800"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-zinc-800 flex items-center justify-center text-lg font-black text-zinc-300">
                    {getInitials(getDisplayName(myProfile))}
                  </div>
                )}

                <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-xl bg-white text-black p-2 hover:bg-zinc-200">
                  <Upload className="w-4 h-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleMyAvatarChange} />
                </label>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-zinc-500 mb-2">
                  Seu perfil
                </p>

                {isEditingMe ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      autoFocus
                      value={myNameInput}
                      onChange={(e) => setMyNameInput(e.target.value)}
                      placeholder="Seu nome"
                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                    />
                    <button
                      onClick={handleUpdateMyName}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-500/20 px-4 py-3 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingMe(false);
                        setMyNameInput("");
                      }}
                      className="inline-flex items-center justify-center rounded-xl bg-red-500/20 px-4 py-3 text-red-400 hover:bg-red-500/30"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight">{getDisplayName(myProfile)}</h2>
                    <button
                      onClick={() => {
                        setMyNameInput(getDisplayName(myProfile));
                        setIsEditingMe(true);
                      }}
                      className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white"
                      title="Editar meu nome"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">
                      <Crown className="w-4 h-4" />
                      Papel
                    </div>
                    <p className="mt-2 font-medium uppercase">{getRoleLabel(myProfile?.role)}</p>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">
                      <Settings2 className="w-4 h-4" />
                      Família
                    </div>
                    <p className="mt-2 font-medium">{myFamily?.name || "Nenhuma família vinculada"}</p>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">
                      <Power className="w-4 h-4" />
                      Status
                    </div>
                    <p className="mt-2 font-medium uppercase">
                      {myProfile?.is_active === false ? "INATIVO" : "ATIVO"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">
                      <Link2 className="w-4 h-4" />
                      ID
                    </div>
                    <p className="mt-2 font-mono text-xs break-all">{myProfile?.id || sessionUser?.id || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: FAMÍLIA ATIVA */}
          <div className="xl:col-span-2 rounded-3xl border border-zinc-900 bg-zinc-900/40 p-6">
            {!myProfile?.family_id ? (
              <div className="h-full flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="rounded-2xl bg-white text-black p-4 w-fit">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Família não criada</h3>
                    <p className="text-sm text-zinc-500 mt-2">
                      Seu perfil existe, mas ainda não está vinculado a nenhum núcleo familiar.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCreateFamily}
                  disabled={busy}
                  className="w-full rounded-2xl bg-white px-5 py-4 text-black text-sm font-black uppercase tracking-[0.18em] hover:bg-zinc-200 disabled:opacity-50"
                >
                  {busy ? "Criando..." : "Criar minha família"}
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      {myFamily?.avatar_url ? (
                        <img
                          src={myFamily.avatar_url}
                          alt="Foto da família"
                          className="w-16 h-16 rounded-2xl object-cover border border-zinc-800"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                          <House className="w-7 h-7" />
                        </div>
                      )}

                      {canManageMembers && (
                        <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-xl bg-white text-black p-2 hover:bg-zinc-200">
                          <ImagePlus className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFamilyAvatarChange}
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex-1">
                      {isEditingFamilyName ? (
                        <div className="space-y-3">
                          <h3 className="text-xl font-black tracking-tight">Renomear família</h3>
                          <input
                            autoFocus
                            value={familyNameInput}
                            onChange={(e) => setFamilyNameInput(e.target.value)}
                            placeholder="Nome da família"
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleRenameFamily}
                              disabled={busy}
                              className="inline-flex items-center justify-center rounded-xl bg-emerald-500/20 px-4 py-3 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingFamilyName(false);
                                setFamilyNameInput("");
                              }}
                              className="inline-flex items-center justify-center rounded-xl bg-red-500/20 px-4 py-3 text-red-400 hover:bg-red-500/30"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black tracking-tight">
                              {myFamily?.name || "Família ativa"}
                            </h3>

                            {canManageMembers && (
                              <button
                                onClick={() => {
                                  setFamilyNameInput(myFamily?.name || "");
                                  setIsEditingFamilyName(true);
                                }}
                                className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white"
                                title="Editar nome da família"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <p className="text-sm text-zinc-500 mt-2">
                            Ambiente familiar ativo com gestão centralizada.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* NOVA SECÇÃO: MEMBROS DA FAMÍLIA */}
        {myProfile?.family_id && (
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-zinc-400" />
                <h2 className="text-xl font-bold">Membros do Núcleo</h2>
              </div>
              <div className="text-xs font-mono text-zinc-500">
                {normalizedFamilyMembers.length} {normalizedFamilyMembers.length === 1 ? "membro" : "membros"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {normalizedFamilyMembers.map((member) => {
                const isMe = member.id === myProfile?.id;
                return (
                  <div key={member.id} className="rounded-3xl border border-zinc-900 bg-zinc-950/50 p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt="Foto"
                            className="w-14 h-14 rounded-[1.25rem] object-cover border border-zinc-800"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-[1.25rem] bg-zinc-900 flex items-center justify-center text-sm font-black text-zinc-400">
                            {getInitials(getDisplayName(member))}
                          </div>
                        )}
                        {canManageMembers && !isMe && (
                          <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-lg bg-zinc-800 text-white p-1.5 hover:bg-zinc-700">
                            <Upload className="w-3 h-3" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleMemberAvatarChange(e, member.id)}
                            />
                          </label>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {editingMemberId === member.id ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={memberNameInput}
                              onChange={(e) => setMemberNameInput(e.target.value)}
                              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm outline-none w-full"
                            />
                            <button
                              onClick={() => handleUpdateMemberName(member.id)}
                              className="rounded-lg bg-emerald-500/20 px-3 py-1 text-emerald-400"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingMemberId(null)}
                              className="rounded-lg bg-red-500/20 px-3 py-1 text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className={`font-bold truncate ${!member.is_active ? "text-zinc-600 line-through" : "text-white"}`}>
                              {getDisplayName(member)} {isMe && "(Você)"}
                            </p>
                            {canManageMembers && !isMe && member.is_active && (
                              <button
                                onClick={() => {
                                  setEditingMemberId(member.id);
                                  setMemberNameInput(getDisplayName(member));
                                }}
                                className="text-zinc-500 hover:text-white"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            member.role === "owner" ? "bg-amber-500/10 text-amber-500" :
                            member.role === "admin" ? "bg-blue-500/10 text-blue-400" :
                            "bg-zinc-800 text-zinc-400"
                          }`}>
                            {getRoleLabel(member.role)}
                          </span>
                          {!member.is_active && (
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-red-500/10 text-red-500">
                              INATIVO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações Administrativas para o Membro */}
                    {canManageMembers && !isMe && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-zinc-900/50">
                        {isOwner && member.is_active && (
                          <>
                            <button
                              onClick={() => handleChangeMemberRole(member.id, member.role === "admin" ? "member" : "admin")}
                              className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition flex items-center gap-1.5"
                            >
                              <UserCog2 className="w-3 h-3" />
                              Tornar {member.role === "admin" ? "Membro" : "Admin"}
                            </button>
                            
                            {member.role === "admin" && (
                              <button
                                onClick={() => handleTransferOwnership(member.id)}
                                className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                              >
                                <Crown className="w-3 h-3" />
                                Dar Posse
                              </button>
                            )}
                          </>
                        )}
                        
                        {member.is_active ? (
                          <>
                            {isOwner && (
                              <button
                                onClick={() => handleDeactivateMember(member.id)}
                                className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition flex items-center gap-1.5"
                              >
                                <PowerOff className="w-3 h-3" />
                                Desativar
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 transition flex items-center gap-1.5 ${isOwner ? 'ml-auto' : ''}`}
                            >
                              <UserMinus2 className="w-3 h-3" />
                              Remover
                            </button>
                          </>
                        ) : (
                          isOwner && (
                            <button
                              onClick={() => handleReactivateMember(member.id)}
                              className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition flex items-center gap-1.5"
                            >
                              <Power className="w-3 h-3" />
                              Reativar
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* NOVA SECÇÃO: USUÁRIOS DISPONÍVEIS PARA VINCULAR (Sem Família) */}
        {canManageMembers && normalizedAvailableProfiles.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
              <UserPlus2 className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-bold">Usuários Livres na Plataforma</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {normalizedAvailableProfiles.map((p) => (
                <div key={p.id} className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400">
                      {getInitials(getDisplayName(p))}
                    </div>
                    <p className="font-bold text-sm truncate text-zinc-300">{getDisplayName(p)}</p>
                  </div>
                  <button
                    onClick={() => handleAddMember(p.id)}
                    className="ml-4 shrink-0 rounded-lg bg-emerald-500/10 p-2 text-emerald-400 hover:bg-emerald-500/20 transition"
                    title="Vincular à família"
                  >
                    <UserPlus2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NOVA SECÇÃO: CONVITES VIA E-MAIL */}
        {canManageMembers && (
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
              <Mail className="w-5 h-5 text-zinc-400" />
              <h2 className="text-xl font-bold">Convites por E-mail</h2>
            </div>

            <div className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 space-y-2">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest ml-1">E-mail do Convidado</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest ml-1">Nome (Opcional)</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ex: João"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest ml-1">Papel</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none appearance-none"
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    onClick={handleCreateInvite}
                    disabled={busy || !inviteEmail}
                    className="w-full rounded-xl bg-white px-4 py-3 text-black text-sm font-black uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-50 transition"
                  >
                    Enviar Convite
                  </button>
                </div>
              </div>

              {pendingInvites.length > 0 && (
                <div className="mt-8 space-y-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Convites Pendentes</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between rounded-xl bg-zinc-950 border border-zinc-800 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{invite.email}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                            {invite.role} • Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="shrink-0 p-2 text-zinc-500 hover:text-red-400 transition"
                          title="Cancelar convite"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-zinc-800 p-3">
              <ShieldAlert className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Observações técnicas</h3>
              <p className="text-sm text-zinc-500">
                Este painel depende das RPCs administrativas e dos buckets de storage já presentes no seu backend.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
            <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold">RPC crítica</p>
              <p className="mt-2 font-semibold">upsert_my_profile</p>
            </div>

            <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Dashboard</p>
              <p className="mt-2 font-semibold">get_my_admin_dashboard</p>
            </div>

            <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Storage</p>
              <p className="mt-2 font-semibold">avatars / family-assets</p>
            </div>

            <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-bold">Convites</p>
              <p className="mt-2 font-semibold">create_family_invite / cancel_family_invite</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}