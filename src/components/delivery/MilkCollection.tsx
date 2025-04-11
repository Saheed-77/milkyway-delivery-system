
import { useState } from "react";
import { MilkCollectionsList } from "@/components/shared/MilkCollectionsList";
import { DeliveryMilkCollectionForm } from "@/components/delivery/DeliveryMilkCollectionForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, PlusCircle } from "lucide-react";

export const MilkCollection = () => {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <div className="space-y-6">
      <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Milk Collections
          </TabsTrigger>
          <TabsTrigger value="collect" className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4" />
            Collect Milk
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <MilkCollectionsList />
        </TabsContent>
        
        <TabsContent value="collect">
          <DeliveryMilkCollectionForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};
