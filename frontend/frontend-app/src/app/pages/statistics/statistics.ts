import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import { getSessionStorage } from '../../utils/storage';

// Chart.js Controller und Elemente registrieren
Chart.register(ArcElement, Tooltip, Legend, PieController);

type ProjectRole = 'Developer' | 'Admin' | 'Viewer';

type ProjectMemberApiItem = {
  user_id: number;
  username: string;
  email: string;
  role?: ProjectRole;
};

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: number;
  role?: ProjectRole;
  members?: ProjectMemberApiItem[];
};

type GetProjectsResponse = {
  userId: number;
  projects: ProjectApiItem[];
};

type ProjectStatistics = {
  projectId: number;
  projectName: string;
  statistics: {
    'To Do': number;
    'In Progress': number;
    'Done': number;
    'Blocked': number;
  };
  totalTasks: number;
};

@Component({
  selector: 'app-statistics',
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics implements OnInit {
  private http = inject(HttpClient);
  private userId = getSessionStorage()?.getItem('userId');

  projects = signal<ProjectApiItem[]>([]);
  selectedProjectId = signal<number | null>(null);
  statistics = signal<ProjectStatistics | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  selectedProject = computed(() => 
    this.projects().find(p => p.project_id === this.selectedProjectId()) ?? null
  );

  // Chart configuration - Pie Chart statt Doughnut
  chartData = signal<ChartConfiguration<'pie'>['data'] | null>(null);
  
  chartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: {
            size: 14
          },
          padding: 20
        }
      },
      title: {
        display: true,
        text: 'Task-Status Verteilung',
        font: {
          size: 18,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 30
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  constructor() {
    // Effect für automatische Aktualisierung bei Projekt-Wechsel
    effect(() => {
      const projectId = this.selectedProjectId();
      if (projectId && this.projects().length > 0) {
        this.loadStatistics();
      }
    });
  }

  ngOnInit() {
    this.loadProjects();
  }

  // Ruft Projekte ab und wählt das erste aus
  loadProjects() {
    if (!this.userId) {
      this.errorMessage.set('Benutzer nicht authentifiziert');
      return;
    }

    this.http.get<GetProjectsResponse>(`/api/project/get/${this.userId}`)
      .subscribe({
        next: (response) => {
          this.projects.set(response.projects || []);
          if (response.projects.length > 0) {
            this.selectedProjectId.set(response.projects[0].project_id);
            // loadStatistics() wird automatisch durch effect() getriggert
          }
        },
        error: (error) => {
          console.error('Fehler beim Laden der Projekte:', error);
          this.errorMessage.set('Fehler beim Laden der Projekte');
        }
      });
  }

  // Lädt Task-Statistiken für ausgewähltes Projekt und aktualisiert Chart
  loadStatistics() {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http.get<ProjectStatistics>(`/api/project/${projectId}/statistics`)
      .subscribe({
        next: (data) => {
          this.statistics.set(data);
          this.updateChartData(data);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Statistiken:', error);
          this.errorMessage.set('Fehler beim Laden der Statistiken');
          this.isLoading.set(false);
        }
      });
  }

  private updateChartData(stats: ProjectStatistics) {
    const statusColors = {
      'To Do': '#3B82F6',      // Blue
      'In Progress': '#FBBF24', // Yellow
      'Done': '#10B981',        // Green
      'Blocked': '#EF4444'      // Red
    };

    const labels = ['To Do', 'In Progress', 'Done', 'Blocked'];
    const data = labels.map(label => stats.statistics[label as keyof typeof stats.statistics]);
    const backgroundColor = labels.map(label => statusColors[label as keyof typeof statusColors]);

    this.chartData.set({
      labels,
      datasets: [{
        data,
        backgroundColor,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    });
  }
}
