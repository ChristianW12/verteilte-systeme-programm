import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {Component, OnInit, inject, signal} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type Project = {
  project_id: number;
  name: string;
};

type ProjectsResponse = {
  projects: Project[];
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

  projects = signal<Project[]>([]);

  projectId = '';
  title = '';
  description = '';
  status = 'To Do';
  priority = 'Medium';
  deadline = '';
  // minDate für das date input, verhindert Auswahl vergangener Daten
  minDate = '';

  private http = inject(HttpClient);

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

    this.http.post<ProjectsResponse>('http://localhost:3000/api/tasks/get', { user_id: Number(userId) }).subscribe({
      next: (response) => {
        this.projects.set(response.projects ?? []);
      },
      error: () => {
        alert('Projekte konnten nicht geladen werden.');
      },
    });
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
      // Beide Strings sind im Format YYYY-MM-DD, daher funktioniert der String-Vergleich
      if (this.deadline < this.minDate) {
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
    };

    this.http.post<CreateTaskResponse>('http://localhost:3000/api/tasks/create', payload).subscribe({
      next: (response) => {
        this.router.navigate(['/dashboard']);
        alert(response.message || 'Task erfolgreich erstellt');
        this.projectId = '';
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
