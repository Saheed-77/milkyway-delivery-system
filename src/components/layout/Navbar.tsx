
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

interface NavbarProps {
  showAuthButtons?: boolean;
}

export const Navbar = ({ showAuthButtons = true }: NavbarProps) => {
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        // Get the user's type from profiles
        const { data } = await supabase
          .from("profiles")
          .select("user_type, first_name, last_name")
          .eq("id", session.user.id)
          .single();
        
        if (data) {
          setUserType(data.user_type);
        }
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setUser(session?.user || null);
        if (session) {
          // When auth state changes, refetch user details
          fetchUser();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const isAuth = location.pathname.includes("/auth");
  const isDashboard = location.pathname.includes("/dashboard");

  return (
    <div className="w-full border-b bg-white">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-[#437358]">FarmFresh</span>
        </Link>

        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link to="/">
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Home
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            
            {userType && (
              <NavigationMenuItem>
                <Link to={`/dashboard/${userType}`}>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Dashboard
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )}
            
            {!user && showAuthButtons && (
              <>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Login</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-3 p-4 md:w-[300px]">
                      <li>
                        <Link to="/auth/admin">
                          <NavigationMenuLink className={cn(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          )}>
                            Admin
                          </NavigationMenuLink>
                        </Link>
                      </li>
                      <li>
                        <Link to="/auth/farmer">
                          <NavigationMenuLink className={cn(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          )}>
                            Farmer
                          </NavigationMenuLink>
                        </Link>
                      </li>
                      <li>
                        <Link to="/auth/customer">
                          <NavigationMenuLink className={cn(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          )}>
                            Customer
                          </NavigationMenuLink>
                        </Link>
                      </li>
                      <li>
                        <Link to="/auth/delivery">
                          <NavigationMenuLink className={cn(
                            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          )}>
                            Delivery
                          </NavigationMenuLink>
                        </Link>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </>
            )}
          </NavigationMenuList>
        </NavigationMenu>

        {user && !isAuth && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium hidden md:inline-block">
                {user.email}
              </span>
            </div>
            {!isDashboard && (
              <Button onClick={handleSignOut} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
