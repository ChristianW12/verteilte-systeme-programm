import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type Project = {
  project_id: number;
  name: string;
};

type ProjectsResponse = {
  projects: Project[];
};

type User = {
  user_id: number;
  email: string;
};

type UsersResponse = {
  users: User[];
};

type CreateTaskResponse = {
  message: string;
};

@Component({
  selector: 'app-create-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-task.html',
  styleUrl: './create-task.css',
})
export class CreateTask implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);

  projects = signal<Project[]>([]);
  allUsers = signal<User[]>([]);
  assignees = signal<User[]>([]);

  projectId = '';
  assignedTo = '';
  title = '';
  description = '';
  status = 'To Do';
  priority = 'Medium';
  deadline = '';
  minDate = '';

  private selectedProjectId = signal<string>('');

  constructor() {
    // Automatisch Bearbeiter laden, wenn sich selectedProjectId ändert
    effect(() => {
      const currentProjectId = this.selectedProjectId();
      if (currentProjectId) {
        this.loadAssigneesForProject(Number(currentProjectId));
      } else {
        this.assignees.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Heutiges Datum im Format YYYY-MM-DD (lokal)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.minDate = `${year}-${month}-${day}`;

    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('Bitte zuerst einloggen.');
      return;
    }

    this.http.post<ProjectsResponse>('/api/tasks/get', { user_id: Number(userId) }).subscribe({
      next: (response) => {
        this.projects.set(response.projects ?? []);
      },
      error: () => {
        alert('Projekte konnten nicht geladen werden.');
      },
    });
  }

  loadAssigneesForProject(projectId: number): void {
    console.log('Laden der Bearbeiter des Projekts:', projectId);
    this.http.get<UsersResponse>(`/api/project/${projectId}/assignees`).subscribe({
      next: (response) => {
        console.log('Bearbeiter geladen:', response.users);
        this.assignees.set(response.users ?? []);
      },
      error: (err) => {
        console.log('Error beim laden der Bearbeiter:', err);
        this.assignees.set([]);
      },
    });
  }

  updateProjectId(newProjectId: string): void {
    this.projectId = newProjectId;
    this.selectedProjectId.set(newProjectId);
  }

  onSubmit(): void {
    const userId = localStorage.getItem('userId');

    if (!userId) {
      alert('Bitte zuerst einloggen.');
      return;
    }

    if (!this.projectId) {
      alert('Bitte ein Projekt waehlen.');
      return;
    }

    if (!this.title.trim()) {
      alert('Bitte einen Titel eingeben.');
      return;
    }

    // Client-seitige Validierung: Deadline darf nicht in der Vergangenheit liegen
    if (this.deadline) {
      const deadlineDate = new Date(this.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);

      if (deadlineDate < today) {
        alert('Die Deadline darf nicht in der Vergangenheit liegen.');
        return;
      }
    }

    const payload = {
      project_id: Number(this.projectId),
      title: this.title.trim(),
      description: this.description.trim(),
      status: this.status,
      priority: this.priority,
      deadline: this.deadline || null,
      created_by: Number(userId),
      assigned_to: this.assignedTo ? Number(this.assignedTo) : null,
    };

    this.http.post<CreateTaskResponse>('/api/tasks/create', payload).subscribe({
      next: (response) => {
        this.router.navigate(['/dashboard']);
        alert(response.message || 'Task erfolgreich erstellt');
        this.projectId = '';
        this.selectedProjectId.set('');
        this.assignedTo = '';
        this.title = '';
        this.description = '';
        this.status = '';
        this.priority = '';
        this.deadline = '';

      },
      error: (err) => {
        alert(err.error?.message || 'Task konnte nicht erstellt werden');
      },
    });
  }
}

