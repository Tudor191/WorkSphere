import { checkLeaveBalanceCap, countBusinessDays } from './leave-requests.service';

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

describe('checkLeaveBalanceCap', () => {
  it('nu plafonează deloc un tip fără sold existent și fără defaultDaysPerYear (ex. concediul medical — vezi #26)', () => {
    const result = checkLeaveBalanceCap({
      requestedDays: 100,
      usedDays: 0,
      existingTotalDays: null,
      defaultDaysPerYear: null,
    });
    expect(result).toEqual({ capped: false, exceeded: false, totalDays: null });
  });

  it('plafonează după defaultDaysPerYear când nu există încă un sold explicit', () => {
    const withinLimit = checkLeaveBalanceCap({
      requestedDays: 5,
      usedDays: 10,
      existingTotalDays: null,
      defaultDaysPerYear: 21,
    });
    expect(withinLimit).toEqual({ capped: true, exceeded: false, totalDays: 21 });

    const overLimit = checkLeaveBalanceCap({
      requestedDays: 5,
      usedDays: 20,
      existingTotalDays: null,
      defaultDaysPerYear: 21,
    });
    expect(overLimit).toEqual({ capped: true, exceeded: true, totalDays: 21 });
  });

  it('preferă soldul existent explicit față de defaultDaysPerYear', () => {
    const result = checkLeaveBalanceCap({
      requestedDays: 3,
      usedDays: 8,
      existingTotalDays: 10,
      defaultDaysPerYear: 21,
    });
    expect(result).toEqual({ capped: true, exceeded: true, totalDays: 10 });
  });

  it('cererea care umple exact soldul rămas nu e considerată depășire', () => {
    const result = checkLeaveBalanceCap({
      requestedDays: 4,
      usedDays: 17,
      existingTotalDays: null,
      defaultDaysPerYear: 21,
    });
    expect(result).toEqual({ capped: true, exceeded: false, totalDays: 21 });
  });
});
