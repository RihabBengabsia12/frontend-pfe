import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { NogoService, NoGoReport } from '../../../service/nogo.service';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-nogo-report-page',
    templateUrl: './nogo-report-page.component.html',
    providers: [MessageService]
})
export class NogoReportPageComponent implements OnInit {
    projectId: string = '';
    reportData!: NoGoReport;
    isLoading = true;
    showOverrideModal = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private nogoService: NogoService,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    get isManager(): boolean {
        const role = (localStorage.getItem('userRole') || '').toUpperCase();
        return role.includes('MANAGER') || role.includes('DIRECTOR') || role.includes('DO');
    }

    get isAnalyst(): boolean {
        const role = (localStorage.getItem('userRole') || '').toUpperCase();
        return role === 'ANALYST';
    }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'];
            this.loadReport();
            this.loadTemplate();
        });
    }

    loadTemplate(): void {
        this.projectsService.getTemplateDocx('Rapport-NoGo-Template1.docx').subscribe({
            next: (blob) => {
                const container = document.getElementById('docx-preview-nogo');
                if (container) {
                    import('docx-preview').then(docxPreview => {
                        docxPreview.renderAsync(blob, container, undefined, {
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
                            debug: false,
                        });
                    });
                }
            }
        });
    }

    loadReport(): void {
        this.isLoading = true;
        this.nogoService.getNoGoReport(this.projectId).subscribe({
            next: (data) => {
                this.reportData = data;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de charger le rapport No-Go.'
                });
            }
        });
    }

    // Action pour l'Analyste
    generateAndNotifyManager(): void {
        this.projectsService.notifyManager(this.projectId).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Rapport Généré & Notification Envoyée',
                    detail: 'Le manager a reçu une alerte instantanée pour prendre une décision.'
                });
                
                // On met à jour manuellement si besoin pour que les UI se synchronisent, mais la cloche fait du polling.
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de notifier le manager.'
                });
            }
        });
    }

    // Actions pour le Manager
    confirmNoGoClose(): void {
        this.nogoService.closeDossier(this.projectId).subscribe({
            next: (res) => {
                this.messageService.add({
                    severity: 'info',
                    summary: 'Dossier archivé',
                    detail: res.message || 'Le dossier a été clôturé.'
                });
                setTimeout(() => {
                    this.router.navigate(['/manager/dashboard']);
                }, 1500);
            }
        });
    }

    onOverrideClick(): void {
        this.showOverrideModal = true;
    }

    onOverrideSubmitted(event: { reason: string, justification: string }): void {
        this.isLoading = true;
        this.nogoService.forcePhase3(this.projectId, event.reason, event.justification).subscribe({
            next: (res) => {
                // Notifier l'analyste en retour
                localStorage.setItem('notificationCount', '1');
                localStorage.setItem('lastNotifDossierId', this.projectId);
                
                this.messageService.add({
                    severity: 'success',
                    summary: 'Passage en Phase 3 Forcé',
                    detail: 'L\'analyste a été notifié que ce dossier va continuer le process.'
                });
                setTimeout(() => {
                    this.router.navigate(['/manager/dashboard']);
                }, 1500);
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Le forçage en Phase 3 a échoué.'
                });
            }
        });
    }
}
