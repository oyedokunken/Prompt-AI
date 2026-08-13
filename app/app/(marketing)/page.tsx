import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Capabilities } from "@/components/sections/Capabilities";
import { ChatPreview } from "@/components/sections/ChatPreview";
import { WhoItsFor } from "@/components/sections/WhoItsFor";
import { ModelMarquee } from "@/components/sections/ModelMarquee";
import { Testimonials } from "@/components/sections/Testimonials";
import { FAQ } from "@/components/sections/FAQ";
import { Integrations } from "@/components/sections/Integrations";
import { ClosingCTA } from "@/components/sections/ClosingCTA";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function MarketingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Capabilities />
        <ChatPreview />
        <WhoItsFor />
        <ModelMarquee />
        <Testimonials />
        <FAQ />
        <Integrations />
        <ClosingCTA />
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
