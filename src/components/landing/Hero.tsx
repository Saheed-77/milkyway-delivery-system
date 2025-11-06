import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, MapPinned, ShieldCheck, Sparkles, Tractor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { RouteIllustration } from "./RouteIllustration";

export function Hero() {
  const { isDemo } = useAuth();
  return (
    <section className="relative overflow-hidden">
      <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-info/10 blur-3xl" aria-hidden />
      <div className="container relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div className="space-y-7">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-medium shadow-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              {isDemo ? "Live demo — explore every role, no sign-up" : "Farm-fresh milk, tracked to your door"}
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl"
          >
            Fresh from the farm.
            <br />
            <span className="text-gradient">At your door by sunrise.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-xl text-lg text-muted-foreground"
          >
            MilkyWay connects local dairy farmers, riders and families. Order or subscribe in seconds, watch your rider on a live
            map, and hand over with a one-time code.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-wrap gap-3"
          >
            <Button size="lg" asChild>
              <Link to="/auth/customer">
                Order fresh milk <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth/farmer">
                <Tractor /> Sell your milk
              </Link>
            </Button>
          </motion.div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-primary" /> Live rider tracking
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> OTP-verified hand-off
            </li>
          </ul>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <RouteIllustration />
        </motion.div>
      </div>
    </section>
  );
}
