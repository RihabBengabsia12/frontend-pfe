import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({
    selector: 'app-weight-sliders',
    templateUrl: './weight-sliders.component.html',
    styles: [`
        .sliders-card {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        .slider-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.5rem;
            flex-wrap: wrap;
        }
        .slider-info {
            flex: 1;
            min-width: 150px;
        }
        .slider-name {
            font-weight: 700;
            color: #1e293b;
            font-size: 0.85rem;
        }
        .slider-desc {
            font-size: 0.75rem;
            color: #64748b;
            margin-top: 2px;
        }
        .slider-control {
            display: flex;
            align-items: center;
            gap: 1rem;
            width: 250px;
        }
        .pastel-range-input {
            flex: 1;
            height: 6px;
            background: #cbd5e1;
            outline: none;
            border-radius: 3px;
            cursor: pointer;
            accent-color: #4a90e2;
        }
        .slider-val-badge {
            font-size: 0.8rem;
            font-weight: 800;
            color: #1e293b;
            background-color: #f1f5f9;
            padding: 4px 8px;
            border-radius: 6px;
            min-width: 45px;
            text-align: center;
        }
    `]
})
export class WeightSlidersComponent implements OnChanges {
    @Input() a = 25;
    @Input() b = 25;
    @Input() c = 20;
    @Input() d = 15;
    @Input() e = 15;
    @Output() weightsChange = new EventEmitter<{a: number, b: number, c: number, d: number, e: number}>();

    ngOnChanges(changes: SimpleChanges): void {
        this.emitChanges();
    }

    onSliderChange(): void {
        this.emitChanges();
    }

    emitChanges(): void {
        this.weightsChange.emit({
            a: Number(this.a),
            b: Number(this.b),
            c: Number(this.c),
            d: Number(this.d),
            e: Number(this.e)
        });
    }
}
