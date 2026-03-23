import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type ProjectFromApi = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: number;
  role: string;
};

type GetProjectsResponse = {
  userId: number;
  projects: ProjectFromApi[];
};

@Component({
  selector: 'app-edit-project',
  imports: [],
  templateUrl: './edit-project.html',
  styleUrl: './edit-project.css',
})
export class EditProject implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  projectId = signal<number | null>(null);
  userId = signal(localStorage.getItem('userId') || null);
  isAuthorized = signal(false);
  isLoading = signal(true);

  ngOnInit(): void {
    const userId = this.userId();
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.route.paramMap.subscribe((params) => {
      const id = params.get('projectId');
      if (id) {
        this.projectId.set(Number(id));
        this.checkAuthorization(Number(userId), Number(id));
      }
    });
  }

  private checkAuthorization(userId: number, projectId: number): void {
    this.http.get<GetProjectsResponse>(`/api/project/get/${userId}`).subscribe({
      next: (response) => {
        const project = response.projects.find((p) => p.project_id === projectId);

        if (!project) {
          this.router.navigate(['/dashboard']);
          return;
        }

        if (project.admin_id !== userId) {
          this.router.navigate(['/dashboard']);
          return;
        }

        this.isAuthorized.set(true);
      },
      error: () => {
        this.router.navigate(['/dashboard']);
      },
      complete: () => {
        this.isLoading.set(false);
      },
    });
  }
}

