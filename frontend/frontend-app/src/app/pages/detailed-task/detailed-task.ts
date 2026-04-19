import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { getSessionStorage } from '../../utils/storage';

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
export class DetailedTask implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  task = signal<TaskDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  permissions = signal<TaskPermissions>({ canEdit: false, canDelete: false, canEditAssignee: false });

  lockStatus = signal<{ locked: boolean; userEmail?: string } | null>(null);
  private heartbeatInterval: any;
  private readonly VIEW_TIMEOUT = 30000;
  private viewTimer: any;

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
    this.route.paramMap.subscribe((params) => {
      const taskId = Number(params.get('id'));
      if (!taskId || taskId <= 0) {
        this.error.set('Ungültige Task-ID');
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.loadTask(taskId);
    });
  }

  ngOnDestroy(): void {
    this.releaseLock();
    this.clearViewTimer();
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }

  // Lädt Task-Details und ruft Berechtigungen ab
  loadTask(id: number) {
    const userId = getSessionStorage()?.getItem('userId');
    const userEmail = getSessionStorage()?.getItem('userEmail');

    let queryParams = `?user_id=${Number(userId)}`;
    if (userEmail) queryParams += `&user_email=${encodeURIComponent(userEmail)}`;

    this.http
      .get<{ task?: TaskDetail; permissions?: TaskPermissions }>(`/api/tasks/${id}${queryParams}`)
      .subscribe({
        next: (res) => {
          if (!res.task) {
            this.error.set('Task nicht gefunden');
          } else {
            this.task.set(res.task);
            this.permissions.set(res.permissions ?? { canEdit: false, canDelete: false, canEditAssignee: false });
            this.acquireLock(id);
          }
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Fehler beim Laden der Task');
          this.loading.set(false);
        },
      });
  }

  // Sperrt Task beim Öffnen, HTTP 423 wenn bereits gesperrt
  acquireLock(taskId: number) {
    const userId = getSessionStorage()?.getItem('userId');
    const userEmail = getSessionStorage()?.getItem('userEmail');

    this.http.post('/api/tasks/lock/acquire', {
      task_id: taskId,
      user_id: Number(userId),
      user_email: userEmail
    }).subscribe({
      next: () => {
        this.lockStatus.set({ locked: true, userEmail: 'dir (Ich)' });
        this.startHeartbeat(taskId);
        this.startViewTimer();
      },
      error: (err) => {
        if (err.status === 423) {
          const lockedBy = err.error.lockedByEmail;
          // Falls die eigene E-Mail zurückkommt, haben wir den Lock bereits
          if (lockedBy === userEmail) {
            this.lockStatus.set({ locked: true, userEmail: 'dir (Ich)' });
            this.startHeartbeat(taskId);
            this.startViewTimer();
          } else {
            this.lockStatus.set({ locked: true, userEmail: lockedBy });
            this.isEditMode.set(false);
            this.clearViewTimer();
          }
        }
      }
    });
  }

  // Verlängert Lock-TTL alle 30 Sekunden, verhindert Lock-Timeout
  private startHeartbeat(taskId: number) {
    const userId = getSessionStorage()?.getItem('userId');
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      this.http.post('/api/tasks/lock/heartbeat', {
        task_id: taskId,
        user_id: Number(userId)
      }).subscribe({
        error: () => {
          clearInterval(this.heartbeatInterval);
          this.lockStatus.set(null);
        }
      });
    }, 30000);
  }

  // Gibt Lock frei und entfernt Heartbeat
  private releaseLock() {
    const currentTask = this.task();
    const userId = getSessionStorage()?.getItem('userId');
    if (currentTask && userId && this.lockStatus()?.userEmail === 'dir (Ich)') {
      this.http.post('/api/tasks/lock/release', {
        task_id: currentTask.task_id,
        user_id: Number(userId)
      }).subscribe();
    }
  }

  // Startet Timer, der nach 30 Sekunden Inaktivität die Task freigibt
  private startViewTimer() {
    this.clearViewTimer();
    this.viewTimer = setTimeout(() => {
      if (!this.isEditMode()) {
        alert('Die 30-sekündige Lesezeit ist abgelaufen. Die Task wird für andere freigegeben.');
        this.goBack();
      }
    }, this.VIEW_TIMEOUT);
  }
  // Löscht den View-Timer, z.B. beim Wechsel in den Editiermodus
  private clearViewTimer() {
    if (this.viewTimer) {
      clearTimeout(this.viewTimer);
      this.viewTimer = null;
    }
  }

  // Wechselt in den Editiermodus, lädt mögliche Assignees
  onEdit() {
    const currentTask = this.task();
    if (!currentTask || !this.permissions().canEdit) return;

    if (this.lockStatus()?.locked && this.lockStatus()?.userEmail !== 'dir (Ich)') {
      alert(`Diese Task wird gerade von ${this.lockStatus()?.userEmail} bearbeitet.`);
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
    this.clearViewTimer();

    if (this.permissions().canEditAssignee) {
      this.loadAssignees(currentTask.task_id);
    }
  }

  // Ruft mögliche Assignees für diese Task ab
  loadAssignees(taskId: number) {
    const userId = Number(getSessionStorage()?.getItem('userId'));
    this.http
      .get<{ assignees?: Assignee[] }>(`/api/tasks/${taskId}/assignees?user_id=${userId}`)
      .subscribe({
        next: (res) => this.assignees.set(res.assignees ?? []),
        error: () => this.assignees.set([])
      });
  }

  updateEditForm<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    this.editForm.update((current) => ({ ...current, [key]: value }));
  }

  // Speichert Task-Änderungen (mit Lock-Release)
  saveEdit() {
    const currentTask = this.task();
    const userId = Number(getSessionStorage()?.getItem('userId'));
    const form = this.editForm();

    if (!currentTask || !userId || !this.permissions().canEdit) return;
    if (!form.title.trim()) return alert('Bitte einen Titel eingeben.');

    this.saving.set(true);
    const payload = {
      task_id: currentTask.task_id,
      user_id: userId,
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      deadline: form.deadline || null,
      assigned_to: this.permissions().canEditAssignee ? (form.assigned_to ? Number(form.assigned_to) : null) : undefined
    };

    this.http.post<{ message: string }>('/api/tasks/edit', payload).subscribe({
      next: (res) => {
        alert(res.message || 'Erfolgreich');
        this.isEditMode.set(false);
        this.loadTask(currentTask.task_id);
        this.saving.set(false);
      },
      error: (err) => {
        alert(err.error?.message || 'Fehler');
        this.saving.set(false);
      }
    });
  }

  cancelEdit() {
    this.isEditMode.set(false);
    this.startViewTimer();
  }

  // Löscht Task nach Bestätigung
  onDelete() {
    const userId = Number(getSessionStorage()?.getItem('userId'));
    const currentTask = this.task();
    if (!currentTask || !userId || !this.permissions().canDelete) return;

    if (window.confirm('Task wirklich löschen?')) {
      this.http.post('/api/tasks/delete', { task_id: currentTask.task_id, user_id: userId })
        .subscribe({
          next: () => this.goBack(),
          error: (err) => alert(err.error?.message || 'Fehler')
        });
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
}
