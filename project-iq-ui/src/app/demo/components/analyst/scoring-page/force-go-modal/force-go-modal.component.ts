import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-force-go-modal',
    templateUrl: './force-go-modal.component.html',
    styles: [`
        .modal-body {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            padding-top: 1rem;
        }
        .signature-input {
            font-family: 'Courier New', Courier, monospace;
            font-weight: bold;
            font-size: 1.1rem;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
    `]
})
export class ForceGoModalComponent {
    @Input() visible = false;
    @Input() projectId = '';
    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() overruleConfirm = new EventEmitter<{ signature: string, comment: string }>();

    signature = '';
    comment = '';

    close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    confirm(): void {
        if (!this.signature.trim() || !this.comment.trim()) return;
        this.overruleConfirm.emit({
            signature: this.signature.trim(),
            comment: this.comment.trim()
        });
        this.close();
        this.signature = '';
        this.comment = '';
    }
}
