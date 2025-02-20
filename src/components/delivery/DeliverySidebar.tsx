
import { Home, Package, Truck, MapPin, Calendar, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export function DeliverySidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center px-4 py-2">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-[#437358]" />
          <span className="text-lg font-semibold">Delivery Portal</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={isActive("/dashboard/delivery")}
                  onClick={() => navigate("/dashboard/delivery")}
                >
                  <Home size={18} />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Deliveries</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={isActive("/dashboard/delivery/pending")}
                  onClick={() => navigate("/dashboard/delivery/pending")}
                >
                  <Package size={18} />
                  <span>Pending Deliveries</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={isActive("/dashboard/delivery/completed")}
                  onClick={() => navigate("/dashboard/delivery/completed")}
                >
                  <CheckCircle size={18} />
                  <span>Completed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={isActive("/dashboard/delivery/schedule")}
                  onClick={() => navigate("/dashboard/delivery/schedule")}
                >
                  <Calendar size={18} />
                  <span>Schedule</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/dashboard/delivery/settings")}
              isActive={isActive("/dashboard/delivery/settings")}
            >
              <Settings size={18} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
