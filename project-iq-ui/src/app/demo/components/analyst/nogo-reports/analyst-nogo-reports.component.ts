import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import { DossierStatusService } from '../../../service/dossier-status.service';
import { environment } from 'src/environments/environment';

@Component({
    templateUrl: './analyst-nogo-reports.component.html',
    providers: [MessageService],
    styles: [`
        .fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(20px);
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        
        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .hover-lift {
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
            will-change: transform;
        }
        .hover-lift:hover {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important;
        }

        .kpi-card i {
            transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .kpi-card:hover i {
            transform: rotate(15deg) scale(1.2);
        }
        
        ::ng-deep .custom-table-premium .p-datatable-tbody > tr {
            transition: all 0.3s ease;
        }
        ::ng-deep .custom-table-premium .p-datatable-tbody > tr:hover {
            transform: translateX(4px);
            background-color: #f8fafc !important;
        }
    `]
})
export class AnalystNogoReportsComponent implements OnInit {
    
    dossiers: Dossier[] = [];
    isLoading = false;

    displayDetailsDialog = false;
    selectedDossier: Dossier | null = null;

    totalNogo = 0;
    savedHommesMois = 0;
    avgPwinNogo = 0;
    searchQuery = '';

    displayPdfViewer = false;
    pdfUrl: SafeResourceUrl | null = null;

    constructor(
        private messageService: MessageService,
        private projectsService: AnalystProjectsService,
        private router: Router,
        private statusService: DossierStatusService,
        private sanitizer: DomSanitizer
    ) {}

    ngOnInit(): void {
        this.loadNogoReports();
    }
    
    loadNogoReports(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                this.dossiers = data.filter(d => d.nogoReportPath != null);
                this.calculateStats();
                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les rapports No-Go.' });
            }
        });
    }

    calculateStats(): void {
        const finalTotal = this.dossiers.length;
        if (finalTotal === 0) return;
        
        let sumHM = 0;
        let sumPwin = 0;
        
        this.dossiers.forEach(d => {
            sumHM += (d.hommesMois || 0);
            sumPwin += (d.pwinScore || 0);
        });
        
        const finalAvgPwin = Math.round(sumPwin / finalTotal);

        this.animateValue('totalNogo', finalTotal, 1000);
        this.animateValue('savedHommesMois', sumHM, 1300);
        this.animateValue('avgPwinNogo', finalAvgPwin, 1600);
    }

    animateValue(prop: 'totalNogo'|'savedHommesMois'|'avgPwinNogo', end: number, duration: number): void {
        let start = 0;
        const stepTime = Math.abs(Math.floor(duration / (end || 1)));
        const timer = setInterval(() => {
            start += 1;
            this[prop] = start;
            if (start >= end) {
                this[prop] = end;
                clearInterval(timer);
            }
        }, stepTime < 16 ? 16 : stepTime);
    }

    openDetails(dossier: Dossier): void {
        this.selectedDossier = dossier;
        this.displayDetailsDialog = true;
    }

    openDossier(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        this.selectedDossier = dossier;
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${dossier.id}/download/nogo`;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.displayPdfViewer = true;
    }

    exportPdf(): void {
        import('jspdf').then((jsPDF) => {
            import('jspdf-autotable').then((x) => {
                const doc = new jsPDF.default('l', 'pt', 'a4');
                const exportColumns = [
                    { title: 'Intitulé de l\'offre', dataKey: 'intituleOffre' },
                    { title: 'Client', dataKey: 'client' },
                    { title: 'Bailleur', dataKey: 'bailleurs' },
                    { title: 'Score P-Win', dataKey: 'pwinScore' }
                ];
                (doc as any).autoTable({
                    columns: exportColumns,
                    body: this.dossiers,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
                doc.save('Registre_Nogo_Reports.pdf');
            });
        });
    }

    downloadNogoReport(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${dossier.id}/download/nogo`;
        window.open(url, '_blank');
        
        this.messageService.add({
            severity: 'success',
            summary: 'Téléchargement',
            detail: 'Le téléchargement du rapport No-Go a démarré.'
        });
    }

    copyLink(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${dossier.id}/download/nogo`;
        navigator.clipboard.writeText(url).then(() => {
            this.messageService.add({ severity: 'info', summary: 'Lien copié', detail: 'Le lien de téléchargement a été copié dans le presse-papier.' });
        });
    }

    getPwinColor(score: number): string {
        if (!score) return 'text-600 bg-gray-100';
        if (score >= 70) return 'text-green-700 bg-green-100 border-green-200';
        if (score >= 50) return 'text-orange-700 bg-orange-100 border-orange-200';
        return 'text-red-700 bg-red-100 border-red-200';
    }
}
