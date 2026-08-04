import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AuthService } from 'src/app/demo/service/auth.service';
import { MessageService } from 'primeng/api';
import { DelegationService } from 'src/app/demo/service/delegation.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styles: [`
        :host ::ng-deep .pi-eye,
        :host ::ng-deep .pi-eye-slash {
            transform: scale(1.6);
            margin-right: 1rem;
            color: #8B5CF6 !important;
        }
        .pending-banner {
            animation: slide-down 0.4s ease-out;
        }
        @keyframes slide-down {
            from { transform: translateY(-20px); opacity: 0; }
            to   { transform: translateY(0);     opacity: 1; }
        }
        .banner-dot {
            width: 10px; height: 10px;
            background: #e65100;
            border-radius: 50%;
            animation: blink-dot 1.2s ease-in-out infinite;
            flex-shrink: 0;
        }
        @keyframes blink-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
        }
        
        /* --- Pastel SaaS Theme --- */
        .login-bg {
            background-color: #FAFAFC;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E");
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px);
            border-radius: 53px;
        }
        :host ::ng-deep .btn-primary-saas {
            position: relative !important;
            overflow: hidden !important;
            background: linear-gradient(135deg, #A78BFA 0%, #FBCFE8 50%, #93C5FD 100%) !important;
            background-size: 200% 200% !important;
            animation: gradientFlow 5s ease infinite !important;
            border: none !important;
            border-radius: 9999px !important;
            color: white !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 15px rgba(167, 139, 250, 0.3) !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            padding: 1rem 2.5rem !important;
        }
        @keyframes gradientFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        :host ::ng-deep .btn-primary-saas:hover {
            transform: translateY(-2px) scale(1.02) !important;
            box-shadow: 0 8px 25px rgba(167, 139, 250, 0.5) !important;
        }
    `]
})
export class LoginComponent implements OnInit {

    email: string = '';
    password: string = '';
    rememberMe: boolean = false;
    isLoading: boolean = false;
    showPendingBanner: boolean = false;
    errorMessage: string = '';

    // Forgot Password
    displayForgotDialog: boolean = false;
    forgotEmail: string = '';
    isSendingForgot: boolean = false;

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private router: Router,
        private messageService: MessageService,
        private delegationService: DelegationService
    ) { }

    ngOnInit(): void {
        // Pré-remplir l'email si "Remember me" était coché
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            this.email = savedEmail;
            this.rememberMe = true;
        }

        // Nettoyer toute session existante quand on arrive sur la page login
        this.authService.logout();
    }

    onLogin(): void {
        this.showPendingBanner = false;
        this.errorMessage = '';

        if (!this.email || !this.password) {
            this.errorMessage = 'Veuillez saisir votre email et votre mot de passe.';
            return;
        }

        // 🔍 Validation du format email
        const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/;
        if (!emailPattern.test(this.email.toLowerCase())) {
            this.errorMessage = 'Veuillez saisir une adresse email valide (ex: nom@domaine.com).';
            return;
        }

        this.isLoading = true;

        this.authService.login({ email: this.email, password: this.password }).subscribe({
            next: (response) => {

                this.isLoading = false;
                console.log('[LOGIN] Response:', response);

                // Détecter le rôle (roleCode ou role)
                const role = (response.roleCode || response.role || 'GUEST').toUpperCase();
                console.log('[LOGIN] Rôle identifié:', role);
                
                if (role === 'GUEST' || role === 'PENDING') {
                    this.showPendingBanner = true;
                    this.messageService.add({
                        severity: 'error',
                        summary: '🚫 En attente de validation',
                        detail: 'Votre compte est en attente de validation par un administrateur.',
                        life: 15000,
                        closable: false
                    });
                    return;
                }
                
                // VALID users only
                this.authService.setSession(response);

                // Gérer le "Remember me"
                if (this.rememberMe) {
                    localStorage.setItem('rememberedEmail', this.email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }
                
                const routes: { [key: string]: string } = {
                    'ADMIN': '/admin/users',
                    'USER': '/dashboard',
                    'ANALYST': '/analyst/dashboard'
                };
                
                if (role === 'MANAGER') {
                    const FALLBACK_VIPS = ['do@t2i.tn', 'do@st2i.tn', 'dda@st2i.tn', 'dga@st2i.tn', 'pdg@st2i.tn'];
                    const isHardcodedVip = FALLBACK_VIPS.includes(this.email.toLowerCase());

                    this.delegationService.getAllDelegations().subscribe({
                        next: (delegations) => {
                            const vipEmails = delegations.map(d => d.email?.toLowerCase());
                            if (vipEmails.includes(this.email.toLowerCase()) || isHardcodedVip) {
                                this.router.navigate(['/manager/decisions-finales']);
                            } else {
                                this.router.navigate(['/manager/dashboard']);
                            }
                        },
                        error: () => {
                            // En cas d'erreur backend, on utilise la liste de secours
                            if (isHardcodedVip) {
                                this.router.navigate(['/manager/decisions-finales']);
                            } else {
                                this.router.navigate(['/manager/dashboard']);
                            }
                        }
                    });
                    return;
                }

                const targetRoute = routes[role];
                if (!targetRoute) {
                    this.showPendingBanner = true;
                    this.messageService.add({
                        severity: 'error',
                        summary: '🚫 Accès refusé',
                        detail: 'Rôle inconnu : ' + role,
                        life: 10000
                    });
                } else {
                    this.router.navigate([targetRoute]);
                }




            },
            error: (err) => {
                this.isLoading = false;

                // 🔴 Gestion du compte REFUSÉ (Status 403 + Message spécifique)
                const errorStr = typeof err.error === 'string' ? err.error : '';
                if (err.status === 403 && (errorStr.includes('refusé') || err.error?.message?.includes('refusé'))) {
                    this.errorMessage = 'Votre compte a été refusé par l\'administration.';
                    return;
                }

                if (err.status === 401 || err.status === 403) {
                    this.showPendingBanner = true;
                    // Auto-fill email from pending register
                    const pendingEmail = localStorage.getItem('pendingEmail');
                    if (pendingEmail) {
                        this.email = pendingEmail;
                        localStorage.removeItem('pendingEmail');
                    }
                } else {
                    let msg = err.error?.message || err.error?.error;
                    if (!msg && typeof err.error === 'string') {
                        msg = err.error;
                    }
                    this.errorMessage = msg || 'Email ou mot de passe incorrect.';
                }
            }
        });
    }

    onForgotPassword(): void {
        if (!this.forgotEmail) {
            this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Veuillez saisir votre email' });
            return;
        }

        this.isSendingForgot = true;
        this.authService.forgotPassword(this.forgotEmail).subscribe({
            next: (res) => {
                this.isSendingForgot = false;
                this.displayForgotDialog = false;
                this.messageService.add({ 
                    severity: 'success', 
                    summary: 'Envoyé !', 
                    detail: 'Si votre email existe, vous recevrez des instructions.' 
                });
            },
            error: (err) => {
                this.isSendingForgot = false;
                this.messageService.add({ 
                    severity: 'error', 
                    summary: 'Erreur', 
                    detail: err.error?.message || 'Une erreur est survenue.' 
                });
            }
        });
    }

}
