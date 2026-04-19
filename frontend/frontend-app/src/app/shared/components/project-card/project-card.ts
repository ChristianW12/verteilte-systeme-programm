import { Component, input } from '@angular/core';
import { RouterLink } from "@angular/router";

export type ProjectCardData = {
  project_id: number;
  name: string;
  description?: string;
  created_by?: string;
  admin_id?: string;
  role?: 'Developer' | 'Admin' | 'Viewer';
  members?: {
    user_id: string;
    username: string;
    email: string;
    role: 'Developer' | 'Admin' | 'Viewer';
  }[];
};

@Component({
  selector: 'app-project-card',
  imports: [RouterLink],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
})
export class ProjectCard {
  project = input.required<ProjectCardData>();
  canUserEditProject = input.required<boolean>();
}
