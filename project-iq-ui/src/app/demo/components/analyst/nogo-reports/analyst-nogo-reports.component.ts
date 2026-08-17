import { Component, OnInit, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import { DossierStatusService } from '../../../service/dossier-status.service';
import { environment } from 'src/environments/environment';
import * as docx from 'docx-preview';

@Component({
    templateUrl: './analyst-nogo-reports.component.html',
    providers: [],
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
        ::ng-deep .nogo-table-compact .p-datatable-tbody > tr > td {
            font-size: 0.82rem;
        }
        ::ng-deep .nogo-table-compact .p-datatable-tbody .text-lg {
            font-size: 0.92rem !important;
        }
        ::ng-deep .nogo-table-compact .p-datatable-tbody .p-tag {
            font-size: 0.72rem;
            padding: 0.3rem 0.55rem !important;
        }
    `]
})
export class AnalystNogoReportsComponent implements OnInit {
    
    dossiers: Dossier[] = []; // always initialise to empty array
    isLoading = false;

    displayDetailsDialog = false;
    selectedDossier: Dossier | null = null;

    cols: any[] = []; // Used for CSV export

    totalNogo = 0;
    savedHommesMois = 0;
    avgPwinNogo: number | null = null;
    searchQuery = '';
    exportMenuItems: any[] = [];

    displayPdfViewer = false;
    pdfUrl: SafeResourceUrl | null = null;

    constructor(
        private messageService: MessageService,
        private projectsService: AnalystProjectsService,
        private router: Router,
        private statusService: DossierStatusService,
        private sanitizer: DomSanitizer
    ) {}

    // Reference to the PrimeNG table for CSV export
    @ViewChild('dt') dt: Table;


    ngOnInit(): void {
        this.exportMenuItems = [
            { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
            { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
        ];
        this.cols = [
            { field: 'intituleOffre', header: 'Dossier & Client' },
            { field: 'client', header: 'Client' },
            { field: 'bailleurs', header: 'Bailleur' },
            { field: 'pwinScore', header: 'Score P-Win' },
            { field: 'createdAt', header: 'Date de Génération' }
        ];
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
        let pwinCount = 0;
        
        this.dossiers.forEach(d => {
            const hommesMois = Number(d.hommesMois);
            if (Number.isFinite(hommesMois) && hommesMois > 0 && hommesMois <= 10000) sumHM += hommesMois;
            const pwin = Number(d.pwinScore);
            if (Number.isFinite(pwin) && pwin > 0 && pwin <= 100) {
                sumPwin += pwin;
                pwinCount++;
            }
        });
        
        this.totalNogo = finalTotal;
        this.savedHommesMois = sumHM;
        this.avgPwinNogo = pwinCount > 0 ? Math.round(sumPwin / pwinCount) : null;
    }

    isLoadingDocx = false;

    openDetails(dossier: Dossier): void {
        this.selectedDossier = dossier;
        this.displayDetailsDialog = true;
        this.isLoadingDocx = true;
        
        // Nettoyer le conteneur précédent s'il existe
        setTimeout(() => {
            const container = document.getElementById('docx-container');
            if (container) container.innerHTML = '';
            
            this.projectsService.getDownloadBlob(dossier.id, 'nogo').subscribe({
                next: (blob) => {
                    if (container) {
                        docx.renderAsync(blob, container, null, {
                            className: 'docx',
                            inWrapper: false,
                            ignoreWidth: true,
                            ignoreHeight: true,
                            ignoreFonts: false,
                            breakPages: true,
                            ignoreLastRenderedPageBreak: true,
                            experimental: true,
                            trimXmlDeclaration: true,
                            useBase64URL: true,
                            debug: false
                        }).then(() => {
                            this.isLoadingDocx = false;
                        }).catch(err => {
                            console.error(err);
                            this.isLoadingDocx = false;
                            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de l\'affichage du document.' });
                        });
                    }
                },
                error: (err) => {
                    console.error(err);
                    this.isLoadingDocx = false;
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de télécharger le rapport No-Go.' });
                }
            });
        }, 100);
    }

    openDossier(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        this.selectedDossier = dossier;
        const url = `${environment.apiUrl || 'http://localhost:8083'}/api/dossiers/${dossier.id}/download/nogo`;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.displayPdfViewer = true;
    }

    exportPdf(): void {
        import('jspdf').then((jsPDFModule) => {
            const jsPDF = jsPDFModule.default;
            import('jspdf-autotable').then((autoTableModule) => {
                const doc = new jsPDF('l', 'pt', 'a4');
                const exportColumns = [
                    { title: "Intitulé de l'offre", dataKey: 'intituleOffre' },
                    { title: 'Client', dataKey: 'client' },
                    { title: 'Bailleur', dataKey: 'bailleurs' },
                    { title: 'Score P-Win', dataKey: 'pwinScore' }
                ];
                const head = exportColumns.map(col => col.title);
                const rows = this.dossiers.map(d => exportColumns.map(col => d[col.dataKey] ?? ''));
                
                // Extract autoTable function
                const autoTable = (autoTableModule && (autoTableModule as any).default) ? (autoTableModule as any).default : autoTableModule;
                
                if (typeof autoTable === 'function') {
                    autoTable(doc, {
                        head: [head],
                        body: rows,
                        theme: 'grid',
                        styles: { fontSize: 8 },
                        headStyles: { fillColor: [41, 128, 185] }
                    });
                } else if (typeof (doc as any).autoTable === 'function') {
                    (doc as any).autoTable({
                        head: [head],
                        body: rows,
                        theme: 'grid',
                        styles: { fontSize: 8 },
                        headStyles: { fillColor: [41, 128, 185] }
                    });
                } else {
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'autoTable function not available.' });
                    return;
                }
                
                doc.save('Registre_Nogo_Reports.pdf');
            }).catch(err => {
                console.error('Failed to load jspdf-autotable', err);
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de générer le PDF.' });
            });
        }).catch(err => {
            console.error('Failed to load jsPDF', err);
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger la bibliothèque PDF.' });
        });
    }

    /** Wrapper for CSV export using PrimeNG table reference */
    exportCsv(): void {
        if (this.dt && this.dossiers && this.dossiers.length > 0) {
            this.dt.exportCSV();
        } else if (!this.dt) {
            this.messageService.add({ severity: 'warn', summary: 'Avertissement', detail: 'La table n\'est pas initialisée.' });
        } else {
            this.messageService.add({ severity: 'info', summary: 'Information', detail: 'Aucune donnée disponible à exporter.' });
        }
    }

    downloadNogoReport(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        
        this.messageService.add({
            severity: 'info',
            summary: 'Téléchargement',
            detail: 'Préparation du document...'
        });

        this.projectsService.getDownloadBlob(dossier.id, 'nogo').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `NOGO_${dossier.intituleOffre ? dossier.intituleOffre.substring(0,30) : dossier.id}.docx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.messageService.add({
                    severity: 'success',
                    summary: 'Succès',
                    detail: 'Le rapport No-Go a été téléchargé.'
                });
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de télécharger le document.'
                });
            }
        });
    }

    copyLink(dossier: Dossier): void {
        if (!dossier.nogoReportPath) return;
        const url = `${window.location.origin}/api/dossiers/${dossier.id}/download/nogo`;
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
