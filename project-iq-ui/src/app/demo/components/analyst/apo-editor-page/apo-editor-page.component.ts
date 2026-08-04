import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AnalystProjectsService, ApoForm } from '../../../service/analyst-projects.service';

interface ApoFieldConfig {
    fieldName: string;
    label: string;
    source: 'auto' | 'claude' | 'manuel' | 'locked';
    type: 'text' | 'textarea' | 'dropdown';
    options?: any[];
}

interface ApoSectionConfig {
    title: string;
    icon: string;
    fields: ApoFieldConfig[];
}

@Component({
    selector: 'app-apo-editor-page',
    templateUrl: './apo-editor-page.component.html',
    styleUrls: ['./apo-editor-page.component.scss'],
    providers: [MessageService]
})
export class ApoEditorPageComponent implements OnInit {
    dossierId: string = '';
    apoData: any = {}; // Use any to allow dynamic indexing
    isLoading = true;
    isGenerating = false;

    sections: ApoSectionConfig[] = [
        {
            title: 'A — Identification & Cadrage',
            icon: 'pi pi-id-card',
            fields: [
                { fieldName: 'intituleOffre', label: 'Intitulé de l\'Offre', source: 'auto', type: 'text' },
                { fieldName: 'pays', label: 'Pays', source: 'auto', type: 'text' },
                { fieldName: 'client', label: 'Client', source: 'auto', type: 'text' },
                { fieldName: 'bailleurs', label: 'Bailleur(s)', source: 'auto', type: 'text' },
                { fieldName: 'budgetGlobal', label: 'Budget Global', source: 'auto', type: 'text' },
                { fieldName: 'dtLimSoum', label: 'Date Limite Soumission', source: 'auto', type: 'text' }
            ]
        },
        {
            title: 'B — Synthèse IA & Analyse Stratégique',
            icon: 'pi pi-sparkles',
            fields: [
                { fieldName: 'resumeContexteObjectifs', label: 'Résumé Contexte & Objectifs', source: 'claude', type: 'textarea' },
                { fieldName: 'pointsCritiques', label: 'Points Critiques', source: 'claude', type: 'textarea' },
                { fieldName: 'recommandationGoNoGo', label: 'Recommandation (Go/No-Go)', source: 'claude', type: 'text' },
                { fieldName: 'argumentaireGoNoGo', label: 'Argumentaire Synthétique', source: 'claude', type: 'textarea' }
            ]
        },
        {
            title: 'C — Saisies Manuelles Obligatoires',
            icon: 'pi pi-pencil',
            fields: [
                { fieldName: 'planAction', label: 'Plan d\'Action Proposé', source: 'manuel', type: 'textarea' },
                { fieldName: 'budgetInterne', label: 'Budget Interne Alloué', source: 'manuel', type: 'text' },
                { fieldName: 'numeroReference', label: 'Numéro de Référence Interne', source: 'manuel', type: 'text' }
            ]
        },
        {
            title: 'D — Validation & Signatures',
            icon: 'pi pi-check-square',
            fields: [
                { fieldName: 'decisionDo', label: 'Décision DO', source: 'locked', type: 'text' },
                { fieldName: 'decisionDda', label: 'Décision DDA', source: 'locked', type: 'text' },
                { fieldName: 'decisionDga', label: 'Décision DGA', source: 'locked', type: 'text' }
            ]
        }
    ];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectsService: AnalystProjectsService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            this.dossierId = params['id'];
            this.loadApoData();
            this.loadTemplate();
        });
    }

    loadTemplate(): void {
        this.projectsService.getTemplateBlob('APO-Formulaire Etudes-Template.docx').subscribe({
            next: (blob) => {
                const container = document.getElementById('docx-preview-apo');
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

    loadApoData(): void {
        this.isLoading = true;
        this.projectsService.extractApoForm(this.dossierId).subscribe({
            next: (data) => {
                this.apoData = data;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les données APO.' });
            }
        });
    }

    onFieldChange(event: { field: string, value: any }): void {
        this.apoData[event.field] = event.value;
        this.projectsService.updateApoField(this.dossierId, event.field, event.value).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Sauvegardé', detail: `Champ ${event.field} mis à jour.`, life: 2000 });
            },
            error: () => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la sauvegarde du champ.' });
            }
        });
    }

    get completionPercentage(): number {
        if (!this.apoData) return 0;
        let totalManual = 0;
        let filledManual = 0;

        this.sections.forEach(sec => {
            sec.fields.forEach(f => {
                if (f.source === 'manuel') {
                    totalManual++;
                    if (this.apoData[f.fieldName] && this.apoData[f.fieldName].trim().length > 0) {
                        filledManual++;
                    }
                }
            });
        });

        if (totalManual === 0) return 100;
        return Math.round((filledManual / totalManual) * 100);
    }

    canGenerate(): boolean {
        return this.completionPercentage === 100;
    }

    generateDocx(): void {
        if (!this.canGenerate()) {
            this.messageService.add({ severity: 'warn', summary: 'Champs manquants', detail: 'Veuillez remplir tous les champs manuels obligatoires (Orange).' });
            return;
        }

        this.isGenerating = true;
        this.projectsService.exportApoDocx(this.dossierId).subscribe({
            next: (res) => {
                this.isGenerating = false;
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'DOCX généré et sauvegardé sur MinIO.' });
                // En réalité, on pourrait télécharger le blob ici, mais le flux demande de passer au Pack ZIP
                setTimeout(() => {
                    this.projectsService.updateStatus(this.dossierId, 'PACK_READY').subscribe({
                        next: () => this.router.navigate(['/dossiers', this.dossierId, 'pack']),
                        error: () => this.router.navigate(['/dossiers', this.dossierId, 'pack'])
                    });
                }, 1500);
            },
            error: () => {
                this.isGenerating = false;
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de générer le DOCX APO.' });
            }
        });
    }
}
