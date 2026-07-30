'use client';

import { CalendarClock, Clock, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { useEmployees } from '@/hooks/use-employees';
import { useLeaveRequests } from '@/hooks/use-leave-requests';
import { useAllAttendance } from '@/hooks/use-attendance';
import { useDepartments } from '@/hooks/use-departments';

export default function DashboardOverviewPage() {
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { data: leaveRequests } = useLeaveRequests();
  const { data: attendance } = useAllAttendance();
  const { data: departments } = useDepartments();

  const pendingLeaveCount = leaveRequests?.filter((r) => r.status === 'PENDING').length ?? 0;
  const today = new Date().toDateString();
  const presentToday = attendance?.filter((a) => new Date(a.checkInAt).toDateString() === today).length ?? 0;

  const departmentChartData =
    departments?.map((d) => ({ name: d.name, angajați: d._count?.employees ?? 0 })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Situația de ansamblu a companiei tale.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Angajați activi"
          value={employeesLoading ? '...' : employees?.length ?? 0}
          icon={Users}
        />
        <StatCard label="Concedii în așteptare" value={pendingLeaveCount} icon={CalendarClock} tone="warning" />
        <StatCard label="Prezențe azi" value={presentToday} icon={Clock} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Angajați per departament</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {departmentChartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nu există încă departamente cu angajați.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
                <Bar dataKey="angajați" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
