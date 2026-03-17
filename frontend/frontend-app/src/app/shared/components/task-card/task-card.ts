import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

export type TaskCardData = {
  task_id: number;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  assigned_to?: string | null;
  deadline?: string | null;
};

@Component({
  selector: 'app-task-card',
  imports: [DatePipe],
  templateUrl: './task-card.html',
  styleUrl: './task-card.css',
})
export class TaskCard {
  task = input.required<TaskCardData>();
}
