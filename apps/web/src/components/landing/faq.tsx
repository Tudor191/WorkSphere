import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

const faqs = [
  {
    question: 'Cât durează implementarea?',
    answer:
      'Contul se creează în câteva minute. Pentru companii cu peste 50 de angajați, echipa noastră te ajută cu importul de date din Excel/HR-ul actual, gratuit.',
  },
  {
    question: 'Datele firmei mele sunt izolate de alte companii?',
    answer:
      'Da. Platforma folosește o arhitectură multi-tenant cu izolare impusă la nivel de bază de date (Row Level Security), nu doar la nivel de aplicație — nicio altă firmă nu poate accesa datele tale.',
  },
  {
    question: 'Pot exporta datele dacă renunț la abonament?',
    answer:
      'Da, oricând. Exportul complet (angajați, pontaj, documente) e disponibil din Setări → Companie, în format CSV/Excel.',
  },
  {
    question: 'Ce se întâmplă după cele 14 zile de trial?',
    answer:
      'Poți alege un plan plătit sau contul trece automat în mod restricționat (doar citire) până alegi un abonament — nu pierzi datele introduse.',
  },
  {
    question: 'Oferiți factură electronică (e-Factura/SPV)?',
    answer:
      'E pe roadmap-ul nostru imediat următor, ca cerință legală pentru firmele din România. Anunțăm prin email toți clienții activi când e disponibilă.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container max-w-3xl">
        <Reveal>
          <SectionHeading eyebrow="Întrebări frecvente" title="Tot ce trebuie să știi" />
        </Reveal>
        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="mt-12 w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
