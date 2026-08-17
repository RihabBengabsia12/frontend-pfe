import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
    templateUrl: './analyst-rapports.component.html',
    providers: [],
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
        ::ng-deep .reports-table-compact .p-datatable-tbody > tr > td {
            font-size: 0.82rem;
        }
        ::ng-deep .reports-table-compact .p-datatable-tbody .text-lg {
            font-size: 0.92rem !important;
        }
        ::ng-deep .reports-table-compact .p-datatable-tbody .p-tag {
            font-size: 0.72rem;
            padding: 0.3rem 0.55rem !important;
        }
    `]
})
export class AnalystRapportsComponent implements OnInit {

    reports: Dossier[] = [];
    isLoading = false;

    
    totalReports = 0;
    avgPwin = 0;
    goPercentage = 0;
    nogoPercentage = 0;
    searchQuery = '';
    exportMenuItems: any[] = [];


    constructor(
        private messageService: MessageService,
        private projectsService: AnalystProjectsService,
        private validationService: ManagerValidationService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.exportMenuItems = [
            { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
            { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
        ];
        this.loadReports();
    }
    
    loadReports(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                const reports = data.filter(d => d.rapportPath != null);
                forkJoin(reports.map(report => this.validationService.getValidationStatus(report.id).pipe(catchError(() => of([]))))).subscribe({
                    next: (allDecisions) => {
                        this.reports = reports.map((report, index) => ({ ...report, decisions: allDecisions[index] } as Dossier));
                        this.calculateStats();
                        this.isLoading = false;
                    },
                    error: () => {
                        this.reports = reports;
                        this.calculateStats();
                        this.isLoading = false;
                    }
                });
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
            const pwin = Number(r.pwinScore);
            sumPwin += Number.isFinite(pwin) ? pwin : 0;
            const decisions = ((r as any).decisions || []).filter((d: any) => !['CANCELLED', 'EXPIRED'].includes(d.status));
            const noGo = decisions.some((d: any) => ['REJECTED', 'APPROVE_NOGO'].includes(d.status));
            const go = decisions.length > 0 && decisions.every((d: any) => d.status === 'APPROVED');
            if (go) goCount++;
            if (noGo) nogoCount++;
        });
        
        const finalAvg = Math.round(sumPwin / finalTotal);
        const finalGo = Math.round((goCount / finalTotal) * 100);
        const finalNogo = Math.round((nogoCount / finalTotal) * 100);

        this.totalReports = finalTotal;
        this.avgPwin = finalAvg;
        this.goPercentage = finalGo;
        this.nogoPercentage = finalNogo;
    }

    openDossier(report: Dossier): void {
        this.router.navigate(['/dossiers', report.id, 'rapport-final']);
    }

    exportPdf(): void {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text('Registre des rapports ProjectIQ', 40, 38);
        autoTable(doc, {
            startY: 55,
            head: [['Intitulé de l’offre', 'Client', 'P-Win', 'Statut', 'Émission']],
            body: this.reports.map(report => [
                report.intituleOffre || '—', report.client || '—', `${report.pwinScore ?? 0}%`,
                report.status || '—', report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : '—'
            ]),
            theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [220, 38, 38] }
        });
        doc.save('Registre_Rapports_Final.pdf');
    }

    downloadPDF(report: Dossier): void {
        if (!report.rapportPath) return;
        
        this.projectsService.getDownloadBlob(report.id, 'rapport').subscribe({
            next: (content) => {
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Rapport_General_${report.id.substring(0, 8)}.docx`;
                link.click();
                URL.revokeObjectURL(url);
                this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le téléchargement du rapport DOCX a démarré.' });
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Document indisponible', detail: err.error?.message || 'Le rapport ne peut pas être téléchargé.' })
        });
    }

    exportCsv(): void {
        const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Intitulé de l’offre', 'Client', 'Bailleur', 'Score P-Win', 'Statut', 'Émission'],
            ...this.reports.map(report => [
                report.intituleOffre, report.client, report.bailleurs, report.pwinScore ?? 0,
                report.status, report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : ''
            ])
        ];
        const blob = new Blob([`\uFEFF${rows.map(row => row.map(escape).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Registre_Rapports.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        if (status === 'GO' || status === 'COMPLETED') return 'success';
        if (status === 'EVALUATING') return 'info';
        if (status.includes('Conditionnel')) return 'warning';
        if (status === 'NO-GO' || status.includes('NO_GO')) return 'danger';
        return 'info';
    }

    displayStatus(report: Dossier): string {
        const decisions = ((report as any).decisions || []).filter((d: any) => !['CANCELLED', 'EXPIRED'].includes(d.status));
        if (decisions.some((d: any) => ['REJECTED', 'APPROVE_NOGO'].includes(d.status))) return 'NO-GO confirmé';
        if (decisions.length > 0 && decisions.every((d: any) => d.status === 'APPROVED')) return 'GO approuvé';
        const labels: Record<string, string> = {
            DRAFTING: 'Documents en préparation',
            REPORT_GENERATED: 'Rapport généré',
            PACK_READY: 'Pack prêt à envoyer',
            PENDING_VALIDATION: 'En attente des décisions',
            SUBMITTED: 'GO approuvé — audit à générer',
            AUDIT: 'Rapport d’audit en cours',
            ARCHIVED: 'Archivé'
        };
        return labels[report.status] || report.status || 'Non défini';
    }

    displayStatusSeverity(report: Dossier): 'success' | 'warning' | 'danger' | 'info' {
        const label = this.displayStatus(report);
        if (label.startsWith('GO') || label === 'Archivé') return 'success';
        if (label.startsWith('NO-GO')) return 'danger';
        if (label.includes('attente') || label.includes('audit')) return 'warning';
        return 'info';
    }
}
