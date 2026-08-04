import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Delegation, DelegationService } from '../../../service/delegation.service';

@Component({
  selector: 'app-delegations-page',
  templateUrl: './delegations-page.component.html',
  styleUrls: ['./delegations-page.component.scss'],
  providers: [MessageService]
})
export class DelegationsPageComponent implements OnInit {

    delegations: Delegation[] = [];
    loading: boolean = true;
    saveLoading: boolean = false;

    selectedDelegation: Delegation | null = null;
    editDelegation: Partial<Delegation> = {};

    constructor(
        private delegationService: DelegationService,
        private messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadDelegations();
    }

    loadDelegations() {
        this.loading = true;
        this.delegationService.getAllDelegations().subscribe({
            next: (data) => {
                const order = ['DO', 'DDA', 'DGA', 'PDG'];
                this.delegations = data.sort((a, b) => order.indexOf(a.roleName) - order.indexOf(b.roleName));
                if (this.delegations.length > 0) {
                    this.selectDelegation(this.delegations[0]);
                }
                this.loading = false;
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les délégations' });
                this.loading = false;
            }
        });
    }

    selectDelegation(delegation: Delegation) {
        this.selectedDelegation = delegation;
        this.editDelegation = { ...delegation };
    }

    saveDelegation() {
        if (!this.editDelegation.email) {
            this.messageService.add({ severity: 'warn', summary: 'Attention', detail: 'L\'email est obligatoire' });
            return;
        }

        this.saveLoading = true;
        this.delegationService.updateDelegation(this.selectedDelegation!.id, this.editDelegation).subscribe({
            next: (updated) => {
                this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Délégation mise à jour avec succès' });
                this.saveLoading = false;
                this.loadDelegations();
            },
            error: (err) => {
                this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Erreur lors de la mise à jour' });
                this.saveLoading = false;
            }
        });
    }

    getRoleIcon(role: string): string {
        switch (role) {
            case 'DO': return 'pi pi-compass';
            case 'DDA': return 'pi pi-chart-line';
            case 'DGA': return 'pi pi-briefcase';
            case 'PDG': return 'pi pi-star-fill';
            default: return 'pi pi-sitemap';
        }
    }
}
