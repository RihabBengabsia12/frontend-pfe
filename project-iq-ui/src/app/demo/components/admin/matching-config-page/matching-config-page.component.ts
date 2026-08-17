import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ConfigService, ScoringConfig } from '../../../service/config.service';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-matching-config-page',
    templateUrl: './matching-config-page.component.html',
    providers: [],
    styles: [`
        .pastel-input {
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            padding: 0.75rem;
            width: 100%;
            transition: all 0.2s;
        }
        .pastel-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
    `]
})
export class MatchingConfigPageComponent implements OnInit {
    config!: ScoringConfig;
    isLoading = true;

    dossiers: Dossier[] = [];
    selectedDossierId: string | null = null;

    constructor(
        private configService: ConfigService,
        private dossierService: AnalystProjectsService,
        private router: Router,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        const role = sessionStorage.getItem('userRole')?.toUpperCase() || 'GUEST';
        if (role !== 'ADMIN') {
            this.router.navigate(['/dashboard']);
            // Wait a moment for router navigation to finish before adding the toast
            setTimeout(() => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Accès refusé',
                    detail: 'Seuls les profils administrateurs d\'Egis peuvent accéder aux configurations de matching.'
                });
            }, 100);
            return;
        }

        this.loadDossiers();
        this.loadConfig();
    }

    loadDossiers(): void {
        this.dossierService.getAllDossiers().subscribe({
            next: (data) => {
                this.dossiers = data;
            },
            error: () => {
                this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'Impossible de charger la liste des dossiers.' });
            }
        });
    }

    onDossierChange(): void {
        this.loadConfig();
    }

    loadConfig(): void {
        this.isLoading = true;
        const req = this.selectedDossierId 
            ? this.configService.getConfigForDossier(this.selectedDossierId)
            : this.configService.getConfig();

        req.subscribe({
            next: (data) => {
                this.config = data;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur',
                    detail: 'Impossible de récupérer la configuration du serveur.'
                });
            }
        });
    }

    isSaveDisabled(): boolean {
        return !this.config || 
               this.config.seuilCompatCompetences === null || this.config.seuilCompatExperts === null ||
               this.config.seuilAlignementOui === null || this.config.seuilAlignementPartiel === null ||
               this.config.seuilCompatCompetences < 0 || this.config.seuilCompatCompetences > 1 ||
               this.config.seuilCompatExperts < 0 || this.config.seuilCompatExperts > 1 ||
               this.config.seuilAlignementOui < 0 || this.config.seuilAlignementOui > 1 ||
               this.config.seuilAlignementPartiel < 0 || this.config.seuilAlignementPartiel > 1 ||
               this.config.seuilAlignementOui <= this.config.seuilAlignementPartiel;
    }

    saveConfig(): void {
        if (this.isSaveDisabled()) return;

        this.isLoading = true;
        const req = this.selectedDossierId 
            ? this.configService.saveConfigForDossier(this.selectedDossierId, this.config)
            : this.configService.saveConfig(this.config);

        req.subscribe({
            next: (res) => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Configuration sauvegardée',
                    detail: 'Les seuils de matching ont été mis à jour.'
                });
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur de sauvegarde',
                    detail: 'Impossible de persister les configurations de matching.'
                });
            }
        });
    }
}
