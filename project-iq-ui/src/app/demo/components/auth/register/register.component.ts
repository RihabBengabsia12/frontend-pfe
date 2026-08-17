import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { AuthService } from 'src/app/demo/service/auth.service';

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html',
    styles: [`
        :host ::ng-deep .pi-eye,
        :host ::ng-deep .pi-eye-slash {
            transform: scale(1.6);
            margin-right: 1rem;
            color: #8B5CF6 !important;
        }
        .hourglass-icon i {
            animation: pulse-icon 2s ease-in-out infinite;
        }
        @keyframes pulse-icon {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.15); opacity: 0.75; }
        }
        .pending-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffc107;
            border-radius: 20px;
            padding: 0.35rem 1rem;
            font-size: 0.85rem;
        }
        .badge-dot {
            width: 8px; height: 8px;
            background: #ffc107;
            border-radius: 50%;
            animation: blink-dot 1.2s ease-in-out infinite;
        }
        @keyframes blink-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
        }
        .role-chip {
            background: linear-gradient(135deg, #A78BFA, #FBCFE8);
            color: #fff;
            border-radius: 4px;
            padding: 0.1rem 0.5rem;
            font-size: 0.8rem;
            font-weight: 700;
            letter-spacing: 0.05em;
        }
        .progress-bar-container {
            background: #E2E8F0;
            border-radius: 6px;
            height: 6px;
            overflow: hidden;
        }
        .progress-bar-animated {
            height: 100%;
            width: 40%;
            background: linear-gradient(90deg, #A78BFA, #FBCFE8);
            border-radius: 6px;
            animation: progress-slide 2.5s ease-in-out infinite;
        }
        @keyframes progress-slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
        }
        .error-alert {
            background: #fff5f5;
            color: #c53030;
            border-left: 4px solid #fc8181;
            padding: 1.25rem;
            border-radius: 12px;
            display: flex !important;
            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
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
export class RegisterComponent implements OnInit {

    fullName: string = '';
    email: string = '';
    password: string = '';
    errorMessage: string = '';
    technicalError: string = '';
    isLoading: boolean = false;
    registrationSuccess: boolean = false;
    registeredEmail: string = '';

    constructor(
        public layoutService: LayoutService,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.authService.logout();
    }

    onRegister(): void {
        this.errorMessage = '';

        if (!this.fullName || !this.email || !this.password) {
            this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
            return;
        }

        const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/;
        if (!emailPattern.test(this.email.toLowerCase())) {
            this.errorMessage = 'Veuillez saisir une adresse email valide.';
            return;
        }

        if (this.password.length < 8) {
            this.errorMessage = 'Mot de passe trop court';
            this.technicalError = 'Le mot de passe doit contenir au moins 8 caractères.';
            return;
        }

        const emailPrefix = this.email.split('@')[0].toLowerCase();
        const cleanName = this.fullName.toLowerCase().trim().replace(/\s/g, '');
        const lowPass = this.password.toLowerCase();
        if (lowPass.includes(cleanName) || lowPass.includes(emailPrefix)) {
            this.errorMessage = 'Sécurité insuffisante';
            this.technicalError = 'Le mot de passe ne doit pas contenir votre nom ou votre email.';
            return;
        }

        this.isLoading = true;

        const registerRequest = {
            fullName: this.fullName,
            email: this.email.toLowerCase().trim(),
            password: this.password
        };

        this.authService.register(registerRequest).subscribe({
            next: (response) => {
                this.isLoading = false;
                const res = (response || '').trim();
                console.log('[DEBUG] Full Backend Response:', res);

                // 1. Recherche des codes d'erreur spécifiques dans la réponse
                if (res.includes('CAUSE_EMAIL_EXISTE') || res.toLowerCase().includes('déjà utilisé') || res.toLowerCase().includes('existe')) {
                    this.errorMessage = 'Email déjà utilisé';
                    this.technicalError = 'Cette adresse email est déjà associée à un compte.';
                    return;
                }
                if (res.includes('CAUSE_MDP_COURT') || res.toLowerCase().includes('trop court')) {
                    this.errorMessage = 'Mot de passe trop court';
                    this.technicalError = 'Le mot de passe doit contenir au moins 8 caractères.';
                    return;
                }
                if (res.includes('CAUSE_MDP_TROP_SIMPLE') || res.toLowerCase().includes('trop simple') || res.toLowerCase().includes('sécurité')) {
                    this.errorMessage = 'Sécurité insuffisante';
                    this.technicalError = 'Le mot de passe ne doit pas contenir votre nom ou votre email.';
                    return;
                }

                // 2. Si la réponse contient un message de succès connu
                if (res.toLowerCase().includes('réussie') || res.toLowerCase().includes('success') || res.toLowerCase().includes('attente')) {
                    console.log('Inscription validée par le backend');
                    this.registeredEmail = this.email;
                    sessionStorage.setItem('pendingEmail', this.email);
                    this.registrationSuccess = true;
                    return;
                }

                // 3. Cas imprévu : le backend a répondu quelque chose d'autre
                this.errorMessage = 'Réponse serveur inattendue';
                this.technicalError = `Le serveur a répondu : "${res.substring(0, 100)}..."`;
            },
            error: (err) => {
                console.error('Erreur HTTP inscription :', err);
                this.isLoading = false;
                this.errorMessage = 'Erreur de communication';
                this.technicalError = `Status: ${err.status} - ${err.message || 'Serveur injoignable'}`;
            }
        });
    }

    goToLogin(): void {
        this.router.navigate(['/auth/login']);
    }
}
