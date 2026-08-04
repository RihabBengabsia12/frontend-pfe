import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LayoutService } from 'src/app/layout/service/app.layout.service';

@Component({
    selector: 'app-landing',
    templateUrl: './landing.component.html',
    styles: [`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@700;900&display=swap');

        /* --- FOND PASTEL PRO (Mesh Gradient + Noise) --- */
        .landing-bg {
            background-color: #FAFAFC;
            /* Subtle noise texture */
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.04'/%3E%3C/svg%3E");
            color: #0F172A;
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            font-family: 'Inter', sans-serif;
        }

        /* Blobs très doux */
        .blob {
            position: absolute;
            filter: blur(100px);
            z-index: 0;
            opacity: 0.18;
            animation: floatPro 20s infinite ease-in-out alternate;
        }
        .blob-1 {
            width: 70vw; height: 70vw;
            max-width: 800px; max-height: 800px;
            background: radial-gradient(circle, #C4B5FD 0%, transparent 70%);
            top: -10%; left: -10%;
        }
        .blob-2 {
            width: 80vw; height: 80vw;
            max-width: 900px; max-height: 900px;
            background: radial-gradient(circle, #FBCFE8 0%, transparent 70%);
            bottom: -20%; right: -10%;
            animation-delay: -7s;
        }
        .blob-3 {
            width: 60vw; height: 60vw;
            max-width: 700px; max-height: 700px;
            background: radial-gradient(circle, #BFDBFE 0%, transparent 70%);
            top: 40%; left: 30%;
            animation-duration: 25s;
        }
        
        @keyframes floatPro {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(50px, 40px) scale(1.05); }
            100% { transform: translate(-40px, 50px) scale(0.95); }
        }

        .content-wrapper, .marquee-container {
            position: relative;
            z-index: 1;
        }

        /* Header transparent/blur */
        .glass-header {
            background: rgba(255, 255, 255, 0.4);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.5);
            transition: all 0.3s ease;
        }

        /* --- TYPOGRAPHIE --- */
        .hero-title-pro {
            font-family: 'Inter', sans-serif;
            font-size: clamp(3.5rem, 6vw, 4.5rem);
            font-weight: 300;
            letter-spacing: -0.5px;
            line-height: 1.1;
            color: #475569;
        }

        .text-secondary {
            color: #94A3B8;
            font-size: 1.25rem;
            line-height: 1.6;
            font-weight: 300;
            font-family: 'Inter', sans-serif;
            letter-spacing: 0.3px;
        }

        .hero-highlight {
            font-weight: 400;
            background: linear-gradient(110deg, #A78BFA, #FBCFE8, #93C5FD, #A78BFA);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shinePro 8s linear infinite;
        }

        @keyframes shinePro {
            to { background-position: -200% center; }
        }

        /* --- BADGE --- */
        .pro-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2));
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            padding: 8px 24px;
            border-radius: 9999px;
            box-shadow: 0 4px 20px rgba(167, 139, 250, 0.15);
            animation: badgeFloat 4s ease-in-out infinite;
        }

        @keyframes badgeFloat {
            0%, 100% { transform: translateY(0); box-shadow: 0 4px 20px rgba(167, 139, 250, 0.1); }
            50% { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(251, 207, 232, 0.25); }
        }

        .badge-text-animated {
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
            background: linear-gradient(90deg, #A78BFA, #FBCFE8, #93C5FD, #A78BFA);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shinePro 4s linear infinite;
        }

        .sparkle-icon {
            color: #A78BFA;
            animation: sparkle-anim 3s infinite;
        }
        @keyframes sparkle-anim {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }

        /* --- BOUTONS --- */
        .btn-primary-saas {
            position: relative !important;
            overflow: hidden !important;
            background: linear-gradient(135deg, #A78BFA 0%, #FBCFE8 50%, #93C5FD 100%) !important;
            background-size: 200% 200% !important;
            animation: gradientFlow 5s ease infinite !important;
            border: none !important;
            border-radius: 9999px !important;
            color: white !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 15px rgba(167, 139, 250, 0.3), inset 0 2px 0 rgba(255,255,255,0.3) !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            padding: 1rem 2.5rem !important;
        }
        @keyframes gradientFlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .btn-primary-saas::after {
            content: '';
            position: absolute;
            top: 0; left: -100%; width: 50%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            transform: skewX(-20deg);
            transition: none;
        }
        .btn-primary-saas:hover::after {
            left: 150%;
            transition: 0.7s ease-in-out;
        }
        .btn-primary-saas:hover {
            transform: translateY(-2px) scale(1.02) !important;
            box-shadow: 0 8px 25px rgba(167, 139, 250, 0.5), inset 0 2px 0 rgba(255,255,255,0.4) !important;
        }

        :host ::ng-deep button.p-button.btn-secondary-saas {
            background: #F5F3FF !important;
            backdrop-filter: none !important;
            border: 1px solid #C4B5FD !important;
            border-radius: 9999px !important;
            color: #7C3AED !important;
            font-weight: 600 !important;
            box-shadow: 0 2px 8px rgba(124, 58, 237, 0.05) !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            padding: 1rem 2.5rem !important;
        }
        :host ::ng-deep button.p-button.btn-secondary-saas .p-button-label,
        :host ::ng-deep button.p-button.btn-secondary-saas .p-button-icon {
            color: #7C3AED !important;
        }
        :host ::ng-deep button.p-button.btn-secondary-saas:hover {
            transform: translateY(-2px) scale(1.02) !important;
            background: #EDE9FE !important;
            border-color: #A78BFA !important;
            box-shadow: 0 6px 16px rgba(124, 58, 237, 0.15) !important;
        }
        
        /* Micro-animations des icônes de bouton PrimeNG */
        :host ::ng-deep .btn-primary-saas:hover .p-button-icon {
            transform: translateX(4px);
            transition: transform 0.3s ease;
        }
        :host ::ng-deep .btn-secondary-saas:hover .p-button-icon {
            transform: translateY(4px);
            transition: transform 0.3s ease;
        }

        /* --- MARQUEE PILLS --- */
        .marquee-container {
            width: 100%;
            overflow: hidden;
            padding: 2rem 0;
            display: flex;
            margin-top: 4rem;
            -webkit-mask-image: linear-gradient(90deg, transparent, black 15%, black 85%, transparent);
            mask-image: linear-gradient(90deg, transparent, black 15%, black 85%, transparent);
        }
        .marquee-content {
            display: flex;
            white-space: nowrap;
            animation: marqueePro 40s linear infinite;
            gap: 2rem;
            padding-left: 2rem;
        }
        .marquee-pill {
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 9999px;
            padding: 0.75rem 1.5rem;
            color: #0F172A;
            font-weight: 600;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            letter-spacing: -0.2px;
        }
        .marquee-icon {
            background: linear-gradient(135deg, #8B5CF6, #EC4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        @keyframes marqueePro {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }

        /* --- CARTES --- */
        .glass-card {
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.6);
            border-top: 1px solid rgba(255, 255, 255, 1);
            border-radius: 24px;
            box-shadow: 0 10px 40px rgba(139, 92, 246, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
            transform: translateY(-8px);
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 24px 48px rgba(139, 92, 246, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 1);
        }
        .glass-card h3 {
            font-family: 'Space Grotesk', sans-serif;
            color: #0F172A;
            letter-spacing: -0.5px;
        }
        .glass-card p {
            color: #64748B;
            font-family: 'Inter', sans-serif;
        }

        .glass-card .border-circle {
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
        }
        .glass-card:hover .border-circle {
            transform: scale(1.15) translateY(-5px);
            box-shadow: 0 15px 25px rgba(139, 92, 246, 0.15);
        }

        /* --- ANIMATIONS CASCADE --- */
        .reveal-text {
            animation: revealBlur 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(30px);
            filter: blur(8px);
        }
        @keyframes revealBlur {
            0% { opacity: 0; transform: translateY(30px); filter: blur(8px); }
            100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.25s; }
        .stagger-3 { animation-delay: 0.4s; }
        .stagger-4 { animation-delay: 0.55s; }

        /* --- LOGO --- */
        .logo-text-gradient {
            background: linear-gradient(135deg, #A78BFA, #FBCFE8, #93C5FD);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shinePro 8s linear infinite;
            background-size: 200% auto;
        }
        
        .logo-img {
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .logo-link:hover .logo-img {
            transform: scale(1.08) rotate(-3deg);
        }
    `]
})
export class LandingComponent {
    constructor(public layoutService: LayoutService, public router: Router) { }
}
