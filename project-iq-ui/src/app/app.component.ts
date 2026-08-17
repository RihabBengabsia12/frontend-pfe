import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig, Message } from 'primeng/api';
import { Router } from '@angular/router';
import { PipelineTrackingService } from './demo/service/pipeline-tracking.service';
import { NotificationStateService } from './demo/service/notification-state.service';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

    constructor(
        private primengConfig: PrimeNGConfig,
        private router: Router,
        private pipelineTrackingService: PipelineTrackingService,
        private messageService: MessageService,
        private notificationService: NotificationStateService
    ) { }

    ngOnInit() {
        this.primengConfig.ripple = true;

        // Intercept all toasts globally and redirect them to the bell notification system
        const originalAdd = this.messageService.add.bind(this.messageService);
        this.messageService.add = (message: Message) => {
            this.notificationService.addNotification({
                title: message.summary || 'Information',
                message: message.detail || '',
                type: (message.severity === 'error' ? 'error' : 
                       message.severity === 'success' ? 'success' : 
                       message.severity === 'warn' ? 'warning' : 'info') as any,
                link: message.data?.link,
                action: message.data?.action
            });
        };

        const originalAddAll = this.messageService.addAll.bind(this.messageService);
        this.messageService.addAll = (messages: Message[]) => {
            messages.forEach(msg => this.messageService.add(msg));
        };
    }

    onToastClick(message: Message) {
        if (message.data) {
            if (message.data.action === 'SHOW_PIPELINE_MODAL') {
                this.pipelineTrackingService.showModal();
            }
            if (message.data.link) {
                this.router.navigate([message.data.link]);
            }
        }
    }
}
