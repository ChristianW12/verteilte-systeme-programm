import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type TaskDetail = {
  task_id: number;
  title: string;
  description?: string | null;
  status: 'To Do' | 'In Progress' | 'Done' | 'Blocked';
  priority: 'Low' | 'Medium' | 'High';
  assigned_to?: string | null;
  deadline?: string | null;
};

@Component({
  selector: 'app-detailed-task',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detailed-task.html',
  styleUrl: './detailed-task.css',
})
export class DetailedTask implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  task: TaskDetail | null = null;
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    console.log('Hier wird ngOnInit aufgerufen');

    this.route.paramMap.subscribe((params) => {
      const routeTaskId = Number(params.get('id'));
      const stateTaskId = Number((window.history.state as any)?.taskId);
      const taskId = Number.isInteger(routeTaskId) && routeTaskId > 0 ? routeTaskId : stateTaskId;

      if (!taskId || !Number.isInteger(taskId) || taskId <= 0) {
        this.error = 'Ungültige Task-ID';
        this.loading = false;
        return;
      }

      this.loading = true;
      this.error = null;
      this.loadTask(taskId);
    });
  }

  loadTask(id: number) {
    this.http.get<{ task?: TaskDetail }>(`http://localhost:3000/api/tasks/${id}`).subscribe({
      next: (res) => {
        console.log('Wir befinden ins in der API Anfrage')
        if (!res.task) {
          this.error = 'Task nicht gefunden';
        } else {
          this.task = res.task;
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Fehler beim Laden der Task';
        this.loading = false;
      },
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
