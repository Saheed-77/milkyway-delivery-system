
import { useEffect } from "react";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { motion, useAnimation } from "framer-motion";

const Index = () => {
  const controls = useAnimation();

  useEffect(() => {
    controls.start("visible");
  }, [controls]);

  return (
    <motion.div
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-cream-50"
    >
      <Hero />
      <Features />
      <HowItWorks />
    </motion.div>
  );
};

export default Index;
