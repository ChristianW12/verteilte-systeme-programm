import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
import { getSessionStorage } from '../../utils/storage';

// Chart.js Controller und Elemente registrieren
Chart.register(ArcElement, Tooltip, Legend, PieController);

// Response Types
type ProjectRole = 'Developer' | 'Admin' | 'Viewer';

type ProjectMemberApiItem = {
  user_id: string;
  username: string;
  email: string;
  role?: ProjectRole;
};

type ProjectApiItem = {
  project_id: number;
  name: string;
  description: string;
  created_by: string;
  admin_id: string;
  role?: ProjectRole;
  members?: ProjectMemberApiItem[];
};

type GetProjectsResponse = {
  userId: string;
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

  // Signals (reaktive State-Verwaltung)
  projects = signal<ProjectApiItem[]>([]);
  selectedProjectId = signal<number | null>(null);
  statistics = signal<ProjectStatistics | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Gibt das aktuell ausgewählte Projekt zurück
  selectedProject = computed(() =>
    this.projects().find(p => p.project_id === this.selectedProjectId()) ?? null
  );

  // Chart Konfiguration
  // Pie Chart für Task-Status Verteilung
  chartData = signal<ChartConfiguration<'pie'>['data'] | null>(null);

  // Chart-Optionen: Responsiv, Legende, Titel, Tooltip mit Prozentwert
  chartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      // Legende unten positionieren
      legend: {
        position: 'bottom',
        labels: {
          font: {
            size: 14
          },
          padding: 20
        }
      },
      // Titel für das Chart
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
      // Tooltip: zeigt Anzahl und Prozentanteil bei Hover
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
    // Automatische Aktualisierung: wenn selectedProjectId sich ändert, loadStatistics() aufrufen
    effect(() => {
      const projectId = this.selectedProjectId();
      if (projectId && this.projects().length > 0) {
        this.loadStatistics();
      }
    });
  }

  ngOnInit() {
    if (!getSessionStorage()) {
      return;
    }
    this.loadProjects();
  }

  // Ruft alle Projekte des Benutzers ab und wählt das erste aus
  loadProjects() {
    // GET-Request an Backend: gibt alle Projekte des Benutzers zurück
    this.http.get<GetProjectsResponse>('/api/project/get/me')
      .subscribe({
        // Erfolg: Projekte speichern und erstes Projekt auswählen
        next: (response) => {
          this.projects.set(response.projects || []);
          if (response.projects.length > 0) {
            this.selectedProjectId.set(response.projects[0].project_id);
            // loadStatistics() wird automatisch durch effect() getriggert
          }
        },
        // Fehler: Fehlermeldung anzeigen
        error: (error) => {
          console.error('Fehler beim Laden der Projekte:', error);
          this.errorMessage.set('Fehler beim Laden der Projekte');
        }
      });
  }

  // Ruft Task-Statistiken für ausgewähltes Projekt ab und aktualisiert Chart
  loadStatistics() {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // GET-Request an Backend: gibt Task-Statistiken für das Projekt zurück
    this.http.get<ProjectStatistics>(`/api/project/${projectId}/statistics`)
      .subscribe({
        // Erfolg: Statistiken speichern und Chart aktualisieren
        next: (data) => {
          this.statistics.set(data);
          this.updateChartData(data);
          this.isLoading.set(false);
        },
        // Fehler: Fehlermeldung anzeigen und Loading deaktivieren
        error: (error) => {
          console.error('Fehler beim Laden der Statistiken:', error);
          this.errorMessage.set('Fehler beim Laden der Statistiken');
          this.isLoading.set(false);
        }
      });
  }

  // Formatiert Statistik-Daten für das Pie Chart
  private updateChartData(stats: ProjectStatistics) {
    // Farb-Zuordnung für Task-Status
    const statusColors = {
      'To Do': '#3B82F6',      // Blau
      'In Progress': '#FBBF24', // Gelb
      'Done': '#10B981',        // Grün
      'Blocked': '#EF4444'      // Rot
    };

    // Labels für das Chart
    const labels = ['To Do', 'In Progress', 'Done', 'Blocked'];

    // Zahlen-Daten aus Statistiken auslesen (in gleicher Reihenfolge wie labels)
    const data = labels.map(label => stats.statistics[label as keyof typeof stats.statistics]);

    // Farben zuordnen (in gleicher Reihenfolge wie labels)
    const backgroundColor = labels.map(label => statusColors[label as keyof typeof statusColors]);

    // Chart-Daten Signal aktualisieren
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
