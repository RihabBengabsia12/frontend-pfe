import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import { DossierStatusService } from '../../../service/dossier-status.service';
import { environment } from 'src/environments/environment';

@Component({
    templateUrl: './analyst-rapports.component.html',
    providers: [MessageService],
    styles: [`
        .fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(20px);
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        
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
export class AnalystRapportsComponent implements OnInit {

    reports: Dossier[] = [];
    isLoading = false;

    displayDetailsDialog = false;
    selectedReport: Dossier | null = null;
    
    totalReports = 0;
    avgPwin = 0;
    goPercentage = 0;
    nogoPercentage = 0;
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
        this.loadReports();
    }
    
    loadReports(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                this.reports = data.filter(d => d.rapportPath != null);
                this.calculateStats();
                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les rapports.' });
            }
        });
    }

    calculateStats(): void {
        const finalTotal = this.reports.length;
        if (finalTotal === 0) return;
        
        let sumPwin = 0;
        let goCount = 0;
        let nogoCount = 0;
        
        this.reports.forEach(r => {
            sumPwin += (r.pwinScore || 0);
            if (r.status === 'GO' || r.status === 'COMPLETED' || (r.status && r.status.includes('GO')) && r.status !== 'NO-GO' && !r.status.includes('NO_GO')) {
                goCount++;
            }
            if (r.status === 'NO-GO' || (r.status && r.status.includes('NO_GO'))) {
                nogoCount++;
            }
        });
        
        const finalAvg = Math.round(sumPwin / finalTotal);
        const finalGo = Math.round((goCount / finalTotal) * 100);
        const finalNogo = Math.round((nogoCount / finalTotal) * 100);

        this.animateValue('totalReports', finalTotal, 1000);
        this.animateValue('avgPwin', finalAvg, 1200);
        this.animateValue('goPercentage', finalGo, 1400);
        this.animateValue('nogoPercentage', finalNogo, 1600);
    }

    animateValue(prop: 'totalReports'|'avgPwin'|'goPercentage'|'nogoPercentage', end: number, duration: number): void {
        let start = 0;
        const stepTime = Math.abs(Math.floor(duration / (end || 1)));
        const timer = setInterval(() => {
            start += 1;
            this[prop] = start;
            if (start >= end) {
                this[prop] = end;
                clearInterval(timer);
            }
        }, stepTime < 16 ? 16 : stepTime); // minimum 16ms per frame
    }

    openDetails(report: Dossier): void {
        this.selectedReport = report;
        this.displayDetailsDialog = true;
    }

    openDossier(report: Dossier): void {
        if (!report.rapportPath) return;
        this.selectedReport = report;
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${report.id}/download/rapport`;
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
                    { title: 'Score P-Win', dataKey: 'pwinScore' },
                    { title: 'Décision', dataKey: 'status' }
                ];
                (doc as any).autoTable({
                    columns: exportColumns,
                    body: this.reports,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
                doc.save('Registre_Rapports_Final.pdf');
            });
        });
    }

    downloadPDF(report: Dossier): void {
        if (!report.rapportPath) return;
        
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${report.id}/download/rapport`;
        window.open(url, '_blank');
        
        this.messageService.add({
            severity: 'success',
            summary: 'Téléchargement',
            detail: `Le téléchargement du rapport a démarré.`
        });
    }

    copyLink(report: Dossier): void {
        if (!report.rapportPath) return;
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${report.id}/download/rapport`;
        navigator.clipboard.writeText(url).then(() => {
            this.messageService.add({ severity: 'info', summary: 'Lien copié', detail: 'Le lien de téléchargement a été copié dans le presse-papier.' });
        });
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        if (status === 'GO' || status === 'COMPLETED') return 'success';
        if (status === 'EVALUATING') return 'info';
        if (status.includes('Conditionnel')) return 'warning';
        if (status === 'NO-GO' || status.includes('NO_GO')) return 'danger';
        return 'info';
    }
}
