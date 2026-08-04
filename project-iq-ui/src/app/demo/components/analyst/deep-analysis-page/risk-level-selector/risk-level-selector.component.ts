import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
    selector: 'app-risk-level-selector',
    templateUrl: './risk-level-selector.component.html',
    styles: [`
        .risk-selector-container {
            display: flex;
            border-radius: 20px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            padding: 2px;
            background-color: #f1f5f9;
        }
        .risk-btn {
            border: none;
            outline: none;
            padding: 8px 16px;
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            background: transparent;
            color: #64748b;
            border-radius: 18px;
            text-transform: uppercase;
        }
        .risk-btn:hover {
            background-color: rgba(203, 213, 225, 0.5);
        }
        .btn-faible.active {
            background-color: #e2f3eb;
            color: #2d6a4f;
            box-shadow: 0 2px 4px rgba(45, 106, 79, 0.1);
        }
        .btn-modere.active {
            background-color: #fff8e7;
            color: #b5822f;
            box-shadow: 0 2px 4px rgba(181, 130, 47, 0.1);
        }
        .btn-eleve.active {
            background-color: #ffeedb;
            color: #c2410c;
            box-shadow: 0 2px 4px rgba(194, 65, 12, 0.1);
        }
        .btn-redhibitoire.active {
            background-color: #ffeef0;
            color: #a12b39;
            box-shadow: 0 2px 4px rgba(161, 43, 57, 0.1);
            animation: pulse-border-red 2s infinite;
        }
        @keyframes pulse-border-red {
            0% { box-shadow: 0 0 0 0 rgba(161, 43, 57, 0.4); }
            70% { box-shadow: 0 0 0 6px rgba(161, 43, 57, 0); }
            100% { box-shadow: 0 0 0 0 rgba(161, 43, 57, 0); }
        }
    `]
})
export class RiskLevelSelectorComponent {
    @Input() level: 'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE' = 'FAIBLE';
    @Output() levelChange = new EventEmitter<'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE'>();

    selectLevel(newLevel: 'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE'): void {
        this.level = newLevel;
        this.levelChange.emit(newLevel);
    }
}
