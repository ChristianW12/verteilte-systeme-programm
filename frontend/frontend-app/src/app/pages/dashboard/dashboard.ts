import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ProjectCard, ProjectCardData } from '../../shared/components/project-card/project-card';
import { TaskCard, TaskCardData } from '../../shared/components/task-card/task-card';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CdkDragDrop, DragDropModule, CdkDragStart } from '@angular/cdk/drag-drop';
import { getSessionStorage } from '../../utils/storage';

type ProjectRole = 'Developer' | 'Admin' | 'Viewer';

type ProjectMemberApiItem = {
  user_id: number;
  username: string;
  email: string;
  role?: ProjectRole;
};

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: number;
  role?: ProjectRole;
  members?: ProjectMemberApiItem[];
};

type GetProjectsResponse = {
  userId: number;
  projects: ProjectApiItem[];
};

type TaskApiItem = {
  task_id: number;
  project_id: number;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  assigned_to_email?: string | null;
  assigned_to?: string | null;
  assigned_to_id?: number | null;
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

  private userId = getSessionStorage()?.getItem('userId');

  projects = signal<ProjectCardData[]>([]);
  selectedProjectId = signal<number | null>(null);
  selectedProjectName = signal<string>('Kein Projekt ausgewaehlt');
  tasks = signal<TaskCardData[]>([]);

  selectedProject = computed(() => this.projects().find((project) => project.project_id === this.selectedProjectId()) ?? null);

  showOnlyMyTasks = signal(false);

  todoTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'To Do'));
  inProgressTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'In Progress'));
  doneTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'Done'));
  blockedTasks = computed(() => this.getFilteredTasks().filter((task) => task.status === 'Blocked'));

  private userIdResponse = signal<number | null>(null);

  private normalizeProjectRole(role: unknown): ProjectRole {
    return role === 'Admin' || role === 'Developer' || role === 'Viewer' ? role : 'Viewer';
  }

  private getFilteredTasks(): TaskCardData[] {
    const allTasks = this.tasks();
    if (!this.showOnlyMyTasks() || !this.canShowMyTasksForSelectedProject()) {
      return allTasks;
    }

    const currentUserId = Number(this.userId);
    if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
      return allTasks;
    }

    return allTasks.filter((task) => task.assigned_to_id === currentUserId);
  }


  ngOnInit(): void {
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Holt die Daten für die Projekte bei denen der eingeloggte User beteiligt ist
    this.http.get<GetProjectsResponse>(`/api/project/get/${this.userId}`).subscribe({
      next: (response) => {
        this.projects.set(
          response.projects.map((project) => ({
            project_id: project.project_id,
            name: project.name,
            description: project.description,
            created_by: project.created_by,
            // Hier wird noch zusätzlich die ID des Admins gespeichert, hilft uns später wenn wir ein Projekt bearbeiten Button einfügen möchte
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
        console.log('Das sind die Admins der Projekte:', response.projects.map((p) => p.admin_id));

        if (String(this.userIdResponse()) !== this.userId) {
          console.warn('Die userId aus der Antwort stimmt nicht mit der gespeicherten userId überein.');
          alert('Angefragte Projekte gehören nicht zum eingeloggten Benutzer!');
          this.router.navigate(['/login']);
        }

        const firstProject = this.projects()[0];
        if (firstProject) {
          this.selectProject(firstProject);
        }

        console.log('Projekte erfolgreich abgerufen:', this.projects());
      },
      error: (err) => {
        console.error('Fehler beim Abrufen der Projekte:', err);
      },
    });

  }

  canUserEditProject(project: ProjectCardData): boolean {
    return Number(project.admin_id) === Number(this.userId);
  }

  canShowMyTasksForSelectedProject(): boolean {
    const project = this.selectedProject();
    return project?.role === 'Admin' || project?.role === 'Developer';
  }

  toggleMyTasksFilter(): void {
    this.showOnlyMyTasks.update((current) => !current);
  }


  selectProject(project: ProjectCardData): void {
    this.selectedProjectId.set(project.project_id);
    this.selectedProjectName.set(project.name);

    // Filter darf in Viewer-Projekten nicht aktiv bleiben.
    if (project.role !== 'Admin' && project.role !== 'Developer') {
      this.showOnlyMyTasks.set(false);
    }

    this.loadTasksForProject(project.project_id);
  }

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

  drop(event: CdkDragDrop<string>): void {
    if (event.previousContainer === event.container) {
      // Innerhalb der gleichen Liste verschoben (Reordering) - hier optional implementierbar
      return;
    }

    const task = event.item.data as TaskCardData;
    const newStatus = event.container.data as 'To Do' | 'In Progress' | 'Done' | 'Blocked';

    // Optimistisches Update im Frontend (damit es sofort "schnappt")
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.task_id === task.task_id ? { ...t, status: newStatus } : t)),
    );

    // Backend Update
    this.http.post('/api/tasks/edit/updateStatus', {
      task_id: task.task_id,
      user_id: Number(this.userId),
      status: newStatus,
    }).subscribe({
      error: (err) => {
        console.error('Fehler beim Verschieben des Tasks:', err);
        // Rollback bei Fehler
        this.tasks.update((tasks) =>
          tasks.map((t) => (t.task_id === task.task_id ? { ...t, status: task.status } : t)),
        );
      },
    });
  }

  dragStarted(event: CdkDragStart): void {
    console.log('Task wird bewegt:', event.source.data);
  }
}

