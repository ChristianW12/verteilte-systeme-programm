import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getSessionStorage } from '../../utils/storage';

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

type UserSuggestion = {
  user_id: number;
  email: string;
};

type MemberRole = 'Admin' | 'Developer' | 'Viewer';

type MemberField = {
  email: string;
  role: MemberRole;
  suggestions?: UserSuggestion[];
  showSuggestions?: boolean;
  debounceTimer?: ReturnType<typeof setTimeout> | null;
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
export class EditProject implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  projectId: number | null = null;
  userId: number | null = null;
  creatorEmail: string | null = null;
  isAuthorized = false;
  isLoading = true;
  isSubmitting = signal(false);

  projectTitle = signal('');
  projectDescription = signal('');

  memberFields = signal<MemberField[]>([]);
  newMemberFields = signal<MemberField[]>([this.createEmptyMemberField()]);

  private createEmptyMemberField(): MemberField {
    return {
      email: '',
      role: 'Viewer',
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null,
    };
  }

  private normalizeMemberRole(role: unknown): MemberRole {
    return role === 'Admin' || role === 'Developer' || role === 'Viewer' ? role : 'Viewer';
  }



  ngOnInit(): void {
    const userIdRaw = getSessionStorage()?.getItem('userId');
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
        this.creatorEmail = String(project.created_by).toLowerCase();
        this.memberFields.set(
          (project.members ?? [])
            .filter((member) => String(member.email || '').toLowerCase() !== this.creatorEmail)
            .map((member) => ({
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

  ngOnDestroy(): void {
    for (const field of this.newMemberFields()) {
      if (field.debounceTimer) {
        clearTimeout(field.debounceTimer);
      }
    }
  }

  addMemberField(): void {
    this.newMemberFields.update((fields) => [...fields, this.createEmptyMemberField()]);
  }

  removeNewMemberField(index: number): void {
    const field = this.newMemberFields()[index];
    if (field?.debounceTimer) {
      clearTimeout(field.debounceTimer);
    }

    this.newMemberFields.update((fields) => fields.filter((_, i) => i !== index));
  }

  onMemberInput(index: number): void {
    const fields = this.newMemberFields();
    const field = fields[index];
    if (!field) {
      return;
    }

    const value = field.email.trim();

    if (field.debounceTimer) {
      clearTimeout(field.debounceTimer);
    }

    if (value.length < 2) {
      field.suggestions = [];
      field.showSuggestions = false;
      return;
    }

    field.debounceTimer = setTimeout(() => {
      this.http
        .get<{ users: UserSuggestion[] }>(
          `/api/project/member-search?query=${encodeURIComponent(value)}`,
        )
        .subscribe({
          next: (response) => {
            const currentFields = this.newMemberFields();
            const currentField = currentFields[index];
            if (!currentField) {
              return;
            }

            currentField.suggestions = response.users ?? [];
            currentField.showSuggestions = currentField.suggestions.length > 0;
            currentField.debounceTimer = null;
            this.newMemberFields.set([...currentFields]);
          },
          error: () => {
            const currentFields = this.newMemberFields();
            const currentField = currentFields[index];
            if (!currentField) {
              return;
            }

            currentField.suggestions = [];
            currentField.showSuggestions = false;
            currentField.debounceTimer = null;
            this.newMemberFields.set([...currentFields]);
          },
        });
    }, 350);
  }

  onMemberFocus(index: number): void {
    const fields = this.newMemberFields();
    const field = fields[index];
    if (!field) {
      return;
    }

    field.showSuggestions = (field.suggestions ?? []).length > 0;
    this.newMemberFields.set([...fields]);
  }

  onMemberBlur(index: number): void {
    const fields = this.newMemberFields();
    const field = fields[index];
    if (!field) {
      return;
    }

    setTimeout(() => {
      const currentFields = this.newMemberFields();
      const currentField = currentFields[index];
      if (!currentField) {
        return;
      }

      currentField.showSuggestions = false;
      this.newMemberFields.set([...currentFields]);
    }, 100);
  }

  selectSuggestion(index: number, suggestion: UserSuggestion): void {
    const fields = this.newMemberFields();
    const field = fields[index];
    if (!field) {
      return;
    }

    const selectedEmail = String(suggestion.email).toLowerCase();

    if (selectedEmail === this.creatorEmail) {
      alert('Sie können sich nicht selbst hinzufügen.');
      return;
    }

    field.email = suggestion.email;
    field.suggestions = [];
    field.showSuggestions = false;

    if (field.debounceTimer) {
      clearTimeout(field.debounceTimer);
      field.debounceTimer = null;
    }

    this.newMemberFields.set([...fields]);
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

    const existingMembers = this.memberFields()
      .map((field) => ({
        email: field.email.trim(),
        role: field.role,
      }))
      .filter((member) => member.email.length > 0);

    const newMembers = this.newMemberFields()
      .map((field) => ({
        email: field.email.trim().toLowerCase(),
        role: field.role,
      }))
      .filter((member) => member.email.length > 0);

    // Überprüfe ob jemand versucht, sich selbst (den Ersteller) hinzuzufügen
    const creatorInNewMembers = newMembers.find((member) => member.email === this.creatorEmail);
    if (creatorInNewMembers) {
      alert('Sie können sich nicht selbst hinzufügen.');
      return;
    }

    const members = [...existingMembers, ...newMembers];

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
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          alert(error?.error?.message || 'Projekt konnte nicht aktualisiert werden.');
          this.isSubmitting.set(false);
        },
      });
  }

  onDeleteProject(): void {
    if (!this.projectId || !this.userId) {
      alert('Projekt oder Benutzer ungültig.');
      return;
    }

    const confirmation = confirm('Möchten Sie dieses Projekt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.');
    if (!confirmation) {
      return;
    }

    this.isSubmitting.set(true);

    this.http
      .post<{ message: string }>('/api/project/delete', {
        project_id: this.projectId,
        user_id: this.userId,
      })
      .subscribe({
        next: (response) => {
          alert(response.message || 'Projekt erfolgreich gelöscht.');
          this.isSubmitting.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          alert(error?.error?.message || 'Projekt konnte nicht gelöscht werden.');
          this.isSubmitting.set(false);
        },
      });
  }
}
