import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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

  task = signal<TaskDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    console.log('Hier wird ngOnInit aufgerufen');

    this.route.paramMap.subscribe((params) => {
      const routeTaskId = Number(params.get('id'));
      const stateTaskId = Number((window.history.state as any)?.taskId);
      const taskId = Number.isInteger(routeTaskId) && routeTaskId > 0 ? routeTaskId : stateTaskId;

      if (!taskId || !Number.isInteger(taskId) || taskId <= 0) {
        this.error.set('Ungültige Task-ID');
        this.task.set(null);
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.error.set(null);
      this.loadTask(taskId);
    });
  }

  loadTask(id: number) {
    this.http.get<{ task?: TaskDetail }>(`http://localhost:3000/api/tasks/${id}`).subscribe({
      next: (res) => {
        console.log('Wir befinden uns in der API Anfrage', res.task?.task_id);
        if (!res.task) {
          this.error.set('Task nicht gefunden');
          this.task.set(null);
          console.log('Task nicht gefunden');
        } else {
          this.task.set(res.task);
          console.log('Task gefunden:', this.task());
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Fehler beim Laden der Task');
        this.task.set(null);
        console.log('Fehler beim Laden der Task');
        this.loading.set(false);
      },
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
