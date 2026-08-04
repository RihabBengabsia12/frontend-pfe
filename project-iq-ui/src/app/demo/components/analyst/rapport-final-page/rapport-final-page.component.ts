import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';
import { ScoringService } from '../../../service/scoring.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PromptOverrideComponent } from '../shared/prompt-override/prompt-override.component';

@Component({
    selector: 'app-rapport-final-page',
    templateUrl: './rapport-final-page.component.html',
    styleUrls: ['./rapport-final-page.component.scss'],
    providers: [MessageService]
})
export class RapportFinalPageComponent implements OnInit {
    @ViewChild('promptDrawer') promptDrawer!: PromptOverrideComponent;

    dossierId: string = '';
    isLoading = false;
    today = new Date();
    isGenerating = false;
    displayModal = false;
    showTemplatePreview = false;
    templateBlob: Blob | null = null;
    
    progressValue = 0;
    loadingStep = 0;
    loadingMessages = [
        "Consolidation des données IA...",
        "Formatage du document officiel...",
        "Sauvegarde et génération du lien sécurisé..."
    ];

    // Data for visualization
    apoData: any = {};
    scoringData: any = {};
    matchingData: any = {};

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private scoringService: ScoringService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.dossierId = params['id'];
            this.loadDossierData();
            this.loadActualTemplate();
        });
    }

    loadActualTemplate(): void {
        this.projectsService.getTemplateDocx('Rapport-General-Template1.docx').subscribe({
            next: (blob) => {
                this.templateBlob = blob;
                console.log('Template loaded from backend, size:', blob.size);
            },
            error: (err) => {
                console.error('Failed to load actual template from backend. Attempting local fallback...', err);
                
                // Fallback local file check
                fetch('assets/Rapport-General-Template1.docx')
                    .then(res => res.ok ? res.blob() : Promise.reject('Local file not found'))
                    .then(blob => {
                        this.templateBlob = blob;
                        console.log('Fallback template loaded, size:', blob.size);
                    })
                    .catch(e => console.error('No template found anywhere:', e));
            }
        });
    }

    onTemplateModalShow(): void {
        if (!this.templateBlob) {
            console.error('templateBlob is null or not loaded yet');
            return;
        }
        
        // Timeout to ensure the modal DOM is fully rendered and animated
        setTimeout(() => {
            const container = document.getElementById('docx-preview-container');
            if (container) {
                container.innerHTML = ''; // Clear previous renders if any
                import('docx-preview').then(docxPreview => {
                    docxPreview.renderAsync(this.templateBlob!, container, undefined, {
                        className: 'docx',
                        inWrapper: false,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        ignoreLastRenderedPageBreak: true,
                        experimental: false,
                        trimXmlDeclaration: true,
                        useBase64URL: false,
                        debug: true, // Enable debug for docx-preview
                    }).then(() => console.log('DOCX template rendered successfully in modal.'))
                      .catch((err) => console.error('DOCX render error:', err));
                });
            } else {
                console.error('docx-preview-container not found in DOM');
            }
        }, 300);
    }

    loadDossierData(): void {
        this.isLoading = true;
        forkJoin({
            apo: this.projectsService.extractApoForm(this.dossierId).pipe(catchError(() => of({}))),
            scoring: this.scoringService.getResult(this.dossierId).pipe(catchError(() => of({}))),
            matching: this.projectsService.getMatchingResult(this.dossierId).pipe(catchError(() => of({})))
        }).subscribe({
            next: (data) => {
                this.apoData = data.apo || {};
                this.scoringData = data.scoring || {};
                this.matchingData = data.matching || {};
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
            }
        });
    }

    generateRapport(): void {
        this.displayModal = true;
        this.isGenerating = true;
        this.progressValue = 0;
        this.loadingStep = 0;

        // Animation sequence
        const interval = setInterval(() => {
            this.progressValue += Math.floor(Math.random() * 15) + 5;
            
            if (this.progressValue >= 33 && this.loadingStep === 0) {
                this.loadingStep = 1;
            } else if (this.progressValue >= 66 && this.loadingStep === 1) {
                this.loadingStep = 2;
            }

            if (this.progressValue >= 100) {
                this.progressValue = 100;
                clearInterval(interval);
                this.finalizeGeneration();
            }
        }, 300);
    }

    generatedReportPath: string | null = null;

    private finalizeGeneration(): void {
        this.projectsService.exportRapportFinal(this.dossierId).subscribe({
            next: (path) => {
                this.displayModal = false;
                this.isGenerating = false;
                this.generatedReportPath = path;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Rapport Généré',
                    detail: 'Le rapport a été assemblé avec succès.'
                });
                setTimeout(() => {
                    document.getElementById('generated-report-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            },
            error: () => {
                this.displayModal = false;
                this.isGenerating = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'La génération a échoué. Vérifiez le backend.'
                });
            }
        });
    }

    downloadReport(): void {
        if (this.generatedReportPath) {
            // En mode test, ça fera une 404 sur le /download si MinIO n'a pas le fichier
            // mais l'URL sera correcte : /api/export/download?path=...
            const url = `/api/export/download?path=${encodeURIComponent(this.generatedReportPath)}`;
            window.open(url, '_blank');
        }
    }

    continueToApo(): void {
        this.projectsService.updateStatus(this.dossierId, 'PENDING_VALIDATION').subscribe({
            next: () => this.router.navigate(['/dossiers', this.dossierId, 'apo-editor']),
            error: () => this.router.navigate(['/dossiers', this.dossierId, 'apo-editor'])
        });
    }

    continueToPack(): void {
        // En mode test, on simule que le statut est mis à jour et on navigue vers pack
        this.router.navigate(['/dossiers', this.dossierId, 'pack']);
    }
}
