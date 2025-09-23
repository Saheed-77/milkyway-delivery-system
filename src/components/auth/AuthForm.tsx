import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { errorMessage } from "@/hooks/api/core";
import { ROLE_META } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { LocationPickerField, type PickedLocation } from "@/components/maps/LocationPickerField";

interface AuthFormProps {
  userType: UserRole;
}

const passwordRules: [RegExp | ((s: string) => boolean), string][] = [
  [(s) => s.length >= 8, "8+ characters"],
  [/[A-Z]/, "Uppercase letter"],
  [/[a-z]/, "Lowercase letter"],
  [/[0-9]/, "Number"],
  [/[^A-Za-z0-9]/, "Special character"],
];
const passes = (rule: RegExp | ((s: string) => boolean), value: string) =>
  typeof rule === "function" ? rule(value) : rule.test(value);

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

const phoneSchema = z.string().trim().regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number");

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

type Values = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  farmName: string;
  farmLocation: string;
  address: string;
  phone: string;
  licenseNumber: string;
};

const EMPTY: Values = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  farmName: "",
  farmLocation: "",
  address: "",
  phone: "",
  licenseNumber: "",
};

export const AuthForm = ({ userType }: AuthFormProps) => {
  const [values, setValues] = useState<Values>(EMPTY);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { signIn, signUp } = useAuth();
  const meta = ROLE_META[userType];

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const passwordOk = passwordRules.every(([rule]) => passes(rule, values.password));

  const validate = () => {
    const schema = isSignUp ? signUpSchemas[userType] : loginSchema;
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      next[key] ??= issue.message;
    }
    setErrors(next);
    return false;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp({
          role: userType,
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || undefined,
          address: location?.address || values.address || undefined,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          farmName: values.farmName || undefined,
          farmLocation: values.farmLocation || undefined,
          licenseNumber: values.licenseNumber || undefined,
        });
        toast.success(result.message);
        if (result.active) navigate(`/dashboard/${userType}`, { replace: true });
        else {
          setIsSignUp(false);
          setValues((v) => ({ ...EMPTY, email: v.email }));
        }
      } else {
        const p = await signIn(values.email, values.password, userType);
        toast.success(`Welcome back, ${p.first_name ?? "there"}!`);
        const from = (routeLocation.state as { from?: string } | null)?.from;
        navigate(from?.startsWith(`/dashboard/${userType}`) ? from : `/dashboard/${userType}`, { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const field = (
    name: keyof Values,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
    extra?: ReactNode
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        value={values[name]}
        onChange={set(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className={cn(errors[name] && "border-destructive focus-visible:ring-destructive")}
        {...props}
      />
      {extra}
      {errors[name] && (
        <p id={`${name}-error`} className="text-xs font-medium text-destructive">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">
          {isSignUp ? (userType === "farmer" ? "Register your farm" : `Create a ${meta.noun} account`) : "Welcome back"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isSignUp ? meta.tagline : `Sign in to your ${meta.noun} dashboard.`}
        </p>
      </div>

      {isSignUp && (
        <div className="grid grid-cols-2 gap-3">
          {field("firstName", "First name", { placeholder: "Priya", autoComplete: "given-name", maxLength: 100 })}
          {field("lastName", "Last name", { placeholder: "Raman", autoComplete: "family-name", maxLength: 100 })}
        </div>
      )}

      {field("email", "Email", { type: "email", placeholder: "you@example.com", autoComplete: "email", maxLength: 254 })}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={values.password}
            onChange={set("password")}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : isSignUp ? "password-rules" : undefined}
            className={cn("pr-10", errors.password && "border-destructive")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs font-medium text-destructive">
            {errors.password}
          </p>
        )}
        {isSignUp && values.password.length > 0 && (
          <ul id="password-rules" className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs sm:grid-cols-3">
            {passwordRules.map(([rule, text]) => {
              const ok = passes(rule, values.password);
              return (
                <li key={text} className={cn("flex items-center gap-1", ok ? "text-success" : "text-muted-foreground")}>
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {text}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isSignUp && userType === "farmer" && (
        <>
          {field("farmName", "Farm name", { placeholder: "Green Valley Farm", maxLength: 200 })}
          {field("farmLocation", "Farm location", { placeholder: "Aluva, Ernakulam", maxLength: 500 })}
        </>
      )}

      {isSignUp && userType === "customer" && (
        <>
          {field("phone", "Phone", { type: "tel", placeholder: "+91 98765 43210", autoComplete: "tel", maxLength: 20 })}
          {field("address", "Delivery address", { placeholder: "House, street, area", autoComplete: "street-address", maxLength: 500 })}
          <LocationPickerField
            value={location}
            onChange={(loc) => {
              setLocation(loc);
              if (loc?.address && !values.address) setValues((v) => ({ ...v, address: loc.address! }));
            }}
            label="Pin your doorstep (optional)"
            hint="Riders navigate straight to this pin."
          />
        </>
      )}

      {isSignUp && userType === "delivery" && (
        <>
          {field("phone", "Phone", { type: "tel", placeholder: "+91 98765 43210", autoComplete: "tel", maxLength: 20 })}
          {field("licenseNumber", "Driving licence number", { placeholder: "KL07 20210001234", maxLength: 50 })}
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isLoading || (isSignUp && !passwordOk)}>
        {isLoading && <Loader2 className="animate-spin" />}
        {isSignUp ? (userType === "farmer" ? "Submit registration" : "Create account") : "Sign in"}
      </Button>

      {userType !== "admin" ? (
        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "New to MilkyWay?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp((s) => !s);
              setErrors({});
            }}
            className="font-semibold text-primary hover:underline"
          >
            {isSignUp ? "Sign in" : userType === "farmer" ? "Register your farm" : "Create an account"}
          </button>
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Admin accounts are provisioned by the MilkyWay team.
        </p>
      )}
    </form>
  );
};
