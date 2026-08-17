import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { ScoringService, PwinScore, ScoringResult } from '../../../service/scoring.service';
import { NotificationStateService } from '../../../service/notification-state.service';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-scoring-page',
    templateUrl: './scoring-page.component.html',
    styleUrls: ['./scoring-page.component.scss'],
    providers: []
})
export class ScoringPageComponent implements OnInit {
    projectId: string = '';
    dossierStatus: string = '';
    scoringData!: ScoringResult;
    isLoading = true;
    showOverruleModal = false;
    today = new Date();

    showReportModal = false;
    isGenerating = false;
    hasExistingReport = false;
    generatedReport: any = null;
    parsedMotifs: any[] = [];
    dossierName: string = '';

    previewState: 'idle' | 'loading' | 'success' | 'error' = 'idle';
    previewMessage: string = '';
    isRecalculating = false;
    isFinalLocked = false;
    
    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private scoringService: ScoringService,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService,
        private notificationService: NotificationStateService,
        private http: HttpClient
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.projectId = params['id'] || 'TEST-PROJECT-001';
            
            // Garde : vérifier que P1 est validé (statut >= INDEXED) avant d'accéder au scoring
            this.projectsService.getDossier(this.projectId).subscribe({
                next: (dossier) => {
                    this.dossierStatus = dossier.status;
                    this.isFinalLocked = ['SUBMITTED', 'AUDIT', 'ARCHIVED'].includes(dossier.status);
                    const statusesRequiringP1 = ['UPLOADED', 'PARSING_INITIAL', 'CORRECTION_LOOP'];
                    if (statusesRequiringP1.includes(dossier.status)) {
                        this.messageService.add({
                            severity: 'warn',
                            summary: 'Phase 1 requise',
                            detail: 'Validez d\'abord la Phase 1 avant d\'accéder au Scoring.'
                        });
                        this.router.navigate(['/dossiers', this.projectId, 'validation-p1']);
                        return;
                    }
                    // Construire le nom du dossier
                    if (dossier) {
                        const clientStr = dossier.client ? dossier.client.replace(/[^a-zA-Z0-9\u00C0-\u00FF_\-]/g, '_') : '';
                        let offreStr = '';
                        if (dossier.intituleOffre) {
                            offreStr = dossier.intituleOffre.replace(/[^a-zA-Z0-9\u00C0-\u00FF_\-]/g, '_');
                            if (offreStr.length > 30) offreStr = offreStr.substring(0, 30);
                        }
                        if (clientStr && offreStr) this.dossierName = `${clientStr}_${offreStr}`;
                        else if (clientStr) this.dossierName = clientStr;
                        else if (offreStr) this.dossierName = offreStr;
                    }
                    this.loadScoring();
                },
                error: () => this.loadScoring()
            });
        });
    }

    loadScoring(): void {
        this.isLoading = true;
        this.scoringService.getResult(this.projectId).subscribe({
            next: (pwin: PwinScore) => {
                // Transform model backend -> model UI
                this.scoringData = this.scoringService.toScoringResult(pwin);
                this.isLoading = false;
                
                // Si la dÃƒÂ©cision est NO-GO ou MANUAL, vÃƒÂ©rifier s'il existe dÃƒÂ©jÃƒÂ  un rapport
                if (this.scoringData.decision === 'NO-GO' || this.scoringData.decision === 'MANUAL') {
                    this.scoringService.getExistingNoGoReport(this.projectId).subscribe({
                        next: (report) => {
                            this.generatedReport = report;
                            this.hasExistingReport = true;
                            this.parseMotifs();
                        },
                        error: () => {
                            this.hasExistingReport = false;
                        }
                    });
                }
            },

            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de calculer le score P-Win.'
                });
            }
        });
    }

    recalculatePwin(): void {
        if (this.isFinalLocked) return;
        this.isRecalculating = true;
        this.http.post<PwinScore>(`/api/scoring/${this.projectId}/calculate`, {}).subscribe({
            next: (pwin) => {
                this.scoringData = this.scoringService.toScoringResult(pwin);
                this.isRecalculating = false;
                this.messageService.add({ severity: 'success', summary: 'Recalcul terminé', detail: `Nouveau P-Win : ${Math.round(pwin.scoreGlobal)}%` });
            },
            error: () => {
                this.isRecalculating = false;
                this.loadScoring();
                this.messageService.add({ severity: 'warn', summary: 'Recalcul', detail: 'Score rechargé depuis le dernier calcul.' });
            }
        });
    }

    getDecisionCardClass(): string {

        if (!this.scoringData) return '';
        if (this.scoringData.pwinScore >= this.scoringData.goThreshold) {
            return 'card-pastel-green text-green-900 border-green-300';
        }
        if (this.scoringData.pwinScore >= this.scoringData.nogoThreshold) {
            return 'card-pastel-amber text-amber-900 border-amber-300';
        }
        return 'card-pastel-danger text-red-900 border-red-300';
    }

    getDecisionBadgeClass(): string {
        if (!this.scoringData) return '';
        if (this.scoringData.pwinScore >= this.scoringData.goThreshold) {
            return 'bg-green-100 text-green-700';
        }
        if (this.scoringData.pwinScore >= this.scoringData.nogoThreshold) {
            return 'bg-orange-100 text-orange-700';
        }
        return 'bg-red-100 text-red-700';
    }

    formatTechnicalTerm(text: any): string {
        if (!text) return '';
        
        let strText = '';
        if (typeof text === 'string') {
            strText = text;
        } else if (typeof text === 'object') {
            strText = text.motif || text.label || text.name || text.title || JSON.stringify(text);
        } else {
            strText = String(text);
        }
        
        const dict: { [key: string]: string } = {
            'TAILLE_DISPERSION': 'Taille et dispersion du pÃƒÂ©rimÃƒÂ¨tre technique',
            'PAYS_SECURITE': 'Niveau de risque liÃƒÂ© au pays et ÃƒÂ  la sÃƒÂ©curitÃƒÂ©',
            'MODE_FINANCEMENT': 'Mode de financement du projet',
            'PENALITES': 'Niveau et plafond des pÃƒÂ©nalitÃƒÂ©s',
            'MARGE_NETTE': 'Marge nette estimÃƒÂ©e du projet',
            'TJM_MOYEN': 'Taux Journalier Moyen (TJM)'
        };
        
        // Remplace [[CLE]] par sa valeur lisible, ou retire les crochets si inconnu
        let formatted = strText.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            return dict[p1] || p1.replace(/_/g, ' ');
        });

        // Remplace aussi directement les clÃƒÂ©s si elles sont isolÃƒÂ©es (ex: TAILLE_DISPERSION)
        Object.keys(dict).forEach(key => {
            formatted = formatted.replace(new RegExp(key, 'g'), dict[key]);
        });
        
        return formatted;
    }

    formatNarrative(text: any): string {
        if (!text) return '';
        let strText = typeof text === 'string' ? text : String(text);
        // Convertit le markdown **texte** en HTML <strong>texte</strong>
        return strText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    get isAlreadyAnalyzed(): boolean {
        const advanced = ['MATCHING', 'DRAFTING', 'REPORT_GENERATED', 'PACK_READY', 'SUBMITTED', 'AUDIT', 'ARCHIVED'];
        return advanced.includes(this.dossierStatus);
    }

    onConfirmGo(): void {
        this.projectsService.updateStatus(this.projectId, 'MATCHING').subscribe({
            next: () => this.router.navigate(['/dossiers', this.projectId, 'matching']),
            error: () => this.router.navigate(['/dossiers', this.projectId, 'matching'])
        });
    }

    onOverruleConfirmed(event: any): void {
        this.showOverruleModal = false;
        // On success, navigate to matching step (or wherever is appropriate for a GO)
        this.router.navigate(['/dossiers', this.projectId, 'matching']);
    }

    parseMotifs(): void {
        try {
            if (this.generatedReport && typeof this.generatedReport.motifsPrincipaux === 'string') {
                this.parsedMotifs = JSON.parse(this.generatedReport.motifsPrincipaux);
            }
        } catch (e) {
            console.error('Failed to parse motifs', e);
            this.parsedMotifs = [];
        }
    }

    viewReport(): void {
        this.showReportModal = true;
    }

    loadPreview(retryCount = 0): void {
        this.previewState = 'loading';
        this.previewMessage = 'Initialisation de l\'aperÃƒÂ§u...';
        
        const container = document.getElementById('docx-preview-modal');
        if (!container) {
            if (retryCount < 10) {
                setTimeout(() => this.loadPreview(retryCount + 1), 100);
            } else {
                this.previewState = 'error';
                this.previewMessage = 'Impossible de trouver le conteneur d\'affichage.';
            }
            return;
        }

        // Vider le conteneur avant de commencer (au cas oÃƒÂ¹ il a dÃƒÂ©jÃƒÂ  ÃƒÂ©tÃƒÂ© rempli)
        container.innerHTML = '';
        
        this.previewMessage = 'TÃƒÂ©lÃƒÂ©chargement du document depuis le serveur...';
        
        this.projectsService.getDownloadBlob(this.projectId, 'nogo').subscribe({
            next: (blob) => {
                this.previewMessage = 'Rendu du document DOCX...';
                import('docx-preview').then(docxPreview => {
                    docxPreview.renderAsync(blob, container, undefined, {
                        className: 'docx',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        ignoreLastRenderedPageBreak: true,
                        experimental: false,
                        trimXmlDeclaration: true,
                        useBase64URL: false
                    }).then(() => {
                        this.previewState = 'success';
                    }).catch(e => {
                        console.error('docx-preview render error', e);
                        this.previewState = 'error';
                        this.previewMessage = 'Erreur lors de l\'affichage du document.';
                    });
                }).catch(e => {
                    console.error('failed to import docx-preview', e);
                    this.previewState = 'error';
                    this.previewMessage = 'Erreur de chargement du lecteur DOCX.';
                });
            },
            error: (err) => {
                console.error('failed to fetch docx blob', err);
                this.previewState = 'error';
                this.previewMessage = 'Le téléchargement du fichier a échoué. Assurez-vous que le backend (project-service) est bien lancé.';
            }
        });
    }

    onGenerateReport(): void {
        this.isGenerating = true;
        this.messageService.add({ severity: 'info', summary: 'Génération', detail: 'Le rapport No-Go est en cours de rédaction par l\'IA...' });
        
        const analysteName = sessionStorage.getItem('userEmail') || 'Analyste';
        
        this.scoringService.confirmNoGo(this.projectId, undefined, analysteName).subscribe({
            next: (response) => {
                this.isGenerating = false;
                this.generatedReport = response;
                this.hasExistingReport = true;
                this.parseMotifs();
                this.showReportModal = true;
                
                // On force le texte ici au cas où le backend renvoie l'ancien message
                const role = response.targetRole || 'DDA / Manager';
                const detailStr = response.notifDetail || 'Seuil budgétaire applicable : > 10 000 000 TND';
                
                // Notification Cloche
                this.notificationService.addNotification({ 
                    title: 'Rapport No-Go Généré', 
                    message: `Rapport prêt et envoyé au ${role} pour validation.`, 
                    detail: detailStr, 
                    type: 'warning' 
                });
            },
            error: () => {
                this.isGenerating = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de générer le rapport No-Go.' });
            }
        });
    }

    exportDocx(): void {
        if (!this.generatedReport || !this.generatedReport.rapportPath) {
             this.messageService.add({ severity: 'warn', summary: 'Export impossible', detail: 'Aucun rapport gÃƒÂ©nÃƒÂ©rÃƒÂ© ou chemin introuvable.' });
             return;
        }
        this.projectsService.getDownloadBlob(this.projectId, 'nogo').subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const fileName = this.dossierName ? `NoGoReport_${this.dossierName}.docx` : `NoGoReport_${this.projectId}.docx`;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Le tÃƒÂ©lÃƒÂ©chargement a ÃƒÂ©chouÃƒÂ©. VÃƒÂ©rifiez que le backend est lancÃƒÂ©.' });
            }
        });
    }

    printReport(): void {
        const printContent = document.getElementById('docx-preview-modal');
        if (printContent) {
            const originalContents = document.body.innerHTML;
            const originalTitle = document.title;
            document.title = " "; // Astuce pour cacher le titre par dÃƒÂ©faut du navigateur
            
            const dateStr = new Date().toLocaleDateString('fr-FR');
            
            document.body.innerHTML = `
                <div style="display: flex; justify-content: space-between; padding: 10px 40px; font-family: Arial, sans-serif; font-weight: bold; font-size: 14px; border-bottom: 2px solid #ddd; margin-bottom: 20px;">
                    <span>${dateStr}</span>
                    <span style="color: #2563eb;">ProjectIQ</span>
                </div>
                ${printContent.innerHTML}
            `;
            
            window.print();
            
            document.body.innerHTML = originalContents;
            document.title = originalTitle;
            window.location.reload(); 
        }
    }
}


