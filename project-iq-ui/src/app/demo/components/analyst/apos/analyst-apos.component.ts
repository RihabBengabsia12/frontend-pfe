import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    templateUrl: './analyst-apos.component.html',
    providers: [],
    styles: [`
        .fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(20px);
        }
        .delay-1 { animation-delay: 0.1s; }
        
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
        ::ng-deep .apos-table-compact .p-datatable-tbody > tr > td {
            font-size: 0.82rem;
        }
        ::ng-deep .apos-table-compact .p-datatable-tbody .text-lg {
            font-size: 0.92rem !important;
        }
        ::ng-deep .apos-table-compact .p-datatable-tbody .p-tag {
            font-size: 0.72rem;
            padding: 0.3rem 0.55rem !important;
        }
    `]
})
export class AnalystAposComponent implements OnInit {

    @ViewChild('dt') table!: Table;

    reports: Dossier[] = [];
    isLoading = false;
    
    totalApos = 0;
    searchQuery = '';
    
    exportMenuItems: any[] = [];

    constructor(
        private messageService: MessageService,
        private projectsService: AnalystProjectsService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.exportMenuItems = [
            {
                label: 'Exporter en CSV',
                icon: 'pi pi-file-excel',
                command: () => this.exportCsv()
            },
            {
                label: 'Exporter en PDF',
                icon: 'pi pi-file-pdf',
                command: () => {
                    this.exportPdf();
                }
            }
        ];
        this.loadReports();
    }
    
    loadReports(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                // On peut filtrer les dossiers qui ont un status "PACK_READY" ou qui ont une apoDocxPath
                // Pour l'instant, on filtre ceux dont l'étape est suffisamment avancée
                this.reports = data.filter(d => 
                    d.status === 'PACK_READY' || d.status === 'PENDING_VALIDATION' || d.status === 'SUBMITTED' || d.status === 'COMPLETED' || d.apoDocxPath
                );
                
                this.totalApos = this.reports.length;
                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les APOs.' });
            }
        });
    }

    openDossier(report: Dossier): void {
        this.router.navigate(['/dossiers', report.id, 'rapport-final']);
    }

    downloadWord(report: Dossier): void {
        this.projectsService.getDownloadBlob(report.id, 'apo').subscribe({
            next: (content) => {
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `APO_${report.id.substring(0, 8)}.docx`;
                link.click();
                URL.revokeObjectURL(url);
                this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le téléchargement de l’APO a démarré.' });
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Document indisponible', detail: err.error?.message || 'L’APO ne peut pas être téléchargée.' })
        });
    }

    exportPdf(): void {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text('Registre des APO ProjectIQ', 40, 38);
        autoTable(doc, {
            startY: 55,
            head: [['Dossier', 'Client', 'Bailleur', 'Statut', 'Date de création']],
            body: this.reports.map(report => [
                report.intituleOffre || '—', report.client || '—', report.bailleurs || '—', report.status || '—',
                report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : '—'
            ]),
            theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] }
        });
        doc.save('Registre_APO_Final.pdf');
    }

    exportCsv(): void {
        const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Dossier', 'Client', 'Bailleur', 'Statut', 'Date de création'],
            ...this.reports.map(report => [
                report.intituleOffre, report.client, report.bailleurs, report.status,
                report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : ''
            ])
        ];
        const blob = new Blob([`\uFEFF${rows.map(row => row.map(escape).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Registre_APO.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        if (status === 'GO' || status === 'COMPLETED' || status === 'PACK_READY' || status === 'SUBMITTED') return 'success';
        if (status === 'EVALUATING' || status === 'PENDING_VALIDATION') return 'info';
        if (status.includes('Conditionnel') || status === 'MATCHING' || status === 'DRAFTING') return 'warning';
        if (status === 'NO-GO' || status.includes('NO_GO')) return 'danger';
        return 'info';
    }
}
