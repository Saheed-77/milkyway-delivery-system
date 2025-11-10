import { Hero } from "@/components/landing/Hero";
import { LandingNav } from "@/components/landing/LandingNav";
import { CallToAction, Features, Footer, HowItWorks, Portals } from "@/components/landing/Sections";

const Index = () => (
  <div className="min-h-svh bg-background">
    <LandingNav />
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Portals />
      <CallToAction />
    </main>
    <Footer />
  </div>
);

export default Index;
