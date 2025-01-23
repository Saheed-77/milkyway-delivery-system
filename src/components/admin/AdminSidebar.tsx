
import { Users, Milk, MessageSquare, Truck, ChartBar } from "lucide-react";
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
}

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems: MenuItem[] = [
  { id: "farmers", title: "Farmer Management", icon: Users },
  { id: "collections", title: "Milk Collections", icon: Milk },
  { id: "orders", title: "Customer Orders", icon: MessageSquare },
  { id: "delivery", title: "Delivery Management", icon: Truck },
  { id: "reports", title: "Reports & Analytics", icon: ChartBar },
];

export const AdminSidebar = ({ activeSection, onSectionChange }: AdminSidebarProps) => {
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Admin Dashboard</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => onSectionChange(item.id)}
                  className={activeSection === item.id ? "bg-gray-100" : ""}
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
