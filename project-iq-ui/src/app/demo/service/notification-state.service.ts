import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MessageService } from 'primeng/api';

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    time: Date;
    read: boolean;
    type: 'success' | 'info' | 'warning' | 'error';
    link?: string;
    action?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
    constructor(private messageService: MessageService) {}

    private notificationsSubj = new BehaviorSubject<AppNotification[]>([
        {
            id: 'welcome-1',
            title: 'Bienvenue sur ProjectIQ',
            message: 'Votre espace de travail intelligent est prêt.',
            time: new Date(),
            read: true,
            type: 'info'
        }
    ]);
    notifications$ = this.notificationsSubj.asObservable();

    addNotification(notif: Omit<AppNotification, 'id' | 'read' | 'time'>) {
        const current = this.notificationsSubj.getValue();
        const newNotif: AppNotification = {
            ...notif,
            id: Math.random().toString(36).substring(2, 9),
            time: new Date(),
            read: false
        };
        // Ajouter en haut de la liste
        this.notificationsSubj.next([newNotif, ...current]);

        // Déclencher la notification visuelle (Toast)
        this.messageService.add({
            severity: notif.type === 'warning' ? 'warn' : notif.type,
            summary: notif.title,
            detail: notif.message,
            life: 6000
        });
    }

    markAllAsRead() {
        const current = this.notificationsSubj.getValue();
        const updated = current.map(n => ({ ...n, read: true }));
        this.notificationsSubj.next(updated);
    }
}
