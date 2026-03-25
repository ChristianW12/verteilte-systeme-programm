import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

type TaskDetail = {
  task_id: number;
  title: string;
  description?: string | null;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  priority: 'Low' | 'Medium' | 'High';
  assigned_to?: string | null;
  assigned_to_id?: number | null;
  deadline?: string | null;
};

type TaskPermissions = {
  canEdit: boolean;
  canDelete: boolean;
  canEditAssignee: boolean;
};

type Assignee = {
  user_id: number;
  email: string;
};

type EditForm = {
  title: string;
  description: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  priority: 'Low' | 'Medium' | 'High';
  deadline: string;
  assigned_to: string;
};

@Component({
  selector: 'app-detailed-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detailed-task.html',
  styleUrl: './detailed-task.css',
})
export class DetailedTask implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  task = signal<TaskDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  permissions = signal<TaskPermissions>({ canEdit: false, canDelete: false, canEditAssignee: false });

  isEditMode = signal(false);
  saving = signal(false);
  assignees = signal<Assignee[]>([]);
  editForm = signal<EditForm>({
    title: '',
    description: '',
    status: 'To Do',
    priority: 'Medium',
    deadline: '',
    assigned_to: '',
  });

  ngOnInit(): void {
    console.log('Hier wird ngOnInit aufgerufen');

    this.route.paramMap.subscribe((params) => {
      const routeTaskId = Number(params.get('id'));
      const stateTaskId = Number((window.history.state as any)?.taskId);
      const taskId = Number.isInteger(routeTaskId) && routeTaskId > 0 ? routeTaskId : stateTaskId;

      if (!taskId || !Number.isInteger(taskId) || taskId <= 0) {
        this.error.set('Ungültige Task-ID');
        this.task.set(null);
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.error.set(null);
      this.loadTask(taskId);
    });
  }

  loadTask(id: number) {
    const userId = sessionStorage.getItem('userId');
    const userIdParam = userId ? `?user_id=${Number(userId)}` : '';

    this.http
      .get<{ task?: TaskDetail; permissions?: TaskPermissions }>(`/api/tasks/${id}${userIdParam}`)
      .subscribe({
        next: (res) => {
          if (!res.task) {
            this.error.set('Task nicht gefunden');
            this.task.set(null);
            this.permissions.set({ canEdit: false, canDelete: false, canEditAssignee: false });
          } else {
            this.task.set(res.task);
            this.permissions.set(res.permissions ?? { canEdit: false, canDelete: false, canEditAssignee: false });
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Fehler beim Laden der Task');
          this.task.set(null);
          this.permissions.set({ canEdit: false, canDelete: false, canEditAssignee: false });
          this.loading.set(false);
        },
      });
  }

  onEdit() {
    const currentTask = this.task();
    if (!currentTask || !this.permissions().canEdit) {
      return;
    }

    this.editForm.set({
      title: currentTask.title,
      description: currentTask.description || '',
      status: currentTask.status,
      priority: currentTask.priority,
      deadline: currentTask.deadline ? String(currentTask.deadline).slice(0, 10) : '',
      assigned_to: currentTask.assigned_to_id ? String(currentTask.assigned_to_id) : '',
    });

    this.isEditMode.set(true);

    if (this.permissions().canEditAssignee) {
      this.loadAssignees(currentTask.task_id);
    } else {
      this.assignees.set([]);
    }
  }

  loadAssignees(taskId: number) {
    const userId = Number(sessionStorage.getItem('userId'));

    if (!Number.isInteger(userId) || userId <= 0) {
      this.assignees.set([]);
      return;
    }

    this.http
      .get<{ assignees?: Assignee[] }>(`/api/tasks/${taskId}/assignees?user_id=${userId}`)
      .subscribe({
        next: (res) => {
          this.assignees.set(res.assignees ?? []);
        },
        error: () => {
          this.assignees.set([]);
        },
      });
  }

  updateEditForm<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    this.editForm.update((current) => ({
      ...current,
      [key]: value,
    }));
  }

  saveEdit() {
    const currentTask = this.task();
    const userId = Number(sessionStorage.getItem('userId'));
    const form = this.editForm();

    if (!currentTask || !Number.isInteger(userId) || userId <= 0 || !this.permissions().canEdit) {
      return;
    }

    if (!form.title.trim()) {
      alert('Bitte einen Titel eingeben.');
      return;
    }

    this.saving.set(true);

    const payload: {
      task_id: number;
      user_id: number;
      title: string;
      description: string;
      status: EditForm['status'];
      priority: EditForm['priority'];
      deadline: string | null;
      assigned_to?: number | null;
    } = {
      task_id: currentTask.task_id,
      user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
    };

    if (this.permissions().canEditAssignee) {
      payload.assigned_to = form.assigned_to ? Number(form.assigned_to) : null;
    }

    this.http.post<{ message: string }>('/api/tasks/edit', payload).subscribe({
      next: (res) => {
        alert(res.message || 'Task erfolgreich bearbeitet');
        this.isEditMode.set(false);
        this.loadTask(currentTask.task_id);
        this.saving.set(false);
      },
      error: (err) => {
        alert(err.error?.message || 'Task konnte nicht bearbeitet werden');
        this.saving.set(false);
      },
    });
  }

  cancelEdit() {
    this.isEditMode.set(false);
  }

  onDelete() {
    const userId = Number(sessionStorage.getItem('userId'));
    const currentTask = this.task();

    if (!currentTask || !Number.isInteger(userId) || userId <= 0 || !this.permissions().canDelete) {
      return;
    }

    const confirmed = window.confirm('Task wirklich löschen?');
    if (!confirmed) {
      return;
    }

    this.http
      .post<{ message: string }>('/api/tasks/delete', {
        task_id: currentTask.task_id,
        user_id: userId,
      })
      .subscribe({
        next: (res) => {
          alert(res.message || 'Task erfolgreich gelöscht');
          this.goBack();
        },
        error: (err) => {
          alert(err.error?.message || 'Task konnte nicht gelöscht werden');
        },
      });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}


