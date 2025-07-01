import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "farmer" | "customer" | "delivery";
export type AccountStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  email: string;
  user_type: UserRole;
  status: AccountStatus;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, user_type, status, first_name, last_name, phone, address")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as unknown as Profile;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (next: Session | null) => {
      if (cancelled) return;
      setSession(next);
      if (next?.user) {
        const p = await fetchProfile(next.user.id);
        if (!cancelled) setProfile(p);
      } else {
        setProfile(null);
      }
      if (!cancelled) setIsLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      void applySession(current);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      refreshProfile: async () => {
        if (session?.user) {
          setProfile(await fetchProfile(session.user.id));
        }
      },
    }),
    [session, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
