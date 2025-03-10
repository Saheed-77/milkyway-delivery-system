
import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  ChartBar, 
  Users, 
  Milk, 
  MessageSquare, 
  Truck, 
  Home, 
  Calendar, 
  CreditCard,
  ClipboardList,
  BarChart,
  Package,
  Check,
  Clock,
  Settings,
  BarChart3,
  FileText
} from "lucide-react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  url?: string;
}

interface DashboardSidebarProps {
  userType: "admin" | "farmer" | "customer" | "delivery";
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

export const DashboardSidebar = ({ 
  userType, 
  activeSection, 
  onSectionChange 
}: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems: MenuItem[] = useMemo(() => {
    switch (userType) {
      case "admin":
        return [
          { id: "dashboard", title: "Dashboard", icon: ChartBar },
          { id: "farmers", title: "Farmer Management", icon: Users },
          { id: "collections", title: "Milk Collections", icon: Milk },
          { id: "orders", title: "Customer Orders", icon: MessageSquare },
          { id: "delivery", title: "Delivery Management", icon: Truck },
          { id: "reports", title: "Reports", icon: BarChart3 },
        ];
      case "farmer":
        return [
          { id: "overview", title: "Overview", icon: Home, url: "/dashboard/farmer" },
          { id: "wallet", title: "Wallet", icon: CreditCard, url: "/dashboard/farmer" },
          { id: "history", title: "Contribution History", icon: ClipboardList, url: "/dashboard/farmer" },
          { id: "reports", title: "Weekly Reports", icon: BarChart, url: "/dashboard/farmer" },
        ];
      case "customer":
        return [
          { id: "orders", title: "My Orders", icon: Package },
          { id: "wallet", title: "Wallet", icon: CreditCard },
          { id: "subscriptions", title: "Subscriptions", icon: Calendar },
        ];
      case "delivery":
        return [
          { id: "overview", title: "Overview", icon: Home, url: "/dashboard/delivery" },
          { id: "pending", title: "Pending Deliveries", icon: Clock, url: "/dashboard/delivery/pending" },
          { id: "completed", title: "Completed Deliveries", icon: Check, url: "/dashboard/delivery/completed" },
          { id: "schedule", title: "Delivery Schedule", icon: Calendar, url: "/dashboard/delivery/schedule" },
          { id: "collections", title: "Milk Collections", icon: Milk, url: "/dashboard/delivery/collections" },
          { id: "settings", title: "Settings", icon: Settings, url: "/dashboard/delivery/settings" },
        ];
      default:
        return [];
    }
  }, [userType]);

  const handleItemClick = (itemId: string, itemUrl?: string) => {
    if (onSectionChange) {
      onSectionChange(itemId);
    } else if (itemUrl) {
      navigate(itemUrl);
    }
  };

  // Determine active section from URL if not explicitly provided
  const currentActive = activeSection || (() => {
    const path = location.pathname;
    const section = path.split("/").pop();
    return section || (userType === "admin" ? "dashboard" : "overview");
  })();

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>{`${userType.charAt(0).toUpperCase() + userType.slice(1)} Dashboard`}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => handleItemClick(item.id, item.url)}
                  className={currentActive === item.id ? "bg-gray-100" : ""}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
};
