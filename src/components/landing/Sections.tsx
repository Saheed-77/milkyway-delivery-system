import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  KeyRound,
  MapPinned,
  Milk,
  Repeat,
  Route,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/common/Brand";
import { Card } from "@/components/ui/card";
import { ROLE_META, ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <motion.div {...reveal} className="mx-auto max-w-2xl space-y-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold sm:text-4xl">{title}</h2>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}

const FEATURES: [LucideIcon, string, string][] = [
  [MapPinned, "Live delivery tracking", "Follow your rider on the map with a real road route and a live ETA."],
  [KeyRound, "OTP proof of delivery", "Milk is only marked delivered when the rider enters your 4-digit code."],
  [Repeat, "Flexible subscriptions", "Daily, weekly or monthly. Pause for holidays, resume in one tap."],
  [Route, "Optimised rider routes", "Stops are ordered automatically so riders spend less time on the road."],
  [BadgeCheck, "Quality-gated supply", "Every collection is graded; substandard milk never reaches your glass."],
  [Wallet, "Instant wallet & refunds", "Pay from your wallet; cancellations are refunded the same second."],
];

export function Features() {
  return (
    <section id="features" className="container scroll-mt-20 py-20">
      <SectionHeading eyebrow="Why MilkyWay" title="Everything between the cow and your cup" description="One platform for customers, farmers, riders and operations." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([Icon, title, body], i) => (
          <motion.div key={title} {...reveal} transition={{ duration: 0.5, delay: i * 0.05 }}>
            <Card className="h-full p-6 transition-shadow hover:shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const STEPS: [LucideIcon, string, string][] = [
  [Milk, "Farmers deliver at dawn", "Collections are graded and added to the day's stock instantly."],
  [BarChart3, "Stock meets demand", "Subscriptions are reserved first; the rest is open for orders."],
  [Truck, "Riders on optimised routes", "Orders are dispatched to the nearest rider with capacity."],
  [KeyRound, "Hand-off with a code", "You share your OTP, the order completes, the farmer gets paid."],
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-secondary/50 py-20">
      <div className="container">
        <SectionHeading eyebrow="How it works" title="From farm to doorstep in four steps" description="Transparent at every stage, for everyone involved." />
        <ol className="relative mt-12 grid gap-6 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-border md:block" aria-hidden />
          {STEPS.map(([Icon, title, body], i) => (
            <motion.li key={title} {...reveal} transition={{ duration: 0.5, delay: i * 0.08 }} className="relative space-y-3 text-center md:text-left">
              <span className="relative mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lift md:mx-0">
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Portals() {
  return (
    <section id="portals" className="container scroll-mt-20 py-20">
      <SectionHeading eyebrow="Portals" title="Built for every role" description="Pick your portal to sign in — or explore the demo." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role, i) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <motion.div key={role} {...reveal} transition={{ duration: 0.5, delay: i * 0.06 }}>
              <Link to={`/auth/${role}`} className="group block h-full">
                <Card className="flex h-full flex-col p-6 transition-all group-hover:-translate-y-1 group-hover:shadow-lift">
                  <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", meta.tone)}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{meta.label}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{meta.tagline}</p>
                  <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                    Enter portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="container pb-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <div className="bg-dots absolute inset-0 opacity-20" aria-hidden />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Tomorrow's milk, sorted tonight.</h2>
          <p className="text-primary-foreground/80">Create an account in under a minute and get your first delivery from a farm near you.</p>
          <Link
            to="/auth/customer"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-card px-6 font-semibold text-foreground shadow-lift transition-transform hover:-translate-y-0.5"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>© {new Date().getFullYear()} MilkyWay · Map data © OpenStreetMap contributors</p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link to="/auth/farmer" className="hover:text-foreground">
            Farmers
          </Link>
          <Link to="/auth/delivery" className="hover:text-foreground">
            Riders
          </Link>
          <Link to="/auth/admin" className="hover:text-foreground">
            Admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}
