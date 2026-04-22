import { Component, computed, inject, OnInit, signal, effect } from '@angular/core';
import { ProjectCard, ProjectCardData } from '../../shared/components/project-card/project-card';
import { TaskCard, TaskCardData } from '../../shared/components/task-card/task-card';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, CdkDragStart } from '@angular/cdk/drag-drop';
import { getSessionStorage } from '../../utils/storage';
import { RealtimeService } from '../../shared/services/realtime';

type ProjectRole = 'Developer' | 'Admin' | 'Viewer';

type ProjectMemberApiItem = {
  user_id: string;
  username: string;
  email: string;
  role?: ProjectRole;
};

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: string;
  role?: ProjectRole;
  members?: ProjectMemberApiItem[];
};

type GetProjectsResponse = {
  userId: string;
  projects: ProjectApiItem[];
};

type TaskApiItem = {
  task_id: number;
  project_id: number;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  assigned_to_email?: string | null;
  assigned_to?: string | null;
  assigned_to_id?: string | null;
  deadline?: string | null;
};

type GetTasksResponse = {
  tasks: TaskApiItem[];
};

@Component({
  selector: 'app-dashboard',
  imports: [ProjectCard, TaskCard, RouterLink, DragDropModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);
  private realtime = inject(RealtimeService);

  private currentUserId = signal<string>('');
  private currentUserEmail = signal<string>('');

  projects = signal<ProjectCardData[]>([]);
  selectedProjectId = signal<number | null>(null);
  selectedProjectName = signal<string>('Kein Projekt ausgewaehlt');
  tasks = signal<TaskCardData[]>([]);

  taskLocks = signal<Map<number, string>>(new Map());

  selectedProject = computed(() => this.projects().find((project) => project.project_id === this.selectedProjectId()) ?? null);

  showOnlyMyTasks = signal(false);

  todoTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'To Do'));
  inProgressTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'In Progress'));
  doneTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'Done'));
  blockedTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'Blocked'));

  private userIdResponse = signal<string | null>(null);

  // Verwaltet Lock-Events und Realtime-Refresh
  constructor() {
    effect(() => {
      const event = this.realtime.lastEvent();
      if (!event) return;

      if (event.type === 'task.locked') {
        this.taskLocks.update(locks => {
          const newLocks = new Map(locks);
          newLocks.set(event.payload.taskId, event.payload.userEmail);
          return newLocks;
        });
      } else if (event.type === 'task.unlocked') {
        this.taskLocks.update(locks => {
          const newLocks = new Map(locks);
          newLocks.delete(event.payload.taskId);
          return newLocks;
        });
      }

      if (this.realtime.refreshRequired()) {
        const projectId = this.selectedProjectId();
        if (projectId) this.loadTasksForProject(projectId);
        this.realtime.refreshRequired.set(false);
      }
    }, { allowSignalWrites: true });
  }

  private normalizeProjectRole(role: unknown): ProjectRole {
    return role === 'Admin' || role === 'Developer' || role === 'Viewer' ? role : 'Viewer';
  }

  // Filtert Tasks nach "meine Tasks" oder alle
  private getFilteredTasks(): TaskCardData[] {
    const allTasks = this.tasks();
    if (!this.showOnlyMyTasks() || !this.canShowMyTasksForSelectedProject()) return allTasks;
    return allTasks.filter((task) => task.assigned_to_id === this.currentUserId());
  }

  ngOnInit(): void {
    if (!getSessionStorage()) {
      return;
    }

    this.http.get<{ user?: { id?: string; email?: string } }>('/api/auth/session/me').subscribe({
      next: (session) => {
        const userId = String(session.user?.id || '').trim();
        const userEmail = String(session.user?.email || '').trim();
        if (!userId || !userEmail) {
          this.router.navigate(['/login']);
          return;
        }
        this.currentUserId.set(userId);
        this.currentUserEmail.set(userEmail);
        this.loadActiveLocks();
        this.loadProjects();
      },
      error: () => this.router.navigate(['/login']),
    });
  }

  private loadProjects(): void {
    this.http.get<GetProjectsResponse>('/api/project/get/me').subscribe({
      next: (response) => {
        this.projects.set(
          response.projects.map((project) => ({
            project_id: project.project_id,
            name: project.name,
            description: project.description,
            created_by: project.created_by,
            admin_id: project.admin_id,
            role: this.normalizeProjectRole(project.role),
            members: (project.members ?? []).map((member) => ({
              user_id: member.user_id,
              username: member.username,
              email: member.email,
              role: this.normalizeProjectRole(member.role),
            })),
          })),
        );
        this.userIdResponse.set(response.userId);
        const firstProject = this.projects()[0];
        if (firstProject) this.selectProject(firstProject);
      },
      error: (err) => console.error('Fehler beim Abrufen der Projekte:', err),
    });
  }

  // Überprüft, ob der aktuelle Benutzer Admin des Projekts ist um es zu bearbeiten
  canUserEditProject(project: ProjectCardData): boolean {
    return String(project.admin_id || '') === String(this.currentUserId() || '');
  }

  // Überprüft, ob "Meine Tasks" Filter angezeigt werden soll (nur für Admins und Developer)
  canShowMyTasksForSelectedProject(): boolean {
    const project = this.selectedProject();
    return project?.role === 'Admin' || project?.role === 'Developer';
  }

  // Toggle für "Nur meine Tasks" Filter
  toggleMyTasksFilter(): void {
    this.showOnlyMyTasks.update((current) => !current);
  }

  // Setzt ausgewähltes Projekt und lädt zugehörige Tasks
  selectProject(project: ProjectCardData): void {
    this.selectedProjectId.set(project.project_id);
    this.selectedProjectName.set(project.name);
    if (project.role !== 'Admin' && project.role !== 'Developer') {
      this.showOnlyMyTasks.set(false);
    }
    this.loadTasksForProject(project.project_id);
  }

  // Lädt alle aktiven Locks vom Backend und speichert sie in einem Map
  private loadActiveLocks(): void {
    this.http.get<{ locks: { [taskId: string]: string } }>('/api/tasks/lock/all').subscribe({
      next: (response) => {
        const newLocks = new Map<number, string>();
        Object.entries(response.locks).forEach(([taskId, userEmail]) => {
          newLocks.set(Number(taskId), userEmail);
        });
        this.taskLocks.set(newLocks);
      },
      error: (err) => console.error('Fehler beim Laden der Locks:', err)
    });
  }

  // Lädt Tasks für das ausgewählte Projekt
  private loadTasksForProject(projectId: number): void {
    this.http.get<GetTasksResponse>(`/api/tasks/project/${projectId}`).subscribe({
      next: (response) => {
        this.tasks.set(
          (response.tasks ?? []).map((task) => ({
            task_id: task.task_id,
            title: task.title,
            status: task.status,
            assigned_to_email: task.assigned_to_email ?? task.assigned_to ?? null,
            assigned_to_id: task.assigned_to_id ?? null,
            deadline: task.deadline,
          })),
        );
      },
      error: (err) => {
        console.error('Fehler beim Abrufen der Tasks:', err);
        this.tasks.set([]);
      },
    });
  }

  // Sperrt Task beim Start des Drag-and-Drop
  dragStarted(event: CdkDragStart): void {
    const task = event.source.data as TaskCardData;

    // Verhindern, dass Dragger gestartet wird, wenn bereits gelockt
    if (this.taskLocks().has(task.task_id)) {
      event.source._dragRef.reset();
      alert(`Diese Task wird gerade von ${this.taskLocks().get(task.task_id)} bearbeitet.`);
      return;
    }

    // Lock beim Backend anfragen
    this.http.post('/api/tasks/lock/acquire', {
      task_id: task.task_id,
      user_email: this.currentUserEmail()
    }).subscribe({
      error: (err) => {
        if (err.status === 423) {
          event.source._dragRef.reset();
          alert(err.error?.message || 'Task ist gesperrt.');
        }
      }
    });
  }

  // Aktualisiert Status und gibt Lock frei (optimistisch mit Rollback)
  drop(event: CdkDragDrop<string>): void {
    const task = event.item.data as TaskCardData;

    // Wenn am gleichen Ort abgelegt -> Lock sofort freigeben
    if (event.previousContainer === event.container) {
      this.http.post('/api/tasks/lock/release', {
        task_id: task.task_id,
      }).subscribe();
      return;
    }

    const newStatus = event.container.data as 'To Do' | 'In Progress' | 'Done' | 'Blocked';

    // Optimistisches Update
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.task_id === task.task_id ? { ...t, status: newStatus } : t)),
    );

    this.http.post('/api/tasks/edit/updateStatus', {
      task_id: task.task_id,
      status: newStatus,
    }).subscribe({
      // Das Backend gibt den Lock nun automatisch nach updateStatus frei
      error: (err) => {
        console.error('Fehler beim Verschieben des Tasks:', err);
        this.tasks.update((tasks) =>
          tasks.map((t) => (t.task_id === task.task_id ? { ...t, status: task.status } : t)),
        );
        // Falls updateStatus fehlschlägt, manuell freigeben
        this.http.post('/api/tasks/lock/release', { task_id: task.task_id }).subscribe();
      },
    });
  }
}
