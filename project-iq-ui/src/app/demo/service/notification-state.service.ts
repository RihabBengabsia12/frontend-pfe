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
    link?: string; detail?: string;
    action?: string;
    silent?: boolean;
    /** Si true, s'affiche dans la cloche. Si false/absent, c'est un simple toast interne. */
    showInBell?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
    private notificationsSubj = new BehaviorSubject<AppNotification[]>([]);
    notifications$ = this.notificationsSubj.asObservable();
    private readonly STORAGE_KEY = 'projectiq_notifications';

    constructor(private messageService: MessageService) {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        const stored = sessionStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Restaurer les objets Date
                const notifs = parsed.map((n: any) => ({ ...n, time: new Date(n.time) }));
                this.notificationsSubj.next(notifs);
                return;
            } catch (e) {
                console.error('Erreur parsing notifications', e);
            }
        }
        
        // Si vide ou erreur, mettre la notif de bienvenue
        this.notificationsSubj.next([
            {
                id: 'welcome-1',
                title: 'Bienvenue sur ProjectIQ',
                message: 'Votre espace de travail intelligent est prêt.',
                time: new Date(),
                read: true,
                type: 'info',
                showInBell: true
            }
        ]);
    }

    private saveToStorage(notifs: AppNotification[]) {
        // Garder uniquement les 50 dernières notifications pour ne pas saturer le sessionStorage
        const recentNotifs = notifs.slice(0, 50);
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentNotifs));
    }

    addNotification(notif: Omit<AppNotification, 'id' | 'read' | 'time'>) {
        const current = this.notificationsSubj.getValue();
        const newNotif: AppNotification = {
            ...notif,
            id: Math.random().toString(36).substring(2, 9),
            time: new Date(),
            read: false
        };
        const updated = [newNotif, ...current];
        this.notificationsSubj.next(updated);
        this.saveToStorage(updated);
    }

    /** Raccourci pour les vraies notifs importantes (affichées dans la cloche) */
    addBellNotification(notif: Omit<AppNotification, 'id' | 'read' | 'time' | 'showInBell'>) {
        this.addNotification({ ...notif, showInBell: true });
    }

    /** Notifications filtrées pour la cloche uniquement */
    get bellNotifications$() {
        return new BehaviorSubject<AppNotification[]>(
            this.notificationsSubj.getValue().filter(n => n.showInBell !== false)
        ).asObservable();
    }

    markAllAsRead() {
        const current = this.notificationsSubj.getValue();
        const updated = current.map(n => ({ ...n, read: true }));
        this.notificationsSubj.next(updated);
        this.saveToStorage(updated);
    }

    removeByTitles(titles: string[]) {
        const updated = this.notificationsSubj.getValue().filter(n => !titles.includes(n.title));
        this.notificationsSubj.next(updated);
        this.saveToStorage(updated);
    }

    removeByAction(action: string) {
        const updated = this.notificationsSubj.getValue().filter(n => n.action !== action);
        this.notificationsSubj.next(updated);
        this.saveToStorage(updated);
    }
}
