import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type TaskDetail = {
  task_id: number;
  title: string;
  description?: string | null;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  priority: 'Low' | 'Medium' | 'High';
  assigned_to?: string | null;
  deadline?: string | null;
};

type TaskPermissions = {
  canEdit: boolean;
  canDelete: boolean;
};

@Component({
  selector: 'app-detailed-task',
  standalone: true,
  imports: [CommonModule],
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
  permissions = signal<TaskPermissions>({ canEdit: false, canDelete: false });

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
    const userId = localStorage.getItem('userId');
    const userIdParam = userId ? `?user_id=${Number(userId)}` : '';

    this.http
      .get<{ task?: TaskDetail; permissions?: TaskPermissions }>(`http://localhost:3000/api/tasks/${id}${userIdParam}`)
      .subscribe({
        next: (res) => {
          if (!res.task) {
            this.error.set('Task nicht gefunden');
            this.task.set(null);
            this.permissions.set({ canEdit: false, canDelete: false });
          } else {
            this.task.set(res.task);
            this.permissions.set(res.permissions ?? { canEdit: false, canDelete: false });
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Fehler beim Laden der Task');
          this.task.set(null);
          this.permissions.set({ canEdit: false, canDelete: false });
          this.loading.set(false);
        },
      });
  }

  onEdit() {
    const currentTask = this.task();
    if (!currentTask || !this.permissions().canEdit) {
      return;
    }

    alert('Bearbeiten wird im naechsten Schritt angebunden.');
  }

  onDelete() {
    const userId = Number(localStorage.getItem('userId'));
    const currentTask = this.task();

    if (!currentTask || !Number.isInteger(userId) || userId <= 0 || !this.permissions().canDelete) {
      return;
    }

    const confirmed = window.confirm('Task wirklich löschen?');
    if (!confirmed) {
      return;
    }

    this.http
      .post<{ message: string }>('http://localhost:3000/api/tasks/delete', {
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
