import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X } from "lucide-react";
import type { UserRole } from "@/contexts/AuthContext";

interface AuthFormProps {
  userType: UserRole;
}

const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

const baseSignUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: passwordSchema,
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
});

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number");

const signUpSchemas: Record<UserRole, z.ZodTypeAny> = {
  admin: baseSignUpSchema,
  customer: baseSignUpSchema.extend({
    address: z.string().trim().min(5, "Address is required").max(500),
    phone: phoneSchema,
  }),
  farmer: baseSignUpSchema.extend({
    farmName: z.string().trim().min(1, "Farm name is required").max(200),
    farmLocation: z.string().trim().min(1, "Farm location is required").max(500),
  }),
  delivery: baseSignUpSchema.extend({
    licenseNumber: z.string().trim().min(4, "License number is required").max(50),
    phone: phoneSchema,
  }),
};

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  const validate = (): boolean => {
    const values = {
      email,
      password,
      firstName,
      lastName,
      farmName,
      farmLocation,
      address,
      phone,
      licenseNumber,
    };
    const schema = isSignUp ? signUpSchemas[userType] : loginSchema;
    const result = schema.safeParse(values);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    setFieldErrors(errors);
    return false;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    try {
      if (isSignUp) {
        const userMetadata: Record<string, string> = {
          user_type: userType,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        };
        if (userType === "farmer") {
          userMetadata.farm_name = farmName.trim();
          userMetadata.farm_location = farmLocation.trim();
        } else if (userType === "customer") {
          userMetadata.address = address.trim();
          userMetadata.phone = phone.trim();
        } else if (userType === "delivery") {
          userMetadata.license_number = licenseNumber.trim();
          userMetadata.phone = phone.trim();
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: userMetadata },
        });

        if (signUpError) throw signUpError;

        if (userType === "farmer") {
          toast({
            title: "Registration Submitted",
            description:
              "Your registration is pending admin approval. You will be notified when approved.",
          });
          navigate("/");
          return;
        }

        toast({
          title: "Success!",
          description: "Please check your email to verify your account.",
        });
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;
        if (!data.user) throw new Error("No user data returned");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_type, status")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          throw new Error("Could not load your profile. Please try again.");
        }

        if (profile.user_type !== userType) {
          await supabase.auth.signOut();
          throw new Error(
            `This account is registered as a ${profile.user_type}. Please use the correct login page.`
          );
        }

        if (userType === "farmer" && profile.status !== "approved") {
          await supabase.auth.signOut();
          throw new Error("Your account is pending admin approval.");
        }

        toast({ title: "Welcome back!", description: "You have been logged in." });
        navigate(`/dashboard/${userType}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred during authentication";
      toast({ title: "Error", description: message, variant: "destructive" });
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

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="text-sm text-red-600">{fieldErrors[name]}</p>
    ) : null;

  const renderUserSpecificFields = () => {
    if (!isSignUp) return null;

    switch (userType) {
      case "farmer":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="farmName">Farm Name</Label>
              <Input
                id="farmName"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="Green Valley Farm"
                maxLength={200}
                required
              />
              {fieldError("farmName")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="farmLocation">Farm Location</Label>
              <Input
                id="farmLocation"
                value={farmLocation}
                onChange={(e) => setFarmLocation(e.target.value)}
                placeholder="123 Rural Road, Country"
                maxLength={500}
                required
              />
              {fieldError("farmLocation")}
            </div>
          </>
        );
      case "customer":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                maxLength={500}
                required
              />
              {fieldError("address")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                maxLength={20}
                required
              />
              {fieldError("phone")}
            </div>
          </>
        );
      case "delivery":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Driver's License Number</Label>
              <Input
                id="licenseNumber"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="DL12345678"
                maxLength={50}
                required
              />
              {fieldError("licenseNumber")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                maxLength={20}
                required
              />
              {fieldError("phone")}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  const allowSignUpToggle = userType !== "admin";

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6 text-[#437358] capitalize">
        {isSignUp
          ? userType === "farmer"
            ? "Farmer Registration"
            : `${userType} Sign Up`
          : `${userType} Login`}
      </h2>
      <form onSubmit={handleAuth} className="space-y-4" noValidate>
        {isSignUp && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                maxLength={100}
                required
              />
              {fieldError("firstName")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                maxLength={100}
                required
              />
              {fieldError("lastName")}
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
            maxLength={254}
            autoComplete="email"
            required
          />
          {fieldError("email")}
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
                if (!isSignUp) setPasswordFocused(false);
              }}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {fieldError("password")}
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
          {isLoading
            ? "Loading..."
            : isSignUp
              ? userType === "farmer"
                ? "Submit Registration"
                : "Sign Up"
              : "Login"}
        </Button>
        {allowSignUpToggle && (
          <p className="text-center text-sm text-gray-600">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFieldErrors({});
              }}
              className="ml-1 text-[#437358] hover:underline"
            >
              {isSignUp ? "Login" : userType === "farmer" ? "Register" : "Sign Up"}
            </button>
          </p>
        )}
      </form>
    </div>
  );
};
