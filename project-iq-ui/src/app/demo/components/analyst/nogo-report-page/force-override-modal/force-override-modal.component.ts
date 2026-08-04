import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-force-override-modal',
    templateUrl: './force-override-modal.component.html',
    styles: [`
        .modal-body {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            padding-top: 1rem;
        }
        .counter-badge {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 6px;
        }
        .bg-red-count {
            background-color: #ffeef0;
            color: #a12b39;
        }
        .bg-green-count {
            background-color: #e2f3eb;
            color: #2d6a4f;
        }
        ::ng-deep .custom-progress-green .p-progressbar-value {
            background-color: #10b981 !important;
            transition: width 0.3s ease;
        }
        ::ng-deep .custom-progress-red .p-progressbar-value {
            background-color: #ef4444 !important;
            transition: width 0.3s ease;
        }
    `]
})
export class ForceOverrideModalComponent {
    @Input() visible = false;
    @Input() projectId = '';
    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() overrideSubmit = new EventEmitter<{ reason: string, justification: string }>();

    reasons = [
        { label: 'Intérêt stratégique majeur (Positionnement client)', value: 'STRATEGIC_CLIENT' },
        { label: 'Partenariat exclusif d\'ingénierie (Co-traitant unique)', value: 'CO_CONTRACTOR' },
        { label: 'Réduction négociée des clauses de pénalités', value: 'PENALTY_REDUCTION' },
        { label: 'Marge compensée par un autre projet connexe', value: 'PORTFOLIO_MARGIN' }
    ];

    selectedReason = '';
    justification = '';

    getWordCount(): number {
        if (!this.justification.trim()) return 0;
        return this.justification.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    isValid(): boolean {
        return !!this.selectedReason && this.getWordCount() >= 100;
    }

    close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    submit(): void {
        if (!this.isValid()) return;
        this.overrideSubmit.emit({
            reason: this.selectedReason,
            justification: this.justification.trim()
        });
        this.close();
        this.selectedReason = '';
        this.justification = '';
    }
}
