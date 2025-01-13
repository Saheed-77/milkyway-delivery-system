
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

interface AuthFormProps {
  userType: 'admin' | 'farmer' | 'customer';
}

export const AuthForm = ({ userType }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              user_type: userType,
            }
          }
        });

        if (signUpError) throw signUpError;

        toast({
          title: "Success!",
          description: "Please check your email to verify your account.",
        });
      } else {
        // First, try to sign in
        const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (!user) throw new Error("No user data returned");

        // After successful login, get the user's profile to determine their type
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.user_type !== userType) {
          // If wrong user type, sign out immediately
          await supabase.auth.signOut();
          throw new Error(`This account is registered as a ${profile?.user_type}. Please use the correct login page.`);
        }

        toast({
          title: "Success!",
          description: "You have been logged in successfully.",
        });
        
        navigate(`/dashboard/${userType}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      // If there was an error, make sure user is signed out
      await supabase.auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6 text-[#437358]">
        {isSignUp ? `${userType} Sign Up` : `${userType} Login`}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-[#437358] hover:bg-[#345c46]"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
        </Button>
        <p className="text-center text-sm text-gray-600">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-1 text-[#437358] hover:underline"
          >
            {isSignUp ? "Login" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
};
