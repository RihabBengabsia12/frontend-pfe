import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-pwin-gauge',
    templateUrl: './pwin-gauge.component.html',
    styles: [`
        .gauge-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            width: 220px;
            height: 220px;
            margin: 0 auto;
        }
        .gauge-svg {
            transform: rotate(-90deg);
            width: 100%;
            height: 100%;
        }
        .gauge-bg {
            fill: none;
            stroke: #f8fafc;
            stroke-width: 6px;
        }
        .gauge-fill {
            fill: none;
            stroke-width: 6px;
            stroke-linecap: round;
            transition: stroke-dashoffset 2s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.8s ease;
        }
        .gauge-text-container {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .gauge-percentage {
            font-size: 3.5rem;
            font-weight: 300;
            color: #1e293b;
            line-height: 1;
            font-family: 'Outfit', 'Inter', sans-serif;
            text-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .gauge-label {
            font-size: 0.8rem;
            font-weight: 500;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 8px;
        }
    `]
})
export class PwinGaugeComponent implements OnChanges {
    @Input() score: number = 0;
    @Input() goThreshold: number = 70;
    @Input() nogoThreshold: number = 50;

    strokeDasharray = 2 * Math.PI * 80; // Radius = 80
    strokeDashoffset = 2 * Math.PI * 80;
    strokeColor = '#ef4444'; // default red

    ngOnChanges(changes: SimpleChanges): void {
        this.updateGauge();
    }

    updateGauge(): void {
        // Calculate offset
        const percentage = Math.min(Math.max(this.score, 0), 100);
        const radius = 80;
        const circumference = 2 * Math.PI * radius;
        this.strokeDasharray = circumference;
        
        // Wait a small timeout to trigger the entrance transition smoothly
        setTimeout(() => {
            this.strokeDashoffset = circumference - (percentage / 100) * circumference;
        }, 100);

        // Determine color based on threshold boundaries (Pastel shades)
        if (this.score >= this.goThreshold) {
            this.strokeColor = '#34d399'; // Pastel Emerald
        } else if (this.score >= this.nogoThreshold) {
            this.strokeColor = '#fbbf24'; // Pastel Amber
        } else {
            this.strokeColor = '#f87171'; // Pastel Red
        }
    }
}
