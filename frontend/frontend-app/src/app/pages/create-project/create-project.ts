import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

type UserSuggestion = {
  user_id: number;
  email: string;
};

type MemberField = {
  email: string;
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
  memberFields: MemberField[] = [
    {
      email: '',
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null,
    },
  ];

  private http = inject(HttpClient);

  addMemberField(): void {
    this.memberFields.push({
      email: '',
      suggestions: [],
      showSuggestions: false,
      debounceTimer: null,
    });
  }

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
          `http://localhost:3000/api/project/member-search?query=${encodeURIComponent(value)}`,
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

  onMemberFocus(index: number): void {
    const field = this.memberFields[index];
    if (!field) {
      return;
    }

    field.showSuggestions = field.suggestions.length > 0;
  }

  onMemberBlur(index: number): void {
    const field = this.memberFields[index];
    if (!field) {
      return;
    }

    setTimeout(() => {
      field.showSuggestions = false;
    }, 100);
  }

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
}
