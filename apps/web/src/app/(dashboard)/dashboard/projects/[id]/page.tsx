'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/use-projects';
import { useCreateTask, useDeleteTask, useUpdateTask } from '@/hooks/use-tasks';
import { useEmployees } from '@/hooks/use-employees';
import { ApiError } from '@/lib/api-client';
import type { ProjectStatus, Task, TaskPriority, TaskStatus } from '@worksphere/shared-types';

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: 'Planificare',
  ACTIVE: 'Activ',
  ON_HOLD: 'În așteptare',
  COMPLETED: 'Finalizat',
  CANCELED: 'Anulat',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'De făcut',
  IN_PROGRESS: 'În lucru',
  IN_REVIEW: 'În verificare',
  DONE: 'Finalizat',
};

const TASK_STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Scăzută',
  MEDIUM: 'Medie',
  HIGH: 'Ridicată',
  URGENT: 'Urgentă',
};

const PRIORITY_VARIANT: Record<TaskPriority, 'secondary' | 'warning' | 'destructive'> = {
  LOW: 'secondary',
  MEDIUM: 'secondary',
  HIGH: 'warning',
  URGENT: 'destructive',
};

const emptyTaskForm = {
  title: '',
  description: '',
  assigneeId: '',
  status: 'TODO' as TaskStatus,
  priority: 'MEDIUM' as TaskPriority,
  dueDate: '',
};

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: project, isLoading } = useProject(params.id);
  const { data: employees } = useEmployees();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [taskForm, setTaskForm] = React.useState(emptyTaskForm);
  const [taskError, setTaskError] = React.useState<string | null>(null);

  const [editProjectOpen, setEditProjectOpen] = React.useState(false);
  const [projectForm, setProjectForm] = React.useState({ status: 'PLANNING' as ProjectStatus, deadline: '' });
  const [projectError, setProjectError] = React.useState<string | null>(null);

  const [toDeleteTask, setToDeleteTask] = React.useState<Task | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = React.useState(false);
  const [deleteProjectError, setDeleteProjectError] = React.useState<string | null>(null);

  const openCreateTask = (status: TaskStatus) => {
    setEditingTask(null);
    setTaskError(null);
    setTaskForm({ ...emptyTaskForm, status });
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskError(null);
    setTaskForm({
      title: task.title,
      description: task.description ?? '',
      assigneeId: task.assigneeId ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setTaskDialogOpen(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    const input = {
      title: taskForm.title,
      description: taskForm.description || undefined,
      assigneeId: taskForm.assigneeId || undefined,
      status: taskForm.status,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || undefined,
    };
    try {
      if (editingTask) {
        await updateTask.mutateAsync({ id: editingTask.id, ...input });
      } else {
        await createTask.mutateAsync({ ...input, projectId: params.id });
      }
      setTaskDialogOpen(false);
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : 'Eroare la salvarea task-ului.');
    }
  };

  const confirmDeleteTask = async () => {
    if (!toDeleteTask) return;
    try {
      await deleteTask.mutateAsync(toDeleteTask.id);
      setToDeleteTask(null);
    } catch {
      setToDeleteTask(null);
    }
  };

  const openEditProject = () => {
    if (!project) return;
    setProjectError(null);
    setProjectForm({ status: project.status, deadline: project.deadline ? project.deadline.slice(0, 10) : '' });
    setEditProjectOpen(true);
  };

  const submitEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setProjectError(null);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        name: project.name,
        status: projectForm.status,
        deadline: projectForm.deadline || undefined,
      });
      setEditProjectOpen(false);
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : 'Eroare la actualizarea proiectului.');
    }
  };

  const confirmDeleteProject = async () => {
    if (!project) return;
    setDeleteProjectError(null);
    try {
      await deleteProject.mutateAsync(project.id);
      router.push('/dashboard/projects');
    } catch (err) {
      setDeleteProjectError(
        err instanceof ApiError ? err.message : 'Eroare la ștergerea proiectului.',
      );
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Se încarcă...</p>;
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Proiect inexistent.</p>;
  }

  const tasksByStatus = TASK_STATUS_ORDER.map((status) => ({
    status,
    tasks: (project.tasks ?? []).filter((t) => t.status === status),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Înapoi la proiecte
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="secondary">{PROJECT_STATUS_LABEL[project.status]}</Badge>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
          {project.deadline && (
            <p className="mt-1 text-xs text-muted-foreground">
              Termen limită: {new Date(project.deadline).toLocaleDateString('ro-RO')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={openEditProject}>
            <Pencil className="h-4 w-4" />
            Editează
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteProjectOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Șterge
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tasksByStatus.map(({ status, tasks }) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {TASK_STATUS_LABEL[status]} ({tasks.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={() => openCreateTask(status)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card key={task.id} className="cursor-pointer" onClick={() => openEditTask(task)}>
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{task.title}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDeleteTask(task);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={PRIORITY_VARIANT[task.priority]} className="text-xs">
                        {PRIORITY_LABEL[task.priority]}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.dueDate).toLocaleDateString('ro-RO')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : 'Neasignat'}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground">Niciun task.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Creare / editare task */}
      <Dialog open={taskDialogOpen} onOpenChange={(v) => { setTaskDialogOpen(v); if (!v) setTaskError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editează task' : 'Task nou'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Titlu</Label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descriere</Label>
              <Input
                value={taskForm.description}
                onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, status: v as TaskStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioritate</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alocat</Label>
                <Select
                  value={taskForm.assigneeId}
                  onValueChange={(v) => setTaskForm((f) => ({ ...f, assigneeId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Neasignat" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.user.id} value={emp.user.id}>
                        {emp.user.firstName} {emp.user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Termen</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            {taskError && <p className="text-sm text-destructive">{taskError}</p>}

            <DialogFooter>
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                {createTask.isPending || updateTask.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere task */}
      <Dialog open={!!toDeleteTask} onOpenChange={(v) => !v && setToDeleteTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi task-ul{' '}
            <span className="font-medium text-foreground">{toDeleteTask?.title}</span>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDeleteTask(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteTask.isPending} onClick={confirmDeleteTask}>
              {deleteTask.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editare proiect */}
      <Dialog open={editProjectOpen} onOpenChange={(v) => { setEditProjectOpen(v); if (!v) setProjectError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează proiect</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEditProject} className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={projectForm.status}
                onValueChange={(v) => setProjectForm((f) => ({ ...f, status: v as ProjectStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Termen limită</Label>
              <Input
                type="date"
                value={projectForm.deadline}
                onChange={(e) => setProjectForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {projectError && <p className="text-sm text-destructive">{projectError}</p>}

            <DialogFooter>
              <Button type="submit" disabled={updateProject.isPending}>
                {updateProject.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere proiect */}
      <Dialog open={deleteProjectOpen} onOpenChange={(v) => { setDeleteProjectOpen(v); if (!v) setDeleteProjectError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge proiect</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi proiectul{' '}
            <span className="font-medium text-foreground">{project.name}</span>? Funcționează doar
            dacă nu mai are task-uri asociate.
          </p>
          {deleteProjectError && <p className="text-sm text-destructive">{deleteProjectError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteProjectOpen(false)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteProject.isPending} onClick={confirmDeleteProject}>
              {deleteProject.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
