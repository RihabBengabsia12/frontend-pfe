import { Component, OnInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';

@Component({
    selector: 'app-audit-page',
    templateUrl: './audit-page.component.html',
    styleUrls: ['./audit-page.component.scss']
})
export class AuditPageComponent implements OnInit, OnDestroy {
    dossierId: string = '';
    dossier: Dossier | null = null;
    isLoading = true;
    isGenerating = false;
    
    showReportDialog = false;
    isReportLoading = false;
    reportLoadError = false;
    
    private pollSub?: Subscription;
    private _lastReportBlob?: Blob;

    @ViewChild('docxContainerAudit', { static: false }) docxContainerAudit!: ElementRef;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService,
        private http: HttpClient
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.dossierId = params['id'];
            if (this.dossierId) {
                this.loadDossier();
            }
        });
    }

    ngOnDestroy(): void {
        if (this.pollSub) {
            this.pollSub.unsubscribe();
        }
    }

    loadDossier(): void {
        this.isLoading = true;
        this.projectsService.getDossier(this.dossierId).subscribe({
            next: (d) => {
                this.dossier = d;
                this.isLoading = false;
                
                // Si on arrive sur la page et que le dossier est déjà généré
                if (this.dossier.status === 'ARCHIVED' || this.dossier.auditReportPath) {
                    this.isGenerating = false;
                }
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger le dossier.' });
            }
        });
    }

    generateAuditReport(): void {
        this.isGenerating = true;
        this.projectsService.generateAuditReport(this.dossierId).subscribe({
            next: () => {
                this.messageService.add({ severity: 'info', summary: 'Génération en cours', detail: 'Le rapport d\'audit est en cours de création...' });
                this.startPolling();
            },
            error: () => {
                this.isGenerating = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec du lancement de la génération.' });
            }
        });
    }

    private startPolling(): void {
        if (this.pollSub) {
            this.pollSub.unsubscribe();
        }
        
        // Poller toutes les 3 secondes pour vérifier si l'audit est prêt
        this.pollSub = interval(3000).subscribe(() => {
            this.projectsService.getDossier(this.dossierId).subscribe(d => {
                this.dossier = d;
                if (d.status === 'ARCHIVED' || d.auditReportPath) {
                    this.isGenerating = false;
                    if (this.pollSub) {
                        this.pollSub.unsubscribe();
                    }
                    this.messageService.add({ severity: 'success', summary: 'Clôturé', detail: 'Rapport d\'audit généré et dossier archivé avec succès !' });
                }
            });
        });
    }

    showPreview(): void {
        this.showReportDialog = true;
        this.isReportLoading = true;
        this.reportLoadError = false;
        
        this.http.get(`/api/dossiers/${this.dossierId}/download/audit/blob`, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                this._lastReportBlob = blob;
                this.isReportLoading = false;
                
                setTimeout(() => {
                    if (this.docxContainerAudit) {
                        import('docx-preview').then(dp => dp.renderAsync(blob, this.docxContainerAudit.nativeElement));
                    }
                }, 300);
            },
            error: () => {
                this.isReportLoading = false;
                this.reportLoadError = true;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger l\'aperçu du rapport.' });
            }
        });
    }

    downloadReport(): void {
        if (this._lastReportBlob) {
            this.triggerDownload(this._lastReportBlob);
        } else {
            // Si l'utilisateur clique sans avoir prévisualisé
            this.http.get(`/api/dossiers/${this.dossierId}/download/audit/blob`, { responseType: 'blob' }).subscribe({
                next: (blob) => {
                    this.triggerDownload(blob);
                }
            });
        }
    }
    
    private triggerDownload(blob: Blob): void {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rapport_Audit_${this.dossier?.intituleOffre?.substring(0, 15) || 'ProjectIQ'}.docx`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    printReport(): void {
        window.print();
    }
    
    goBack(): void {
        this.router.navigate(['/dossiers']);
    }
}
