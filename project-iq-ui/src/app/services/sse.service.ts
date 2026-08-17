import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface PipelineEvent {
  type: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class SseService {
  private eventSource: EventSource | null = null;
  private sseSubject = new Subject<PipelineEvent>();

  constructor(private zone: NgZone) {}

  connect(dossierId: string): void {
    if (this.eventSource) {
      this.disconnect(dossierId);
    }

    // Connect to analyste-service stream endpoint (proxied via proxy.conf.json)
    const url = `/api/analyses/stream/${dossierId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = (event) => {
      console.log('SSE connection opened:', event);
    };

    const events = [
      'INIT', 'PIPELINE_START', 'DATA_LOADED', 'PHASE2_COMPLETED',
      'RISKS_COMPLETED', 'PWIN_COMPLETED', 'PIPELINE_STOPPED_NOGO',
      'MATCHING_COMPLETED', 'APO_COMPLETED', 'PIPELINE_COMPLETED', 'PIPELINE_ERROR',
      'PIPELINE_PAUSED_FOR_VALIDATION', 'RECALCUL_START', 'RECALCUL_COMPLETED', 'GENERATION_START',
      'APO_GENERATED'
    ];

    events.forEach(eventName => {
      this.eventSource?.addEventListener(eventName, (event: any) => {
        this.zone.run(() => {
          let parsedData = event.data;
          try {
            parsedData = JSON.parse(event.data);
          } catch (e) {
            // Keep as string if not JSON
          }
          this.sseSubject.next({ type: eventName, data: parsedData });
        });
      });
    });

    this.eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      this.zone.run(() => {
        this.sseSubject.next({ type: 'ERROR', data: error });
      });
      // Optionally disconnect on error
      // this.disconnect();
    };
  }

  getEvents(): Observable<PipelineEvent> {
    return this.sseSubject.asObservable();
  }

  getEventSubject(): Observable<PipelineEvent> {
    return this.sseSubject.asObservable();
  }

  disconnect(projectId?: string): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
