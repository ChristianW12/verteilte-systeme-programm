import { Component, input } from '@angular/core';

export type ProjectCardData = {
  project_id: number;
  name: string;
  created_by?: string;
  admin_id?: number;
  role?: 'Developer' | 'Admin' | 'Viewer';
};

@Component({
  selector: 'app-project-card',
  imports: [],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
})
export class ProjectCard {
  project = input.required<ProjectCardData>();
  canUserEditProject = input<boolean>(false);
}

