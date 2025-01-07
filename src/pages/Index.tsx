
import { motion, useAnimation } from "framer-motion";
import { Hero } from "@/components/Hero";

const Index = () => {
  const controls = useAnimation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-cream-50"
    >
      <Hero />
    </motion.div>
  );
};

export default Index;
