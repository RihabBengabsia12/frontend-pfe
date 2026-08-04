import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtractionApoComponent } from './extraction-apo.component';

describe('ExtractionApoComponent', () => {
  let component: ExtractionApoComponent;
  let fixture: ComponentFixture<ExtractionApoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtractionApoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExtractionApoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
