// ContractDetailsComponent
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ContractField } from '../../../../service/analyse.service';

@Component({
    selector: 'app-contract-details',
    templateUrl: './contract-details.component.html',
    styleUrls: ['./contract-details.component.scss']
})
export class ContractDetailsComponent {
    @Input() fields: ContractField[] = [];
    @Input() selectedFieldId = '';
    @Output() selectedFieldIdChange = new EventEmitter<string>();
    @Output() fieldsChange = new EventEmitter<ContractField[]>();
    @Output() validateField = new EventEmitter<ContractField>();

    selectField(id: string): void {
        this.selectedFieldId = id;
        this.selectedFieldIdChange.emit(id);
    }

    onEdit(field: ContractField): void {
        field.status = 'human';
        this.fieldsChange.emit(this.fields);
    }

    onValidate(field: ContractField, event: Event): void {
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
}
