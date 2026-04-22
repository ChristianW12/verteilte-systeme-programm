import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type UserSuggestion = {
  user_id: string;
  email: string;
};

type MemberRole = 'Admin' | 'Developer' | 'Viewer';

type CreateProjectResponse = {
  message: string;
  project_id?: number;
};

type MemberField = {
  email: string;
  role: MemberRole;
  suggestions: UserSuggestion[];
  showSuggestions: boolean;
  debounceTimer: ReturnType<typeof setTimeout> | null;
};

@Component({
  selector: 'app-create-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-project.html',
  styleUrl: './create-project.css',
})
export class CreateProject {
  projectTitle = '';
  projectDescription = '';
  isSubmitting = false;

  memberFields: MemberField[] = [
    {
      email: '',
      role: 'Viewer',
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null,
    },
  ];

  private http = inject(HttpClient);
  private router = inject(Router);

  // Fügt ein neues Mitgliedsfeld hinzu
  addMemberField(): void {
    this.memberFields.push({
      email: '',
      role: 'Viewer',
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null,
    });
  }

  // Entfernt ein Mitgliedsfeld, stellt sicher, dass mindestens eines vorhanden bleibt
  removeMemberField(index: number): void {
    const field = this.memberFields[index];
    if (field?.debounceTimer) {
      clearTimeout(field.debounceTimer);
    }

    this.memberFields.splice(index, 1);

    if (this.memberFields.length === 0) {
      this.addMemberField();
    }
  }

  // Sucht Benutzer mit Debounce bei E-Mail-Eingabe
  onMemberInput(index: number): void {
    const field = this.memberFields[index];
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
            field.suggestions = response.users ?? [];
            field.showSuggestions = field.suggestions.length > 0;
          },
          error: () => {
            field.suggestions = [];
            field.showSuggestions = false;
          },
        });
    }, 350);
  }

  // Zeigt Vorschläge beim Fokussieren des E-Mail-Felds, falls vorhanden
  onMemberFocus(index: number): void {
    const field = this.memberFields[index];
    if (!field) {
      return;
    }

    field.showSuggestions = field.suggestions.length > 0;
  }

  // Versteckt Vorschläge beim Verlassen des E-Mail-Felds
  onMemberBlur(index: number): void {
    const field = this.memberFields[index];
    if (!field) {
      return;
    }

    setTimeout(() => {
      field.showSuggestions = false;
    }, 100);
  }

  // Setzt die E-Mail des Mitgliedsfelds auf den ausgewählten Vorschlag und versteckt die Vorschläge
  selectSuggestion(index: number, suggestion: UserSuggestion): void {
    const field = this.memberFields[index];
    if (!field) {
      return;
    }

    field.email = suggestion.email;
    field.suggestions = [];
    field.showSuggestions = false;

    if (field.debounceTimer) {
      clearTimeout(field.debounceTimer);
      field.debounceTimer = null;
    }
  }

  // Erstellt Projekt mit Mitgliedern und navigiert zum Dashboard
  onSubmit(): void {
    const name = this.projectTitle.trim();
    if (!name) {
      alert('Bitte einen Projekttitel eingeben.');
      return;
    }

    const members = this.memberFields
      .map((field) => ({
        email: field.email.trim(),
        role: field.role,
      }))
      .filter((member) => member.email.length > 0);

    this.isSubmitting = true;

    this.http
      .post<CreateProjectResponse>('/api/project/create', {
        name,
        description: this.projectDescription.trim(),
        members,
      })
      .subscribe({
        next: (response) => {
          alert(response.message || 'Projekt erfolgreich erstellt.');
          this.projectTitle = '';
          this.projectDescription = '';
          this.memberFields = [
            {
              email: '',
              role: 'Viewer',
              suggestions: [],
              showSuggestions: false,
              debounceTimer: null,
            },
          ];
          this.isSubmitting = false;
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          alert(error?.error?.message || 'Projekt konnte nicht erstellt werden.');
          this.isSubmitting = false;
        },
      });
  }
}
