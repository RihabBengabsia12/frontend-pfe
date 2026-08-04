import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';

@Component({
  selector: 'app-manager-no-go',
  templateUrl: './manager-no-go.component.html',
  styleUrls: ['./manager-no-go.component.scss'],
  providers: [MessageService]
})
export class ManagerNoGoComponent implements OnInit {
  dossiers: any[] = [];
  filteredDossiers: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';

  // Variables pour la consultation (Preview DOCX)
  displayDialog: boolean = false;
  selectedDossier: any = null;
  loadingPreview: boolean = false;

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadNoGoReports();
  }

  loadNoGoReports() {
    this.loading = true;
    this.validationService.getDossiersWithNoGo().subscribe({
      next: (data) => {
        this.dossiers = data;
        this.filteredDossiers = [...this.dossiers];
        this.loading = false;
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de charger les rapports No-Go' });
        this.loading = false;
      }
    });
  }

  onSearch() {
    if (!this.searchTerm) {
      this.filteredDossiers = [...this.dossiers];
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredDossiers = this.dossiers.filter(d => 
      (d.intituleOffre && d.intituleOffre.toLowerCase().includes(term)) ||
      (d.client && d.client.toLowerCase().includes(term))
    );
  }

  openReportPreview(dossier: any) {
    if (!dossier.nogoReportPath) {
      this.messageService.add({ severity: 'warn', summary: 'Non disponible', detail: 'Le rapport No-Go est introuvable pour ce dossier.' });
      return;
    }
    
    this.selectedDossier = dossier;
    this.displayDialog = true;
    this.loadingPreview = true;

    // Simulation du chargement du DOCX
    setTimeout(() => {
        this.loadingPreview = false;
    }, 1500);
  }
}
