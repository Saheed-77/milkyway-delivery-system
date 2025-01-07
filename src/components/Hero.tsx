
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Clock, CreditCard, Check } from "lucide-react";

export const Hero = () => {
  return (
    <div className="relative min-h-screen">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-cream-50 z-50 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-sage-700 text-xl font-semibold">FreshMilk</div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-gray-600 hover:text-sage-700">Products</a>
            <a href="#" className="text-gray-600 hover:text-sage-700">Queue Status</a>
            <a href="#" className="text-gray-600 hover:text-sage-700">Wallet</a>
            <button className="p-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </button>
            <button className="p-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="pt-24 min-h-[90vh] flex items-center justify-center bg-cream-50">
        <div className="container px-4 mx-auto">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-6xl font-bold mb-4"
            >
              Fresh Milk Delivered
              <br />
              <span className="text-[#437358]">Right to Your Doorstep</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-600 mb-12"
            >
              Get farm-fresh milk delivered daily. Sign in or create an account to get started.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <Button
                size="lg"
                className="bg-[#437358] hover:bg-[#345c46] text-white min-w-[160px]"
              >
                Admin Login
              </Button>
              <Button
                size="lg"
                className="bg-[#437358] hover:bg-[#345c46] text-white min-w-[160px]"
              >
                Farmer Login
              </Button>
              <Button
                size="lg"
                className="bg-[#437358] hover:bg-[#345c46] text-white min-w-[160px]"
              >
                Customer Login
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer Icons */}
      <div className="absolute bottom-8 left-0 right-0">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-center gap-8 md:gap-16">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-[#437358] rounded-lg text-white mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-gray-600 max-w-xs">
                Track your delivery in real-time and never miss your milk delivery.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-[#437358] rounded-lg text-white mb-3">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure Payments</h3>
              <p className="text-gray-600 max-w-xs">
                Pay securely through our integrated wallet system.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-[#437358] rounded-lg text-white mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Quality Guaranteed</h3>
              <p className="text-gray-600 max-w-xs">
                Fresh milk sourced directly from local farmers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
