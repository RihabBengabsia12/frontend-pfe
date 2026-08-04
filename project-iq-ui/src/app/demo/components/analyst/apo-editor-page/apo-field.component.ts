import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-apo-field',
    template: `
        <div class="apo-field-container flex align-items-start gap-3 py-3 border-bottom-1 surface-border">
            <div class="field-info w-4 flex flex-column gap-1">
                <span class="font-bold text-700 uppercase text-xs tracking-wider">{{ label }}</span>
                <span class="text-xs font-semibold px-2 py-1 border-round w-max" [ngClass]="getBadgeClass()">
                    <i [class]="getIconClass()"></i> {{ sourceLabel }}
                </span>
            </div>
            
            <div class="field-value w-8 flex align-items-start gap-2">
                <ng-container *ngIf="type === 'textarea'">
                    <textarea pInputTextarea [(ngModel)]="value" [disabled]="locked" 
                              rows="3" class="w-full text-sm" (blur)="onBlur()"></textarea>
                </ng-container>
                
                <ng-container *ngIf="type === 'text'">
                    <input pInputText [(ngModel)]="value" [disabled]="locked" 
                           class="w-full text-sm" (blur)="onBlur()" />
                </ng-container>

                <ng-container *ngIf="type === 'dropdown'">
                    <p-dropdown [options]="options" [(ngModel)]="value" [disabled]="locked" 
                                appendTo="body" class="w-full" styleClass="w-full text-sm" (onChange)="onBlur()"></p-dropdown>
                </ng-container>

                <button *ngIf="!locked" pButton icon="pi pi-check" class="p-button-text p-button-sm p-button-success" 
                        pTooltip="Enregistrer" (click)="save()"></button>
            </div>
        </div>
    `,
    styles: [`
        .badge-auto { background-color: #dcfce7; color: #166534; }
        .badge-claude { background-color: #dbeafe; color: #1e40af; }
        .badge-manuel { background-color: #ffedd5; color: #9a3412; }
        .badge-locked { background-color: #f3f4f6; color: #374151; }
    `]
})
export class ApoFieldComponent {
    @Input() fieldName!: string;
    @Input() label!: string;
    @Input() value: any;
    @Input() source: 'auto' | 'claude' | 'manuel' | 'locked' = 'auto';
    @Input() type: 'text' | 'textarea' | 'dropdown' = 'text';
    @Input() options: any[] = [];
    @Input() locked = false;

    @Output() valueChange = new EventEmitter<{ field: string, value: any }>();

    get sourceLabel(): string {
        switch(this.source) {
            case 'auto': return 'Auto / Propagé';
            case 'claude': return 'Généré par Claude';
            case 'manuel': return 'Saisie Manuelle Requise';
            case 'locked': return 'Verrouillé / Signature';
            default: return '';
        }
    }

    getBadgeClass(): string {
        return `badge-${this.source}`;
    }

    getIconClass(): string {
        switch(this.source) {
            case 'auto': return 'pi pi-check-circle mr-1';
            case 'claude': return 'pi pi-bolt mr-1';
            case 'manuel': return 'pi pi-exclamation-triangle mr-1';
            case 'locked': return 'pi pi-lock mr-1';
            default: return '';
        }
    }

    onBlur(): void {
        this.save();
    }

    save(): void {
        this.valueChange.emit({ field: this.fieldName, value: this.value });
    }
}
