import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ContractRisk } from '../../../../service/analyse.service';

@Component({
    selector: 'app-risk-evaluator',
    templateUrl: './risk-evaluator.component.html',
    styles: [`
        .risk-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 1.5rem;
            margin-top: 1rem;
        }
        .risk-card {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 1.25rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        .risk-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.05);
        }
        .risk-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .risk-title {
            font-weight: 700;
            color: #1e293b;
            font-size: 0.95rem;
            margin: 0;
        }
        .risk-justif-area {
            width: 100%;
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 0.85rem;
            color: #334155;
            background-color: #f8fafc;
            resize: none;
            transition: border-color 0.2s;
        }
        .risk-justif-area:focus {
            border-color: #85a5ff;
            outline: none;
            background-color: #ffffff;
        }
        .red-alert-card {
            border: 2px solid #ef4444 !important;
            background-color: #FEE2E2;
            animation: pulse-red-border 2s infinite;
        }
        .warning-blinking {
            color: #a12b39;
            background-color: #ffeef0;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid #fca5a5;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: blink-fade 1.5s infinite ease-in-out;
        }
        @keyframes pulse-red-border {
            0% { border-color: #ef4444; }
            50% { border-color: #fca5a5; }
            100% { border-color: #ef4444; }
        }
        @keyframes blink-fade {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `]
})
export class RiskEvaluatorComponent implements OnInit {
    @Input() risks: ContractRisk[] = [];
    @Output() risksChange = new EventEmitter<ContractRisk[]>();

    ngOnInit(): void {
        this.checkRedhibitoire();
    }

    onLevelChange(risk: ContractRisk, newLevel: 'FAIBLE' | 'MODERÉ' | 'ÉLEVÉ' | 'RÉDHIBITOIRE'): void {
        risk.level = newLevel;
        this.checkRedhibitoire();
        this.risksChange.emit(this.risks);
    }

    onJustificationChange(): void {
        this.risksChange.emit(this.risks);
    }

    checkRedhibitoire(): void {
        const hasRed = this.risks.some(r => r.level === 'RÉDHIBITOIRE');
        sessionStorage.setItem('redhibitoireAlert', hasRed ? 'true' : 'false');
    }
}
