import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, UserRound } from "lucide-react";
import { InitialsAvatar } from "@/components/common/Brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { fullName } from "@/lib/format";
import { ROLE_META } from "@/lib/roles";

export function UserMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  if (!profile) return null;
  const name = fullName(profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <InitialsAvatar name={name} className="h-9 w-9 text-xs" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          <p className="mt-1 text-xs font-semibold text-primary">{ROLE_META[profile.user_type].label}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={`/dashboard/${profile.user_type}/settings`}>
            <UserRound className="mr-2 h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/dashboard/${profile.user_type}/settings`}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
