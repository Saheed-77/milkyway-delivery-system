
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Generate a random 5-digit farmer ID
const generateFarmerId = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

export const FarmerRegistrationForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [productionCapacity, setProductionCapacity] = useState<number | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [farmerId, setFarmerId] = useState(generateFarmerId());
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Step 1: Create the user account with farmer role
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            user_type: "farmer", // This will be properly cast to the enum type by the trigger
            farmer_id: farmerId  // Store the farmer ID in the user metadata
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error("Failed to create user account");

      // Step 2: Update the farmer's profile with additional details
      const { error: updateError } = await supabase
        .from("farmers")
        .update({
          farm_name: farmName,
          farm_location: farmLocation,
          production_capacity: productionCapacity === "" ? null : Number(productionCapacity),
          farmer_id: farmerId // Also store the farmer ID in the farmers table
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Step 3: Admin can immediately approve the farmer
      const { error: approvalError } = await supabase
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", user.id);

      if (approvalError) throw approvalError;

      toast({
        title: "Success!",
        description: `Farmer ${email} has been registered with ID ${farmerId} and approved.`,
      });

      // Reset form and generate a new farmer ID for the next registration
      setEmail("");
      setPassword("");
      setFarmName("");
      setFarmLocation("");
      setProductionCapacity("");
      setFarmerId(generateFarmerId());
      
    } catch (error) {
      console.error("Error registering farmer:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to register farmer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register New Farmer</CardTitle>
        <CardDescription>Add a new farmer to the system</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="farmerId" className="block text-sm font-medium text-gray-700 mb-1">
              Farmer ID
            </label>
            <Input
              id="farmerId"
              type="text"
              value={farmerId}
              readOnly
              className="bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-generated 5-digit ID
            </p>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="farmer@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="farmName" className="block text-sm font-medium text-gray-700 mb-1">
              Farm Name
            </label>
            <Input
              id="farmName"
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="Green Valley Farm"
            />
          </div>
          <div>
            <label htmlFor="farmLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Farm Location
            </label>
            <Input
              id="farmLocation"
              type="text"
              value={farmLocation}
              onChange={(e) => setFarmLocation(e.target.value)}
              placeholder="123 Rural Road, Country"
            />
          </div>
          <div>
            <label htmlFor="productionCapacity" className="block text-sm font-medium text-gray-700 mb-1">
              Production Capacity (liters/day)
            </label>
            <Input
              id="productionCapacity"
              type="number"
              value={productionCapacity}
              onChange={(e) => setProductionCapacity(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="100"
              min="0"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#437358] hover:bg-[#345c46]"
            disabled={isLoading}
          >
            {isLoading ? "Registering..." : "Register Farmer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
