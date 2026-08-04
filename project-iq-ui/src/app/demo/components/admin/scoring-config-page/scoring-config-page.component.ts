import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ConfigService, ScoringConfig } from '../../../service/config.service';
import { AnalystProjectsService, Dossier } from '../../../service/analyst-projects.service';

@Component({
    selector: 'app-scoring-config-page',
    templateUrl: './scoring-config-page.component.html',
    providers: [MessageService],
    styles: [`
        .total-badge {
            font-size: 1.1rem;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 20px;
        }
        .bg-red-badge {
            background-color: #ffeef0;
            color: #a12b39;
            border: 1px solid #fca5a5;
        }
        .bg-green-badge {
            background-color: #e2f3eb;
            color: #2d6a4f;
            border: 1px solid #85d1a0;
        }
    `]
})
export class ScoringConfigPageComponent implements OnInit {
    config!: ScoringConfig;
    isLoading = true;
    totalSum = 100;

    dossiers: Dossier[] = [];
    selectedDossierId: string | null = null;

    constructor(
        private configService: ConfigService,
        private dossierService: AnalystProjectsService,
        private router: Router,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        const role = localStorage.getItem('userRole')?.toUpperCase() || 'GUEST';
        if (role !== 'ADMIN') {
            this.router.navigate(['/dashboard']);
            // Wait a moment for router navigation to finish before adding the toast
            setTimeout(() => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Accès refusé',
                    detail: 'Seuls les profils administrateurs d\'Egis peuvent accéder aux configurations de scoring.'
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
                this.calculateTotal();
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

    calculateTotal(): void {
        if (!this.config) return;
        this.totalSum = 
            Number(this.config.weightA) + 
            Number(this.config.weightB) + 
            Number(this.config.weightC) + 
            Number(this.config.weightD) + 
            Number(this.config.weightE);
    }

    onWeightsChange(event: {a: number, b: number, c: number, d: number, e: number}): void {
        if (!this.config) return;
        this.config.weightA = event.a;
        this.config.weightB = event.b;
        this.config.weightC = event.c;
        this.config.weightD = event.d;
        this.config.weightE = event.e;
        this.calculateTotal();
    }

    isSaveDisabled(): boolean {
        return this.totalSum !== 100 || !this.config || 
               this.config.seuilNogo === null || this.config.seuilGo === null || 
               this.config.seuilGo <= this.config.seuilNogo || this.config.minTjm <= 0;
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
                    detail: res.message || 'Les pondérations et seuils ont été mis à jour.'
                });
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Erreur de sauvegarde',
                    detail: 'Impossible de persister les configurations.'
                });
            }
        });
    }
}
