import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ProjectFromApi = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: number;
  role: string;
  members?: {
    user_id: number;
    username: string;
    email: string;
    role?: string;
  }[];
};

type GetProjectsResponse = {
  userId: number;
  projects: ProjectFromApi[];
};

type MemberRole = 'Admin' | 'Developer' | 'Viewer';

type MemberField = {
  email: string;
  role: MemberRole;
};

type EditProjectResponse = {
  message: string;
};

@Component({
  selector: 'app-edit-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-project.html',
  styleUrl: './edit-project.css',
})
export class EditProject implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  projectId: number | null = null;
  userId: number | null = null;
  isAuthorized = false;
  isLoading = true;
  isSubmitting = signal(false);

  projectTitle = signal('');
  projectDescription = signal('');

  memberFields = signal<MemberField[]>([]);

  private normalizeMemberRole(role: unknown): MemberRole {
    return role === 'Admin' || role === 'Developer' || role === 'Viewer' ? role : 'Viewer';
  }



  ngOnInit(): void {
    const userIdRaw = localStorage.getItem('userId');
    const userId = Number(userIdRaw);

    if (!userIdRaw || !Number.isInteger(userId) || userId <= 0) {
      this.router.navigate(['/login']);
      return;
    }

    this.userId = userId;

    this.route.paramMap.subscribe((params) => {
      const id = params.get('projectId');
      const projectId = Number(id);

      if (!id || !Number.isInteger(projectId) || projectId <= 0) {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.projectId = projectId;
      this.checkAuthorization(userId, projectId);
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

        this.projectTitle.set(project.name || '');
        this.projectDescription.set(project.description || '');
        this.memberFields.set(
          (project.members ?? []).map((member) => ({
            email: String(member.email || ''),
            role: this.normalizeMemberRole(member.role),
          })),
        );
        this.isAuthorized = true;

      },
      error: () => {
        this.router.navigate(['/dashboard']);
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

  removeMemberField(index: number): void {
    this.memberFields.update((fields) => fields.filter((_, i) => i !== index));
  }

  onMemberRoleChange(index: number, role: string): void {
    const allowedRoles = new Set<MemberRole>(['Admin', 'Developer', 'Viewer']);
    const nextRole = allowedRoles.has(role as MemberRole) ? (role as MemberRole) : 'Viewer';

    this.memberFields.update((fields) =>
      fields.map((field, i) => (i === index ? { ...field, role: nextRole } : field)),
    );
  }

  onSubmit(): void {
    if (!this.projectId || !this.userId) {
      alert('Projekt oder Benutzer ungueltig.');
      return;
    }

    const name = this.projectTitle().trim();
    if (!name) {
      alert('Bitte einen Projekttitel eingeben.');
      return;
    }

    const members = this.memberFields()
      .map((field) => ({
        email: field.email.trim(),
        role: field.role,
      }))
      .filter((member) => member.email.length > 0);

    this.isSubmitting.set(true);

    this.http
      .post<EditProjectResponse>('/api/project/edit', {
        project_id: this.projectId,
        user_id: this.userId,
        name,
        description: this.projectDescription().trim(),
        members,
      })
      .subscribe({
        next: (response) => {
          alert(response.message || 'Projekt erfolgreich aktualisiert.');
          this.isSubmitting.set(false);
        },
        error: (error) => {
          alert(error?.error?.message || 'Projekt konnte nicht aktualisiert werden.');
          this.isSubmitting.set(false);
        },
      });
  }
}

