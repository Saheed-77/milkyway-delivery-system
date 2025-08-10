import type { AuthApi } from "../api";
import type { Profile, SignUpInput } from "../types";
import { mapProfile, must, PROFILE_COLUMNS, sb } from "./shared";

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await sb().from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error || !data) return null;
  return mapProfile(data);
}

export const supabaseAuth: AuthApi = {
  async getProfile() {
    const { data } = await sb().auth.getSession();
    return data.session?.user ? fetchProfile(data.session.user.id) : null;
  },

  onChange(cb) {
    const {
      data: { subscription },
    } = sb().auth.onAuthStateChange((_event, session) => {
      // Defer: calling Supabase inside the callback can deadlock the auth lock.
      setTimeout(async () => {
        cb(session?.user ? await fetchProfile(session.user.id) : null);
      }, 0);
    });
    return () => subscription.unsubscribe();
  },

  async signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const profile = data.user ? await fetchProfile(data.user.id) : null;
    if (!profile) {
      await sb().auth.signOut();
      throw new Error("Could not load your profile. Please try again.");
    }
    return profile;
  },

  async signUp(input: SignUpInput) {
    const metadata: Record<string, string> = {
      user_type: input.role,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
    };
    if (input.phone) metadata.phone = input.phone.trim();
    if (input.address) metadata.address = input.address.trim();
    if (input.farmName) metadata.farm_name = input.farmName.trim();
    if (input.farmLocation) metadata.farm_location = input.farmLocation.trim();
    if (input.licenseNumber) metadata.license_number = input.licenseNumber.trim();

    const { data, error } = await sb().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: metadata },
    });
    if (error) throw new Error(error.message);

    // Save the pinned delivery location once we have a session.
    if (data.session && input.latitude != null && input.longitude != null) {
      await sb()
        .from("profiles")
        .update({ latitude: input.latitude, longitude: input.longitude })
        .eq("id", data.session.user.id);
    }

    if (input.role === "farmer") {
      if (data.session) await sb().auth.signOut();
      return { active: false, message: "Registration submitted. An admin will review it shortly." };
    }
    return data.session
      ? { active: true, message: "Account created — you're signed in." }
      : { active: false, message: "Check your email to confirm your account, then log in." };
  },

  async signOut() {
    await sb().auth.signOut();
  },

  async updateProfile(patch) {
    const { data: session } = await sb().auth.getSession();
    const id = session.session?.user.id;
    if (!id) throw new Error("Not authenticated");
    const row = must(await sb().from("profiles").update(patch).eq("id", id).select(PROFILE_COLUMNS).single());
    return mapProfile(row);
  },
};
