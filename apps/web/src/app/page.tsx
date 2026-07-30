import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Benefits } from '@/components/landing/benefits';
import { Features } from '@/components/landing/features';
import { Testimonials } from '@/components/landing/testimonials';
import { Pricing } from '@/components/landing/pricing';
import { Faq } from '@/components/landing/faq';
import { Contact } from '@/components/landing/contact';
import { Footer } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <Features />
        <Testimonials />
        <Pricing />
        <Faq />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
