import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { MessageService } from 'primeng/api';

interface SystemAuditEntry {
    id: number;
    acteur: string;
    action: string;
    details: string;
    timestamp: string;
}

@Component({
    selector: 'app-system-audit',
    templateUrl: './system-audit.component.html',
    providers: [MessageService]
})
export class SystemAuditComponent implements OnInit {

    auditHistory: SystemAuditEntry[] = [];
    isLoading: boolean = true;
    
    // Pour le filtre global
    filteredHistory: SystemAuditEntry[] = [];
    searchQuery: string = '';

    constructor(
        private http: HttpClient,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadHistory();
    }

    loadHistory(): void {
        this.isLoading = true;
        this.http.get<SystemAuditEntry[]>(`${environment.apiUrl}/analyste-service/api/system-audit`)
            .subscribe({
                next: (data) => {
                    this.auditHistory = data;
                    this.filteredHistory = data;
                    this.isLoading = false;
                },
                error: (err) => {
                    console.error('Erreur chargement audit système', err);
                    this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger l\'historique système.' });
                    this.isLoading = false;
                }
            });
    }

    onSearch(event: any): void {
        const query = event.target.value.toLowerCase();
        if (!query) {
            this.filteredHistory = [...this.auditHistory];
        } else {
            this.filteredHistory = this.auditHistory.filter(entry => 
                entry.action.toLowerCase().includes(query) ||
                entry.acteur.toLowerCase().includes(query) ||
                (entry.details && entry.details.toLowerCase().includes(query))
            );
        }
    }

    getSeverity(action: string): string {
        if (action.includes('UPDATE')) return 'warning';
        if (action.includes('ADD') || action.includes('CREATE')) return 'success';
        if (action.includes('DELETE') || action.includes('REMOVE')) return 'danger';
        return 'info';
    }

    getIcon(action: string): string {
        if (action.includes('UPDATE')) return 'pi pi-pencil';
        if (action.includes('ADD')) return 'pi pi-plus';
        if (action.includes('DELETE')) return 'pi pi-trash';
        return 'pi pi-cog';
    }
}
