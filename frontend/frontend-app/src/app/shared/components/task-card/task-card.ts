import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';

export type TaskCardData = {
  task_id: number;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  assigned_to_email?: string | null;
  assigned_to_id?: string | null;
  deadline?: string | null;
};

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe, RouterModule],
  templateUrl: './task-card.html',
  styleUrl: './task-card.css',
})
export class TaskCard {
  task = input.required<TaskCardData>();
  lockedBy = input<string | null>(null);
}
