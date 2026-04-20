import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agent" | "viewer";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function syncAuth(sess: Session | null) {
      if (!mounted) return;
      setLoading(true);
      setSession(sess);
      setUser(sess?.user ?? null);

      if (!sess?.user) {
        setRoles([]);
        if (mounted) setLoading(false);
        return;
      }

      const nextRoles = await fetchRoles(sess.user.id);
      if (!mounted) return;
      setRoles(nextRoles);
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setTimeout(() => {
        void syncAuth(sess);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      void syncAuth(sess);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchRoles(userId: string): Promise<AppRole[]> {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return (data?.map((r) => r.role) as AppRole[]) ?? [];
  }

  const hasRole = (r: AppRole) => roles.includes(r);
  const isAdmin = hasRole("admin");
  const isAgent = hasRole("agent") || isAdmin;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, roles, loading, hasRole, isAdmin, isAgent, signOut };
}
