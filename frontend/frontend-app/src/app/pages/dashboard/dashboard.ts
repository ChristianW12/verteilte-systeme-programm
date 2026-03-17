import { Component, inject, OnInit, signal } from '@angular/core';
import { ProjectCard, ProjectCardData } from '../../shared/components/project-card/project-card';
import { TaskCard } from '../../shared/components/task-card/task-card';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: number;
};

type GetProjectsResponse = {
  userId: number;
  projects: ProjectApiItem[];
};

@Component({
  selector: 'app-dashboard',
  imports: [ProjectCard, TaskCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);

  private userId = localStorage.getItem('userId');

  projects = signal<ProjectCardData[]>([]);
  private userIdResponse = signal<number | null>(null);

  ngOnInit(): void {
    if (!this.userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.http.get<GetProjectsResponse>(`http://localhost:3000/api/project/get/${this.userId}`).subscribe({
      next: (response) => {
        this.projects.set(
          response.projects.map((project) => ({
            project_id: project.project_id,
            name: project.name,
            description: project.description,
            created_by: String(project.created_by),
          })),
        );
        this.userIdResponse.set(response.userId);

        if (String(this.userIdResponse()) !== this.userId) {
          console.warn('Die userId aus der Antwort stimmt nicht mit der gespeicherten userId überein.');
          alert('Angefragte Projekte gehören nicht zum eingeloggten Benutzer!');
          this.router.navigate(['/login']);
        }

        console.log('Projekte erfolgreich abgerufen:', this.projects());
      },
      error: (err) => {
        console.error('Fehler beim Abrufen der Projekte:', err);
      },
    });
  }
}

