import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ManagerValidationService } from '../../../service/manager-validation.service';
import { catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-manager-historique-packs',
  templateUrl: './manager-historique-packs.component.html',
  styleUrls: ['./manager-historique-packs.component.scss'],
  providers: []
})
export class ManagerHistoriquePacksComponent implements OnInit {

  packs: any[] = [];
  filteredPacks: any[] = [];
  loading: boolean = true;
  searchTerm: string = '';
  selectedPack: any = null;
  displayDocuments = false;
  exportMenuItems: any[] = [];

  constructor(
    private validationService: ManagerValidationService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.exportMenuItems = [
      { label: 'Exporter en CSV', icon: 'pi pi-file-excel', command: () => this.exportCsv() },
      { label: 'Exporter en PDF', icon: 'pi pi-file-pdf', command: () => this.exportPdf() }
    ];
    this.loadPacks();
  }

  exportCsv() { this.downloadCsv('Historique_Packs.csv', ['Dossier', 'Client', 'Statut', 'P-Win'], this.filteredPacks.map(p => [p.intituleOffre, p.client, p.status, p.pwinScore ?? 'N/A'])); }
  exportPdf() { this.downloadPdf('Historique des packs', ['Dossier', 'Client', 'Statut', 'P-Win'], this.filteredPacks.map(p => [p.intituleOffre || '—', p.client || '—', p.status || '—', `${p.pwinScore ?? 'N/A'}%`])); }
  private downloadCsv(filename: string, header: string[], rows: any[][]) { const e = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`; const blob = new Blob([`\uFEFF${[header, ...rows].map(r => r.map(e).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  private downloadPdf(title: string, header: string[], rows: any[][]) { const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }); doc.text(title, 40, 38); autoTable(doc, { startY: 55, head: [header], body: rows, styles: { fontSize: 8 } }); doc.save(`${title.replace(/\s+/g, '_')}.pdf`); }

  loadPacks() {
    this.loading = true;
    this.validationService.getDossiersWithPacks().subscribe({
      next: (data) => {
        if (!data.length) {
          this.packs = [];
          this.filteredPacks = [];
          this.loading = false;
          return;
        }
        forkJoin(data.map(pack => this.validationService.getValidationStatus(pack.id).pipe(catchError(() => of([]))))).subscribe({
          next: (allDecisions) => {
            this.packs = data.map((pack, index) => ({ ...pack, decisions: allDecisions[index] }));
            this.filteredPacks = [...this.packs];
            this.loading = false;
          },
          error: () => {
            this.packs = data;
            this.filteredPacks = [...data];
            this.loading = false;
          }
        });
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
    if (!pack.packZipPath) {
      this.messageService.add({ severity: 'warn', summary: 'Non disponible', detail: 'Le fichier ZIP du pack n\'est pas encore rattaché.' });
      return;
    }
    
    this.messageService.add({ severity: 'success', summary: 'Téléchargement', detail: 'Le téléchargement du Pack a commencé.' });
    this.openDocument(pack, 'pack');
  }

  consultPack(pack: any) {
    this.selectedPack = pack;
    this.displayDocuments = true;
  }

  openDocument(pack: any, type: 'apo' | 'methodo' | 'rapport' | 'pack' | 'audit') {
    this.validationService.downloadDocument(pack.id, type).subscribe({
      next: (content) => {
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.documentFilename(type, pack.id);
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.messageService.add({ severity: 'warn', summary: 'Document indisponible', detail: err.error?.message || `Le document ${type} n'est pas disponible pour ce dossier.` })
    });
  }

  private documentFilename(type: 'apo' | 'methodo' | 'rapport' | 'pack' | 'audit', dossierId: string): string {
    const shortId = dossierId.substring(0, 8);
    const names = {
      apo: `APO_${shortId}.docx`,
      methodo: `Methodologie_${shortId}.docx`,
      rapport: `Rapport_General_${shortId}.docx`,
      pack: `Pack_Soumission_${shortId}.zip`,
      audit: `Rapport_Audit_${shortId}.docx`
    };
    return names[type];
  }

  decisionLabel(status: string): string {
    if (status === 'APPROVED') return 'GO approuvé';
    if (status === 'REJECTED' || status === 'APPROVE_NOGO') return 'NO-GO';
    if (status === 'PENDING') return 'En attente';
    return status || 'Non renseigné';
  }

  decisionSeverity(status: string): 'success' | 'danger' | 'warning' | 'info' {
    if (status === 'APPROVED') return 'success';
    if (status === 'REJECTED' || status === 'APPROVE_NOGO') return 'danger';
    return status === 'PENDING' ? 'warning' : 'info';
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
