import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-historique-packs',
  templateUrl: './manager-historique-packs.component.html',
  styleUrls: ['./manager-historique-packs.component.scss'],
  providers: [MessageService]
})
export class ManagerHistoriquePacksComponent implements OnInit {

  packs: any[] = [];
  filteredPacks: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadPacks();
  }

  loadPacks() {
    this.loading = true;
    this.validationService.getDossiersWithPacks().subscribe({
      next: (data) => {
        this.packs = data;
        this.filteredPacks = [...this.packs];
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les packs' });
        this.loading = false;
      }
    });
  }

  onSearch() {
    if (!this.searchTerm) {
      this.filteredPacks = [...this.packs];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredPacks = this.packs.filter(p => 
      (p.intituleOffre && p.intituleOffre.toLowerCase().includes(term)) ||
      (p.client && p.client.toLowerCase().includes(term))
    );
  }

  downloadPack(pack: any) {
    if (!pack.packGlobalPath) {
      this.messageService.add({ severity: 'warn', summary: 'Non disponible', detail: 'Le fichier ZIP du pack n\'est pas encore rattaché.' });
      return;
    }
    
    this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le téléchargement du Pack a commencé.' });
    console.log('Downloading ZIP: ', pack.packGlobalPath);
    // Simulation: window.open(environment.minioUrl + pack.packGlobalPath);
  }

  getStatusBadge(status: string): { severity: string, label: string, icon: string, color: string } {
    switch (status) {
      case 'PACK_READY':
        return { severity: 'info', label: 'Pack Généré', icon: 'pi-file-zip', color: 'blue' };
      case 'PENDING_VALIDATION':
        return { severity: 'warning', label: 'En Validation', icon: 'pi-clock', color: 'orange' };
      case 'SUBMITTED':
        return { severity: 'success', label: 'Validé', icon: 'pi-check-circle', color: 'green' };
      case 'AUDIT':
      case 'ARCHIVED':
        return { severity: 'success', label: 'Clôturé & Archivé', icon: 'pi-verified', color: 'green' };
      case 'NO_GO_CONFIRMED':
        return { severity: 'danger', label: 'No-Go / Abandon', icon: 'pi-times-circle', color: 'red' };
      default:
        return { severity: 'secondary', label: status, icon: 'pi-info-circle', color: 'gray' };
    }
  }

  getScoreColor(score: number): string {
    if (!score) return 'text-500';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
}
