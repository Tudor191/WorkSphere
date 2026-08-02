/**
 * Panoul de developer (platform admin) e o zonă separată de conturile
 * companiilor client — tema lui nu trebuie să depindă de preferința de
 * temă a userului logat în acest browser (setată din dashboard-ul unei
 * companii). Forțăm dark aici, izolat de `ThemeProvider`-ul global, fără
 * niciun control expus userului de a o schimba.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-screen bg-background text-foreground">{children}</div>;
}
