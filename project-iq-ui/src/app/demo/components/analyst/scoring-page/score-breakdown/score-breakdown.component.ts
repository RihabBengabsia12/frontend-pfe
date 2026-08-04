import { Component, Input } from '@angular/core';
import { ScoreBreakdownAxis, ImpactFactor } from '../../../../service/scoring.service';

@Component({
    selector: 'app-score-breakdown',
    templateUrl: './score-breakdown.component.html',
    styles: [`
        .breakdown-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        .axis-row {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
            animation: slideInRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .axis-row:nth-child(1) { animation-delay: 0.1s; }
        .axis-row:nth-child(2) { animation-delay: 0.2s; }
        .axis-row:nth-child(3) { animation-delay: 0.3s; }
        .axis-row:nth-child(4) { animation-delay: 0.4s; }
        .axis-row:nth-child(5) { animation-delay: 0.5s; }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .axis-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.85rem;
            font-weight: 700;
            color: #475569;
        }
        .axis-label {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .axis-badge {
            background-color: #f1f5f9;
            color: #64748b;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 800;
        }
        .axis-val {
            color: #0f172a;
        }
        .progress-bar-bg {
            background-color: #f8fafc;
            height: 4px;
            border-radius: 4px;
            overflow: hidden;
            width: 100%;
        }
        .progress-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .impact-table {
            border: 1px solid #f1f5f9;
            border-radius: 16px;
            overflow: hidden;
            margin-top: 1rem;
            background-color: #ffffff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .impact-row {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            font-size: 0.85rem;
            line-height: 1.4;
        }
        .impact-row:first-child {
            border-bottom: 1px solid #e2e8f0;
        }
        .impact-icon {
            font-size: 1.2rem;
            margin-right: 12px;
            display: flex;
            align-items: center;
        }
        .impact-content {
            flex: 1;
        }
        .impact-title {
            font-weight: 700;
            margin-bottom: 2px;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .impact-text {
            color: #475569;
        }
        .bg-positive {
            background: linear-gradient(to right, #f0fdf4, #ffffff);
            color: #34d399;
        }
        .bg-negative {
            background: linear-gradient(to right, #fef2f2, #ffffff);
            color: #f87171;
        }
    `]
})
export class ScoreBreakdownComponent {
    @Input() axes: ScoreBreakdownAxis[] = [];
    @Input() impacts!: ImpactFactor;

    getAxisColor(score: number): string {
        if (score >= 70) return '#34d399'; // Pastel Emerald
        if (score >= 50) return '#fbbf24'; // Pastel Amber
        return '#f87171'; // Pastel Red
    }
}
