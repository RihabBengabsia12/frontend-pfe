import { Component, Input, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ConfigIaService } from '../../../../service/config-ia.service';

@Component({
  selector: 'app-prompt-override',
  templateUrl: './prompt-override.component.html',
  styleUrls: ['./prompt-override.component.scss'],
  providers: [MessageService]
})
export class PromptOverrideComponent implements OnInit {
  
  @Input() dossierId!: string;
  
  visible: boolean = false;
  loading: boolean = false;
  saving: boolean = false;

  promptsList: { label: string, value: string }[] = [];
  selectedPromptFilename: string = '';
  
  globalPrompts: { [key: string]: string } = {};
  overrides: { [key: string]: string } = {};
  
  currentContent: string = '';
  isOverridden: boolean = false;

  constructor(
    private configIaService: ConfigIaService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    // We fetch when the sidebar is opened to ensure fresh data
  }

  showDialog() {
    this.visible = true;
    this.loadData();
  }

  hideDialog() {
    this.visible = false;
  }

  loadData() {
    this.loading = true;
    
    // Load Global Prompts
    this.configIaService.getAllPrompts().subscribe({
      next: (globals) => {
        this.globalPrompts = globals;
        
        // Build dropdown list
        this.promptsList = Object.keys(globals).map(k => ({ label: this.formatName(k), value: k }));
        if (this.promptsList.length > 0 && !this.selectedPromptFilename) {
          this.selectedPromptFilename = this.promptsList[0].value;
        }

        // Load Overrides for this dossier
        if (this.dossierId) {
          this.configIaService.getDossierOverrides(this.dossierId).subscribe({
            next: (ovs) => {
              this.overrides = ovs;
              this.refreshEditorContent();
              this.loading = false;
            },
            error: (err) => {
              console.error(err);
              this.messageService.add({severity:'error', summary:'Erreur', detail:'Impossible de charger les surcharges IA.'});
              this.loading = false;
            }
          });
        } else {
          this.refreshEditorContent();
          this.loading = false;
        }
      },
      error: (err) => {
        console.error(err);
        this.messageService.add({severity:'error', summary:'Erreur', detail:'Impossible de charger les prompts globaux.'});
        this.loading = false;
      }
    });
  }

  onPromptChange() {
    this.refreshEditorContent();
  }

  refreshEditorContent() {
    if (!this.selectedPromptFilename) return;

    if (this.overrides[this.selectedPromptFilename]) {
      this.currentContent = this.overrides[this.selectedPromptFilename];
      this.isOverridden = true;
    } else {
      this.currentContent = this.globalPrompts[this.selectedPromptFilename] || '';
      this.isOverridden = false;
    }
  }

  saveOverride() {
    if (!this.dossierId || !this.selectedPromptFilename) return;

    this.saving = true;
    this.configIaService.updateDossierOverride(this.dossierId, this.selectedPromptFilename, this.currentContent).subscribe({
      next: () => {
        this.saving = false;
        this.isOverridden = true;
        this.overrides[this.selectedPromptFilename] = this.currentContent;
        this.messageService.add({severity:'success', summary:'Succès', detail:'Le prompt a été ajusté pour ce dossier uniquement.'});
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        this.messageService.add({severity:'error', summary:'Erreur', detail:'Échec de la sauvegarde de l\'ajustement.'});
      }
    });
  }
  
  resetToGlobal() {
    this.currentContent = this.globalPrompts[this.selectedPromptFilename] || '';
    this.saveOverride();
  }

  private formatName(filename: string): string {
    return filename.replace('.txt', '').replace(/-/g, ' ').toUpperCase();
  }
}
