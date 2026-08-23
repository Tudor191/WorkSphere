import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { Benefits } from '@/components/landing/benefits';
import { Features } from '@/components/landing/features';
import { Testimonials } from '@/components/landing/testimonials';
import { Pricing } from '@/components/landing/pricing';
import { Faq } from '@/components/landing/faq';
import { Contact } from '@/components/landing/contact';
import { Footer } from '@/components/landing/footer';
import { ScrollProgress } from '@/components/landing/scroll-progress';
import { inter, display } from '@/components/landing/fonts';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  return (
    <div className={cn(inter.variable, display.variable, 'flex min-h-screen flex-col font-landing-sans')}>
      <ScrollProgress />
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
