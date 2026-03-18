import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ProjectCard, ProjectCardData } from '../../shared/components/project-card/project-card';
import { TaskCard, TaskCardData } from '../../shared/components/task-card/task-card';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: number;
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
  assigned_to?: string | null;
  deadline?: string | null;
};

type GetTasksResponse = {
  tasks: TaskApiItem[];
};

@Component({
  selector: 'app-dashboard',
  imports: [ProjectCard, TaskCard, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);

  private userId = localStorage.getItem('userId');

  projects = signal<ProjectCardData[]>([]);
  selectedProjectId = signal<number | null>(null);
  selectedProjectName = signal<string>('Kein Projekt ausgewaehlt');
  tasks = signal<TaskCardData[]>([]);

  todoTasks = computed(() => this.tasks().filter((task) => task.status === 'To Do'));
  inProgressTasks = computed(() => this.tasks().filter((task) => task.status === 'In Progress'));
  doneTasks = computed(() => this.tasks().filter((task) => task.status === 'Done'));
  blockedTasks = computed(() => this.tasks().filter((task) => task.status === 'Blocked'));

  private userIdResponse = signal<number | null>(null);

  ngOnInit(): void {
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Holt die Daten für die Projekte bei denen der eingeloggte User beteiligt ist
    this.http.get<GetProjectsResponse>(`http://localhost:3000/api/project/get/${this.userId}`).subscribe({
      next: (response) => {
        this.projects.set(
          response.projects.map((project) => ({
            project_id: project.project_id,
            name: project.name,
            created_by: project.created_by,
            // Hier wird noch zusätzlich die ID des Admins gespeichert, hilft uns später wenn wir ein Projekt bearbeiten Button einfügen möchte 
            admin_id: project.admin_id,
          })),
        );
        this.userIdResponse.set(response.userId);

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
    return project.admin_id === Number(this.userId);
  }


  selectProject(project: ProjectCardData): void {
    this.selectedProjectId.set(project.project_id);
    this.selectedProjectName.set(project.name);
    this.loadTasksForProject(project.project_id);
  }

  private loadTasksForProject(projectId: number): void {
    this.http.get<GetTasksResponse>(`http://localhost:3000/api/tasks/project/${projectId}`).subscribe({
      next: (response) => {
        this.tasks.set(
          (response.tasks ?? []).map((task) => ({
            task_id: task.task_id,
            title: task.title,
            status: task.status,
            assigned_to: task.assigned_to,
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
}

