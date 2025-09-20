import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type Profile, type ProfileUpdate, type SignUpInput, type SignUpResult, type UserRole } from "@/services";

export type { UserRole, Profile };
export type AccountStatus = Profile["status"];

interface AuthContextValue {
  profile: Profile | null;
  isLoading: boolean;
  isDemo: boolean;
  /** Signs in and verifies the account belongs to `role`. */
  signIn: (email: string, password: string, role: UserRole) => Promise<Profile>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  demoSignIn: (role: UserRole) => Promise<Profile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<Profile>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    api.auth
      .getProfile()
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null))
      .finally(() => !cancelled && setIsLoading(false));

    const unsubscribe = api.auth.onChange((p) => {
      if (cancelled) return;
      setProfile((prev) => {
        // a different user (or sign-out): drop everything cached for the previous one
        if (prev?.id !== p?.id) queryClient.clear();
        return p;
      });
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string, role: UserRole) => {
    const p = await api.auth.signIn(email, password);
    if (p.user_type !== role) {
      await api.auth.signOut();
      throw new Error(`This account is registered as ${p.user_type === "admin" ? "an admin" : `a ${p.user_type}`}. Use that login page instead.`);
    }
    if (p.user_type === "farmer" && p.status !== "approved") {
      await api.auth.signOut();
      throw new Error(
        p.status === "pending"
          ? "Your registration is still awaiting admin approval."
          : "Your account has been suspended. Please contact the MilkyWay team."
      );
    }
    // Set before resolving so navigation after `await signIn()` sees the profile
    // (previously the guard could run first and bounce the user to "/").
    setProfile(p);
    return p;
  }, []);

  const demoSignIn = useCallback(async (role: UserRole) => {
    if (!api.auth.demoSignIn) throw new Error("Demo sign-in is only available in demo mode");
    const p = await api.auth.demoSignIn(role);
    setProfile(p);
    return p;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await api.auth.signUp(input);
    if (result.active) setProfile(await api.auth.getProfile());
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.signOut();
    setProfile(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    setProfile(await api.auth.getProfile());
  }, []);

  const updateProfile = useCallback(async (patch: ProfileUpdate) => {
    const p = await api.auth.updateProfile(patch);
    setProfile(p);
    return p;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      isLoading,
      isDemo: api.mode === "demo",
      signIn,
      signUp,
      demoSignIn,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [profile, isLoading, signIn, signUp, demoSignIn, signOut, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
