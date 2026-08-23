'use client';

import {
  BarChart3,
  Bot,
  Calendar,
  CheckSquare,
  MessagesSquare,
  Package,
  Users,
  Wallet,
} from 'lucide-react';
import { SectionHeading } from './section-heading';
import { Reveal } from './reveal';

const features = [
  { icon: Users, title: 'HR & Angajați', description: 'Departamente, roluri, contracte, documente și istoricul complet al fiecărui angajat.' },
  { icon: Calendar, title: 'Pontaj & Concedii', description: 'Check-in/check-out cu geolocație opțională, calcul automat al orelor suplimentare și al zilelor de concediu.' },
  { icon: Wallet, title: 'CRM & Vânzări', description: 'Clienți, lead-uri, pipeline de vânzări și follow-up-uri, toate într-un singur flux.' },
  { icon: CheckSquare, title: 'Proiecte & Task-uri', description: 'Deadline-uri, comentarii, atașamente și time tracking pentru fiecare echipă.' },
  { icon: Package, title: 'Inventar', description: 'Stoc, coduri de bare, coduri QR și mișcări de intrare/ieșire în timp real.' },
  { icon: MessagesSquare, title: 'Chat intern', description: 'Canale, mesaje, reacții și fișiere — livrare instant prin WebSocket, fără refresh.' },
  { icon: Bot, title: 'AI Assistant', description: 'Răspunde la întrebări, generează documente și rapoarte, bazat pe datele reale ale firmei (RAG).' },
  { icon: BarChart3, title: 'Analytics', description: 'Dashboard cu venituri, retenție, performanță și utilizare — decizii pe bază de date, nu impresii.' },
];

export function Features() {
  return (
    <section id="functionalitati" className="py-24 sm:py-32">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Funcționalități"
            title="Un modul pentru fiecare parte a activității"
            description="Nu mai ai nevoie de 6 unelte diferite care nu comunică între ele."
          />
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <Reveal
              key={feature.title}
              delay={i * 0.05}
              duration={0.4}
              className="group relative overflow-hidden bg-card p-6 transition-colors duration-200 hover:bg-accent/50"
            >
              <feature.icon className="h-5 w-5 text-primary transition-transform duration-200 group-hover:scale-110" />
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
