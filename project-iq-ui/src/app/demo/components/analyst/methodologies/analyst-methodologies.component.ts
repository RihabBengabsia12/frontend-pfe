import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    templateUrl: './analyst-methodologies.component.html',
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
        ::ng-deep .methodologies-table-compact .p-datatable-tbody > tr > td {
            font-size: 0.82rem;
        }
        ::ng-deep .methodologies-table-compact .p-datatable-tbody .text-lg {
            font-size: 0.92rem !important;
        }
        ::ng-deep .methodologies-table-compact .p-datatable-tbody .p-tag {
            font-size: 0.72rem;
            padding: 0.3rem 0.55rem !important;
        }
    `]
})
export class AnalystMethodologiesComponent implements OnInit {
    
    dossiers: Dossier[] = [];
    isLoading = false;

    totalMethodologies = 0;
    totalHommesMois = 0;
    visitePercentage = 0;
    searchQuery = '';
    exportMenuItems: any[] = [];

    constructor(
        private messageService: MessageService,
        private projectsService: AnalystProjectsService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.exportMenuItems = [
            { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
            { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
        ];
        this.loadMethodologies();
    }
    
    loadMethodologies(): void {
        this.isLoading = true;
        this.projectsService.getAllDossiers().subscribe({
            next: (data) => {
                const validStatuses = ['DRAFTING', 'REPORT_GENERATED', 'PACK_READY', 'SUBMITTED', 'ARCHIVED'];
                this.dossiers = data.filter(d => 
                    !!d.methodoDocxPath && 
                    d.methodoDocxPath.trim() !== '' && 
                    d.methodoDocxPath !== 'null' && 
                    d.methodoDocxPath !== 'undefined' &&
                    validStatuses.includes(d.status)
                );
                this.calculateStats();
                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les méthodologies.' });
            }
        });
    }

    calculateStats(): void {
        const finalTotal = this.dossiers.length;
        if (finalTotal === 0) return;
        
        let sumHM = 0;
        let visiteCount = 0;
        
        this.dossiers.forEach(d => {
            // Certaines réponses API sérialisent hommesMois en chaîne ; sans
            // conversion, JavaScript concatène (ex. 220 + 54 => 22054).
            const hommesMois = this.validHommesMois(d);
            sumHM += hommesMois ?? 0;
            if (d.visiteObl === true) {
                visiteCount++;
            }
        });
        
        const finalVisite = Math.round((visiteCount / finalTotal) * 100);

        // Valeurs réelles, non animées : une animation par incréments pouvait
        // laisser plusieurs timers actifs et afficher une somme erronée.
        this.totalMethodologies = finalTotal;
        this.totalHommesMois = sumHM;
        this.visitePercentage = finalVisite;
    }

    openDossier(dossier: Dossier): void {
        this.router.navigate(['/dossiers', dossier.id, 'rapport-final']);
    }

    validHommesMois(dossier: Dossier): number | null {
        const value = Number(dossier.hommesMois);
        return Number.isFinite(value) && value > 0 && value <= 10000 ? value : null;
    }

    formatHommesMois(dossier: Dossier): string {
        const value = this.validHommesMois(dossier);
        return value === null ? 'À corriger' : `${value} H/M`;
    }

    exportPdf(): void {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text('Registre des méthodologies ProjectIQ', 40, 38);
        autoTable(doc, {
            startY: 55,
            head: [['Intitulé de l’offre', 'Client', 'Bailleur', 'Effort (H/M)', 'Généré le']],
            body: this.dossiers.map(dossier => [
                dossier.intituleOffre || '—', dossier.client || '—', dossier.bailleurs || '—',
                this.formatHommesMois(dossier),
                dossier.createdAt ? new Date(dossier.createdAt).toLocaleDateString('fr-FR') : '—'
            ]),
            theme: 'grid', styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] }
        });
        doc.save('Registre_Methodologies.pdf');
    }

    exportCsv(): void {
        const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Intitulé de l’offre', 'Client', 'Bailleur', 'Effort (H/M)', 'Visite obligatoire', 'Conférence obligatoire', 'Généré le'],
            ...this.dossiers.map(dossier => [
                dossier.intituleOffre, dossier.client, dossier.bailleurs, this.formatHommesMois(dossier),
                dossier.visiteObl ? 'Oui' : 'Non', dossier.confObl ? 'Oui' : 'Non',
                dossier.createdAt ? new Date(dossier.createdAt).toLocaleDateString('fr-FR') : ''
            ])
        ];
        const blob = new Blob([`\uFEFF${rows.map(row => row.map(escape).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Registre_Methodologies.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    downloadMethodology(dossier: Dossier): void {
        if (!dossier.methodoDocxPath) return;
        this.projectsService.getDownloadBlob(dossier.id, 'methodo').subscribe({
            next: (content) => {
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Methodologie_${dossier.id.substring(0, 8)}.docx`;
                link.click();
                URL.revokeObjectURL(url);
                this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le téléchargement de la méthodologie a démarré.' });
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Document indisponible', detail: err.error?.message || 'La méthodologie ne peut pas être téléchargée.' })
        });
    }
}
