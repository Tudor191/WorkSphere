import { countBusinessDays } from './leave-requests.service';

describe('countBusinessDays', () => {
  it('numără corect o săptămână de lucru completă (luni-vineri)', () => {
    // 3 aug 2026 e luni, 7 aug 2026 e vineri
    expect(countBusinessDays(new Date(2026, 7, 3), new Date(2026, 7, 7))).toBe(5);
  });

  it('exclude sâmbăta și duminica dintr-un interval care le include', () => {
    // luni 3 aug - duminică 9 aug => 5 zile lucrătoare
    expect(countBusinessDays(new Date(2026, 7, 3), new Date(2026, 7, 9))).toBe(5);
  });

  it('o singură zi lucrătoare returnează 1', () => {
    expect(countBusinessDays(new Date(2026, 7, 3), new Date(2026, 7, 3))).toBe(1);
  });

  it('o singură zi de weekend returnează 0', () => {
    // 8 aug 2026 e sâmbătă
    expect(countBusinessDays(new Date(2026, 7, 8), new Date(2026, 7, 8))).toBe(0);
  });
});
