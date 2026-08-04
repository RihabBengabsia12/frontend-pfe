// EligibilityPanelComponent
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EligibilityField } from '../../../../service/analyse.service';

@Component({
    selector: 'app-eligibility-panel',
    templateUrl: './eligibility-panel.component.html',
    styleUrls: ['./eligibility-panel.component.scss']
})
export class EligibilityPanelComponent {
    @Input() fields: EligibilityField[] = [];
    @Input() selectedFieldId = '';
    @Output() selectedFieldIdChange = new EventEmitter<string>();
    @Output() fieldsChange = new EventEmitter<EligibilityField[]>();
    @Output() validateField = new EventEmitter<EligibilityField>();

    selectField(id: string): void {
        this.selectedFieldId = id;
        this.selectedFieldIdChange.emit(id);
    }

    onEdit(field: EligibilityField): void {
        field.status = 'human';
        this.fieldsChange.emit(this.fields);
    }

    onValidate(field: EligibilityField, event: Event): void {
        event.stopPropagation();
        this.validateField.emit(field);
    }

    getConfidenceClass(conf: number): string {
        if (conf >= 85) return 'pill-high';
        if (conf >= 60) return 'pill-med';
        return 'pill-low';
    }

    getConfBorderClass(conf: number): string {
        if (conf >= 85) return 'conf-high';
        if (conf >= 60) return 'conf-med';
        return 'conf-low';
    }

    getGapClass(gap?: string): string {
        if (!gap) return 'gap-ok';
        const g = gap.toLowerCase();
        if (g.includes('couvert') || g.includes('ok') || g.includes('100')) return 'gap-ok';
        if (g.includes('partiel') || g.includes('50') || g.includes('60')) return 'gap-warn';
        return 'gap-ko';
    }
}
