import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ConfigIaService } from '../../../service/config-ia.service';
import { AnalystProjectsService } from '../../../service/analyst-projects.service';

interface PromptDef {
    filename: string;
    title: string;
    description: string;
    content?: string;
    icon: string;
}

@Component({
    templateUrl: './analyst-config-ia.component.html',
    providers: [],
    styles: [`
        .prompt-editor {
            font-family: 'Courier New', Courier, monospace;
            background: #1e293b;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 8px;
            width: 100%;
            min-height: 400px;
            border: 1px solid #334155;
            resize: vertical;
        }
        .prompt-editor:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        :host ::ng-deep .prompt-scope-panel {
            min-width: 22rem;
            max-width: min(32rem, calc(100vw - 2rem));
        }
    `]
})
export class AnalystConfigIaComponent implements OnInit {

    prompts: { [key: string]: string } = {};

    phases = [
        {
            title: 'Phase 1 : Indexation & Extraction',
            icon: 'pi pi-filter',
            prompts: [
                { filename: 'prompt_p1.txt', title: 'Extraction des 12 champs bloquants', description: 'Règles pour la phase TDR initiale.', icon: 'pi pi-file-export' }
            ]
        },
        {
            title: 'Phase 2 : Analyse Profonde (Deep Analysis)',
            icon: 'pi pi-search-plus',
            prompts: [
                { filename: 'prompt_p2_fields.txt', title: 'Extraction détaillée P2', description: 'Champs approfondis (budget, dates...).', icon: 'pi pi-list' },
                { filename: 'prompt_risk_analysis.txt', title: 'Analyse des Risques', description: 'Recherche de clauses pénales, IP, pénalités.', icon: 'pi pi-exclamation-triangle' },
                { filename: 'prompt_points_critiques.txt', title: 'Synthèse des points critiques', description: 'Résumé des risques pour le scoring.', icon: 'pi pi-bolt' },
                { filename: 'prompt_nogo_report.txt', title: 'Rapport No-Go', description: 'Justification de rejet du dossier.', icon: 'pi pi-times-circle' }
            ]
        },
        {
            title: 'Phase 3 : Matching & Profilage',
            icon: 'pi pi-sitemap',
            prompts: [
                { filename: 'prompt_extract_requirements.txt', title: 'Exigences Client', description: 'Extraction des prérequis du client.', icon: 'pi pi-user-edit' },
                { filename: 'prompt_diff_matrix.txt', title: 'Matrice de Différenciation', description: 'Comparaison des compétences de la société vs besoins.', icon: 'pi pi-table' }
            ]
        },
        {
            title: 'Phase 4 : Génération des Livrables',
            icon: 'pi pi-file-pdf',
            prompts: [
                { filename: 'prompt_methodologie.txt', title: 'Rédaction de Méthodologie', description: 'Génération du texte méthodologique.', icon: 'pi pi-pencil' },
                { filename: 'prompt_apo_resume.txt', title: 'Génération APO (Résumé)', description: 'Résumé exécutif.', icon: 'pi pi-align-left' },
                { filename: 'prompt_apo_argumentaire.txt', title: 'Génération APO (Argumentaire)', description: 'Argumentaire technique détaillé.', icon: 'pi pi-comment' }
            ]
        }
    ];

    selectedPrompt: PromptDef | null = null;
    editorContent: string = '';
    isSaving: boolean = false;

    dossiers: any[] = [];
    selectedDossier: any | null = null;
    globalPrompts: { [key: string]: string } = {};

    constructor(
        private configIaService: ConfigIaService, 
        private messageService: MessageService,
        private projectService: AnalystProjectsService,
        private http: HttpClient
    ) {}

    ngOnInit(): void {
        this.loadPrompts();
        this.loadDossiers();
    }

    loadDossiers() {
        this.projectService.getAllDossiers().subscribe({
            next: (data) => {
                this.dossiers = data;
            }
        });
    }

    onScopeChange() {
        this.selectedPrompt = null;
        this.editorContent = '';
        if (this.selectedDossier) {
            this.configIaService.getDossierOverrides(this.selectedDossier.id).subscribe({
                next: (overrides) => {
                    this.prompts = { ...this.globalPrompts, ...overrides };
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les exceptions du dossier.' })
            });
        } else {
            this.prompts = { ...this.globalPrompts };
        }
    }

    loadPrompts() {
        this.configIaService.getAllPrompts().subscribe({
            next: (data) => {
                this.globalPrompts = data;
                this.prompts = { ...this.globalPrompts };
                this.onScopeChange();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les prompts depuis le serveur IA.' });
            }
        });
    }

    selectPrompt(p: PromptDef) {
        this.selectedPrompt = p;
        this.editorContent = this.prompts[p.filename] || 'Contenu introuvable pour ' + p.filename;
    }

    savePrompt() {
        if (!this.selectedPrompt) return;

        this.isSaving = true;

        if (this.selectedDossier) {
            this.configIaService.updateDossierOverride(this.selectedDossier.id, this.selectedPrompt.filename, this.editorContent).subscribe({
                next: () => {
                    if (this.selectedPrompt) {
                        this.prompts[this.selectedPrompt.filename] = this.editorContent;
                    }
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: `Exception enregistrée pour le dossier ${this.selectedDossier.intituleOffre || this.selectedDossier.id}` });
                    this.isSaving = false;
                },
                error: (err) => {
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la sauvegarde.' });
                    this.isSaving = false;
                }
            });
        } else {
            this.configIaService.updatePrompt(this.selectedPrompt.filename, this.editorContent).subscribe({
                next: () => {
                    if (this.selectedPrompt) {
                         this.globalPrompts[this.selectedPrompt.filename] = this.editorContent;
                         this.prompts[this.selectedPrompt.filename] = this.editorContent;
                    }
                    this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Les instructions ont été mises à jour avec succès et appliquées au modèle global.' });
                    this.isSaving = false;
                },
                error: (err) => {
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Échec de la sauvegarde.' });
                    this.isSaving = false;
                }
            });
        }
    }
}
