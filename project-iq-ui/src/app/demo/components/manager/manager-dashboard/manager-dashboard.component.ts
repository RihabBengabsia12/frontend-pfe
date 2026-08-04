import { Component, OnInit, OnDestroy } from '@angular/core';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-manager-dashboard',
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.scss']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  
  loading: boolean = true;
  dossiers: any[] = [];
  subscription: Subscription = new Subscription();

  // KPIs
  totalDossiers: number = 0;
  totalActive: number = 0;
  pendingValidation: number = 0;
  criticalNoGo: number = 0;
  archivedProjects: number = 0;

  // Percentages
  activePercent: number = 0;
  pendingPercent: number = 0;
  nogoPercent: number = 0;
  archivedPercent: number = 0;

  // Decisions Knobs (Taux)
  tauxGo: number = 0;
  tauxNoGo: number = 0;
  tauxForceGo: number = 0;

  // Chart Data
  pieData: any;
  pieOptions: any;
  barData: any;
  barOptions: any;

  // Recent Hot Dossiers
  hotDossiers: any[] = [];
  
  // Auto-refresh timer
  refreshInterval: any;

  constructor(private validationService: ManagerValidationService) {}

  ngOnInit() {
    this.initChartOptions();
    this.loadData();
    
    // Auto-Actualisation toutes les 30 secondes pour le temps réel
    this.refreshInterval = setInterval(() => {
      this.loadData(true); // true = silent refresh (pas de squelette de chargement)
    }, 30000);
  }

  loadData(silent: boolean = false) {
    if (!silent) {
      this.loading = true;
    }
    this.subscription.add(
      this.validationService.getDossiersWithPacks().subscribe({
        next: (data) => {
          this.dossiers = data;
          this.calculateKPIs();
          this.buildChart();
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement des données Dashboard', err);
          this.loading = false;
        }
      })
    );
  }

  calculateKPIs() {
    this.totalDossiers = this.dossiers.length;
    const total = this.totalDossiers || 1; // Prevent division by zero

    this.totalActive = this.dossiers.filter(d => ['MATCHING', 'DRAFTING', 'PACK_READY'].includes(d.status)).length;
    this.activePercent = Math.round((this.totalActive / total) * 100);

    this.pendingValidation = this.dossiers.filter(d => ['SUBMITTED', 'PENDING_VALIDATION'].includes(d.status)).length;
    this.pendingPercent = Math.round((this.pendingValidation / total) * 100);

    this.criticalNoGo = this.dossiers.filter(d => d.status === 'NO_GO_CONFIRMED').length;
    this.nogoPercent = Math.round((this.criticalNoGo / total) * 100);

    this.archivedProjects = this.dossiers.filter(d => d.status === 'ARCHIVED').length;
    this.archivedPercent = Math.round((this.archivedProjects / total) * 100);

    this.hotDossiers = this.dossiers
        .filter(d => ['NO_GO_CONFIRMED', 'SUBMITTED', 'PENDING_VALIDATION'].includes(d.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
  }

  buildChart() {
    // 1. Doughnut Chart (Répartition)
    const active = this.totalActive;
    const validation = this.pendingValidation;
    const closed = this.archivedProjects;

    this.pieData = {
      labels: ['Production (IA)', 'Validation', 'Clôturés'],
      datasets: [
        {
          data: [active, validation, closed],
          backgroundColor: ['#a855f7', '#f59e0b', '#10b981'],
          hoverBackgroundColor: ['#9333ea', '#d97706', '#059669'],
          borderWidth: 0
        }
      ]
    };

    // 2. Bar Chart (Bilan des Décisions : Go, No-Go, Force Go)
    const countForceGo = this.dossiers.filter(d => d.status === 'FORCE_GO').length;
    // Approximations selon le backend (No-Go confirmé ou archivé avec un score très faible)
    const countNoGo = this.dossiers.filter(d => d.status === 'NO_GO_CONFIRMED' || (d.status === 'ARCHIVED' && d.pwinScore < 20)).length;
    // Go classiques (Archivés avec succès)
    const countGo = this.dossiers.filter(d => d.status === 'ARCHIVED' && d.pwinScore >= 20).length;
    
    const totalDecisions = (countGo + countNoGo + countForceGo) || 1; // Eviter div par 0
    
    // Calcul en pourcentages (Taux)
    this.tauxGo = Math.round((countGo / totalDecisions) * 100) || 0;
    this.tauxNoGo = Math.round((countNoGo / totalDecisions) * 100) || 0;
    this.tauxForceGo = Math.round((countForceGo / totalDecisions) * 100) || 0;
  }

  initChartOptions() {
    this.pieOptions = {
      plugins: {
        legend: { labels: { usePointStyle: true, color: '#495057', font: { weight: '500' } }, position: 'bottom' }
      },
      cutout: '65%',
      animation: { animateScale: true, animateRotate: true }
    };
  }

  refresh() {
    this.loadData();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
