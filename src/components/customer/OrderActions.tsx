
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const OrderActions = ({ order, onStatusUpdate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // This component no longer has user actions as the "Mark as Delivered" functionality is removed
  // It will only show buttons for certain order statuses if needed in the future
  
  return null;
};
