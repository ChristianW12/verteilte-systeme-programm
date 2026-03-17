import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  projects: Project[] = [];

  projectId = '';
  title = '';
  description = '';
  status = 'To Do';
  priority = 'Medium';
  deadline = '';

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.http.post<ProjectsResponse>('http://localhost:3000/api/tasks/get', {}).subscribe({
      next: (response) => {
        this.projects = response.projects ?? [];
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
