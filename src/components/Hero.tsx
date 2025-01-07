
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-cream-50 to-cream-100">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-block px-4 py-2 mb-6 text-sm font-medium text-sage-700 bg-sage-100 rounded-full"
          >
            Fresh Dairy Delivered Daily
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gray-900"
          >
            Farm Fresh Milk
            <br />
            <span className="text-sage-600">Delivered to You</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-lg mb-8 text-lg text-gray-600"
          >
            Experience the convenience of having fresh, local dairy products
            delivered right to your doorstep. Quality you can taste, service you
            can trust.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button
              size="lg"
              className="bg-sage-600 hover:bg-sage-700 text-white px-8"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-sage-600 text-sage-600 hover:bg-sage-50"
            >
              Learn More
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
