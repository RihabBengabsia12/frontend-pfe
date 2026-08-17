import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/demo/service/auth.service';
import { AdminService } from 'src/app/demo/service/admin.service';
import { HttpClient } from '@angular/common/http';

export interface ServiceHealth {
    name: string;
    port: string;
    status: 'UP' | 'DOWN' | 'CHECKING';
    icon: string;
    description: string;
}

@Component({
    selector: 'app-health',
    templateUrl: './health.component.html'
})
export class HealthComponent implements OnInit {

    services: ServiceHealth[] = [
        { name: 'Accès & Sécurité',  port: '', status: 'CHECKING', icon: 'pi pi-shield',   description: 'Assure la protection des comptes, la validation des inscriptions et la sécurité des connexions.' },
        { name: 'Administration & Contrôle', port: '', status: 'CHECKING', icon: 'pi pi-cog',    description: 'Pilote l\'annuaire des utilisateurs, la configuration des droits et le traçage historique des actions.' },
        { name: 'Moteur IA (Claude)', port: '', status: 'CHECKING', icon: 'pi pi-microchip',    description: 'Assure la connectivité avec l\'API distante Anthropic pour l\'extraction et la génération.' },
        { name: 'Analyste (Orchestrateur)', port: '', status: 'CHECKING', icon: 'pi pi-sitemap',    description: 'Gère le pipeline P-Win, le Matching métier et l\'assemblage des données.' }
    ];

    lastChecked: Date | null = null;

    constructor(
        private authService: AuthService,
        private adminService: AdminService,
        private http: HttpClient
    ) {}

    ngOnInit(): void {
        this.checkAll();
    }

    checkAll(): void {
        this.services.forEach(s => s.status = 'CHECKING');

        this.authService.getAuthHealth().subscribe({
            next:  () => this.updateStatus('Accès & Sécurité', 'UP'),
            error: () => this.updateStatus('Accès & Sécurité', 'DOWN')
        });

        this.adminService.getHealth().subscribe({
            next:  () => this.updateStatus('Administration & Contrôle', 'UP'),
            error: () => this.updateStatus('Administration & Contrôle', 'DOWN')
        });

        // Vérification IA-Service (Python) + API Anthropic via port local
        this.http.get<any>('http://localhost:8000/health').subscribe({
            next:  (res) => {
                // On vérifie si la connexion à l'API Claude externe a réussi
                if (res.claude_api === 'connected') {
                    this.updateStatus('Moteur IA (Claude)', 'UP');
                } else {
                    this.updateStatus('Moteur IA (Claude)', 'DOWN');
                }
            },
            error: () => this.updateStatus('Moteur IA (Claude)', 'DOWN')
        });

        // Vérification Analyste-Service via API Gateway
        this.http.get<any>('/api/analyses/dashboard-stats').subscribe({
            next:  () => this.updateStatus('Analyste (Orchestrateur)', 'UP'),
            error: (err) => {
                // If we get 401, 403, or 200, the service is up. 
                if (err.status === 401 || err.status === 403 || err.status === 200 || err.status === 404) {
                    this.updateStatus('Analyste (Orchestrateur)', 'UP');
                } else {
                    this.updateStatus('Analyste (Orchestrateur)', 'DOWN');
                }
            }
        });

        this.lastChecked = new Date();
    }

    private updateStatus(name: string, status: 'UP' | 'DOWN'): void {
        const s = this.services.find(x => x.name === name);
        if (s) s.status = status;
    }

    statusColor(status: string): string {
        if (status === 'UP')       return '#22c55e';
        if (status === 'DOWN')     return '#ef4444';
        return '#f59e0b';
    }

    statusLabel(status: string): string {
        if (status === 'UP')       return 'Opérationnel';
        if (status === 'DOWN')     return 'Hors ligne';
        return 'Vérification...';
    }

    statusIcon(status: string): string {
        if (status === 'UP')       return 'pi pi-check-circle';
        if (status === 'DOWN')     return 'pi pi-times-circle';
        return 'pi pi-spin pi-spinner';
    }

    allUp(): boolean {
        return this.services.every(s => s.status === 'UP');
    }
}
