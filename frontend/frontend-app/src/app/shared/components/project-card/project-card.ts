import { Component, input } from '@angular/core';

export type ProjectCardData = {
  project_id: number;
  name: string;
  created_by?: string;
};

@Component({
  selector: 'app-project-card',
  imports: [],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
})
export class ProjectCard {
  project = input.required<ProjectCardData>();
}