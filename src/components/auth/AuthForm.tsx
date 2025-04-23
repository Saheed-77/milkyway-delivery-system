
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Check, X } from "lucide-react";

interface AuthFormProps {
  userType: 'admin' | 'farmer' | 'customer' | 'delivery';
}

interface UserProfile {
  id: string;
  user_type: 'admin' | 'farmer' | 'customer' | 'delivery';
  status?: 'pending' | 'approved' | 'rejected';
}

export const AuthForm = ({ userType }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password validation criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Check if password meets criteria
        if (!isPasswordValid) {
          throw new Error("Password doesn't meet the security requirements");
        }
        
        // Prepare user metadata based on user type
        const userMetadata: Record<string, any> = {
          user_type: userType,
          first_name: firstName,
          last_name: lastName
        };
        
        // Add user type specific fields to metadata
        if (userType === 'farmer') {
          userMetadata.farm_name = farmName;
          userMetadata.farm_location = farmLocation;
        } else if (userType === 'customer') {
          userMetadata.address = address;
          userMetadata.phone = phone;
        } else if (userType === 'delivery') {
          userMetadata.license_number = licenseNumber;
          userMetadata.phone = phone;
        }

        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: userMetadata
          }
        });

        if (signUpError) throw signUpError;

        if (userType === 'farmer') {
          toast({
            title: "Registration Submitted",
            description: "Your registration is pending admin approval. You will be notified via email when approved.",
          });
          navigate('/');
          return;
        }

        toast({
          title: "Success!",
          description: "Please check your email to verify your account.",
        });
        
      } else {
        // Login logic
        const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (!user) throw new Error("No user data returned");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_type, status")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (!profile) throw new Error("No profile found");

        if (profile.user_type !== userType) {
          await supabase.auth.signOut();
          throw new Error(`This account is registered as a ${profile.user_type}. Please use the correct login page.`);
        }

        // For farmers, check if they're approved
        if (userType === 'farmer' && profile.status !== 'approved') {
          await supabase.auth.signOut();
          throw new Error("Your account is pending admin approval.");
        }

        toast({
          title: "Success!",
          description: "You have been logged in successfully.",
        });
        
        navigate(`/dashboard/${userType}`);
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
      await supabase.auth.signOut();
    } finally {
      setIsLoading(false);
    }
  };

  const renderPasswordRequirement = (isValid: boolean, text: string) => (
    <div className="flex items-center gap-2 text-sm">
      {isValid ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      )}
      <span className={isValid ? "text-green-600" : "text-gray-600"}>{text}</span>
    </div>
  );

  const renderUserSpecificFields = () => {
    if (!isSignUp) return null;

    switch(userType) {
      case 'farmer':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="farmName">Farm Name</Label>
              <Input
                id="farmName"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="Green Valley Farm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farmLocation">Farm Location</Label>
              <Input
                id="farmLocation"
                value={farmLocation}
                onChange={(e) => setFarmLocation(e.target.value)}
                placeholder="123 Rural Road, Country"
                required
              />
            </div>
          </>
        );
      case 'customer':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>
          </>
        );
      case 'delivery':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Driver's License Number</Label>
              <Input
                id="licenseNumber"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="DL12345678"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6 text-[#437358]">
        {isSignUp ? (userType === 'farmer' ? 'Farmer Registration' : `${userType} Sign Up`) : `${userType} Login`}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4">
        {isSignUp && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => {
                if (!isSignUp) {
                  setPasswordFocused(false);
                }
              }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        
        {isSignUp && (passwordFocused || password.length > 0) && (
          <div className="p-3 bg-gray-50 rounded-md mb-2">
            <p className="text-sm font-medium mb-2">Password must contain:</p>
            <div className="space-y-1">
              {renderPasswordRequirement(hasMinLength, "At least 8 characters")}
              {renderPasswordRequirement(hasUppercase, "At least one uppercase letter")}
              {renderPasswordRequirement(hasLowercase, "At least one lowercase letter")}
              {renderPasswordRequirement(hasNumber, "At least one number")}
              {renderPasswordRequirement(hasSpecialChar, "At least one special character")}
            </div>
          </div>
        )}
        
        {renderUserSpecificFields()}
        
        <Button
          type="submit"
          className="w-full bg-[#437358] hover:bg-[#345c46]"
          disabled={isLoading || (isSignUp && !isPasswordValid)}
        >
          {isLoading ? "Loading..." : isSignUp ? (userType === 'farmer' ? "Submit Registration" : "Sign Up") : "Login"}
        </Button>
        <p className="text-center text-sm text-gray-600">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-1 text-[#437358] hover:underline"
          >
            {isSignUp ? "Login" : (userType === 'farmer' ? "Register" : "Sign Up")}
          </button>
        </p>
      </form>
    </div>
  );
};
