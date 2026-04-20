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
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => fetchRoles(sess.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchRoles(sess.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data?.map((r) => r.role) as AppRole[]) ?? []);
  }

  const hasRole = (r: AppRole) => roles.includes(r);
  const isAdmin = hasRole("admin");
  const isAgent = hasRole("agent") || isAdmin;

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, roles, loading, hasRole, isAdmin, isAgent, signOut };
}
