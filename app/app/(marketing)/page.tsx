import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Capabilities } from "@/components/sections/Capabilities";
import { ChatPreview } from "@/components/sections/ChatPreview";
import { DeviceFrame } from "@/components/sections/DeviceFrame";
import { ModelMarquee } from "@/components/sections/ModelMarquee";
import { Testimonials } from "@/components/sections/Testimonials";
import { ClosingCTA } from "@/components/sections/ClosingCTA";
import { Integrations } from "@/components/sections/Integrations";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";

export default function MarketingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Capabilities />
        <ChatPreview />
        <DeviceFrame />
        <ModelMarquee />
        <Testimonials />
        <ClosingCTA />
        <Integrations />
      </main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
