import { Component } from '@angular/core';
import { ProjectCard } from '../../shared/components/project-card/project-card';
import { TaskCard } from '../../shared/components/task-card/task-card';

@Component({
  selector: 'app-dashboard',
  imports: [ProjectCard, TaskCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
