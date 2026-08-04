import { Component } from '@angular/core';
import { ExtractionApoComponent } from './extraction-apo/extraction-apo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ExtractionApoComponent],
  template: '<app-extraction-apo></app-extraction-apo>'
})
export class AppComponent {
  title = 'projectIQ-frontend';
}