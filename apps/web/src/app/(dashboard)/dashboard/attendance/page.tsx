'use client';

import { Clock, LogIn, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCheckIn, useCheckOut, useMyAttendance } from '@/hooks/use-attendance';
import { ApiError } from '@/lib/api-client';

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'destructive',
  ON_LEAVE: 'secondary',
};

export default function AttendancePage() {
  const { data: records, isLoading } = useMyAttendance();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const openRecord = records?.find((r) => !r.checkOutAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pontaj</h1>
        <p className="text-sm text-muted-foreground">Check-in / check-out și istoricul tău de prezență.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">{openRecord ? 'Ești pontat — sesiune activă' : 'Nu ești pontat momentan'}</p>
              {openRecord && (
                <p className="text-sm text-muted-foreground">
                  Check-in la {new Date(openRecord.checkInAt).toLocaleTimeString('ro-RO')}
                </p>
              )}
            </div>
          </div>

          {openRecord ? (
            <Button size="lg" variant="outline" onClick={() => checkOut.mutate()} disabled={checkOut.isPending}>
              <LogOut className="h-4 w-4" />
              {checkOut.isPending ? 'Se procesează...' : 'Check-out'}
            </Button>
          ) : (
            <Button size="lg" onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
              <LogIn className="h-4 w-4" />
              {checkIn.isPending ? 'Se procesează...' : 'Check-in'}
            </Button>
          )}
        </CardContent>
        {(checkIn.error || checkOut.error) && (
          <CardContent className="pt-0 text-sm text-destructive">
            {checkIn.error instanceof ApiError ? checkIn.error.message : checkOut.error instanceof ApiError ? checkOut.error.message : 'Eroare.'}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Istoric</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
          {!isLoading && records?.length === 0 && (
            <p className="text-sm text-muted-foreground">Niciun pontaj încă.</p>
          )}
          {records && records.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Check-in</th>
                    <th className="py-2 pr-4 font-medium">Check-out</th>
                    <th className="py-2 pr-4 font-medium">Ore lucrate</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-4">{new Date(r.checkInAt).toLocaleDateString('ro-RO')}</td>
                      <td className="py-2 pr-4">{new Date(r.checkInAt).toLocaleTimeString('ro-RO')}</td>
                      <td className="py-2 pr-4">
                        {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('ro-RO') : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        {r.workedMinutes != null ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
