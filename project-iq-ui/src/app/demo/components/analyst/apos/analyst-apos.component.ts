import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import { environment } from 'src/environments/environment';

@Component({
    templateUrl: './analyst-apos.component.html',
    providers: [MessageService],
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
                command: () => {
                    if (this.table) {
                        this.table.exportCSV();
                    }
                }
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
        this.router.navigate(['/analyst', report.id, 'pack']);
    }

    downloadWord(report: Dossier): void {
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${report.id}/download/apo`;
        window.open(url, '_blank');
        
        this.messageService.add({
            severity: 'success',
            summary: 'Téléchargement',
            detail: `Le téléchargement de l'APO a démarré.`
        });
    }

    exportPdf(): void {
        import('jspdf').then((jsPDF) => {
            import('jspdf-autotable').then((x) => {
                const doc = new jsPDF.default('l', 'pt', 'a4');
                const exportColumns = [
                    { title: 'Dossier', dataKey: 'intituleOffre' },
                    { title: 'Client', dataKey: 'client' },
                    { title: 'Statut', dataKey: 'status' }
                ];
                (doc as any).autoTable({
                    columns: exportColumns,
                    body: this.reports,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
                doc.save('Registre_APO_Final.pdf');
            });
        });
    }

    statusSeverity(status: string): 'success' | 'warning' | 'danger' | 'info' {
        if (status === 'GO' || status === 'COMPLETED' || status === 'PACK_READY' || status === 'SUBMITTED') return 'success';
        if (status === 'EVALUATING' || status === 'PENDING_VALIDATION') return 'info';
        if (status.includes('Conditionnel') || status === 'MATCHING' || status === 'DRAFTING') return 'warning';
        if (status === 'NO-GO' || status.includes('NO_GO')) return 'danger';
        return 'info';
    }
}
