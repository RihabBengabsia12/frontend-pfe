package tn.rihab.projectservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import tn.rihab.projectservice.model.entity.Dossier;
import tn.rihab.projectservice.model.entity.ValidationToken;

import jakarta.mail.internet.MimeMessage;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.base-url:http://localhost:4200}")
    private String baseUrl;

    @Value("${spring.mail.username:noreply@egis.fr}")
    private String fromEmail;

    // ── Email de validation ────────────────────────────────────────────────────

    /**
     * Envoie le lien de validation au signataire.
     *
     * @param token   Token généré pour ce validateur
     * @param dossier Dossier à valider
     */
    @Async
    public void sendValidationEmail(ValidationToken token, Dossier dossier) {
        // Lien hybride pour l'approche Dashboard + Notification
        String lienDossier = baseUrl + "/dossiers/" + dossier.getId() + "/validation?token=" + token.getToken();

        String subject = "ProjectIQ — Action requise : GO/NO-GO — " + truncate(dossier.getIntituleOffre(), 60);

        String body = """
            <html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px">
            <div style="background:#0b1f3a;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0;font-size:18px">ProjectIQ — Validation requise</h2>
            </div>
            <div style="padding:24px;background:#f9f8f5;border:1px solid #e0dcd5">
              <p>Bonjour <strong>%s</strong>,</p>
              <p>Votre validation est requise pour le dossier suivant :</p>
              <table style="width:100%%;border-collapse:collapse;margin:16px 0;background:white;border-radius:6px;border:1px solid #e0dcd5">
                <tr><td style="padding:10px;font-weight:500;color:#555;width:35%%">Intitulé</td>
                    <td style="padding:10px">%s</td></tr>
                <tr style="background:#f5f4f0"><td style="padding:10px;font-weight:500;color:#555">Client</td>
                    <td style="padding:10px">%s</td></tr>
                <tr><td style="padding:10px;font-weight:500;color:#555">Pays</td>
                    <td style="padding:10px">%s</td></tr>
                <tr style="background:#f5f4f0"><td style="padding:10px;font-weight:500;color:#555">Budget</td>
                    <td style="padding:10px">%s</td></tr>
                <tr><td style="padding:10px;font-weight:500;color:#555">Score P-Win</td>
                    <td style="padding:10px"><strong>%s%%</strong></td></tr>
                <tr style="background:#f5f4f0"><td style="padding:10px;font-weight:500;color:#555">Date limite</td>
                    <td style="padding:10px">%s</td></tr>
              </table>
              <p style="color:#555">En tant que <strong>%s</strong>, votre approbation est nécessaire pour finaliser la décision GO / NO-GO.</p>
              <div style="margin:28px 0;display:flex;gap:12px">
                <a href="%s" style="display:inline-block;background:#0b1f3a;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:500;font-size:15px">Accéder au dossier →</a>
              </div>
              <p style="font-size:12px;color:#888;margin-top:20px">
                Si vous ne pouvez pas cliquer, copiez ce lien : %s
              </p>
            </div>
            </body></html>
            """.formatted(
                token.getValidateurNom() != null ? token.getValidateurNom() : "Madame/Monsieur",
                dossier.getIntituleOffre(),
                safe(dossier.getClient()),
                safe(dossier.getPays()),
                safe(dossier.getBudgetGlobal()),
                dossier.getPwinScore() != null ? String.format("%.1f", dossier.getPwinScore()) : "N/A",
                dossier.getDtLimSoum() != null ? dossier.getDtLimSoum().toString() : "N/A",
                token.getValidateurRole(),
                lienDossier,
                lienDossier
        );

        sendHtml(token.getValidateurEmail(), subject, body);
    }

    // ── Email de relance ────────────────────────────────────────────────────────

    @Async
    public void sendReminderEmail(ValidationToken token, Dossier dossier) {
        String lien = baseUrl + "/validate/" + token.getToken();
        String subject = "⏰ Rappel — Validation en attente : " + truncate(dossier.getIntituleOffre(), 50);

        String body = """
            <html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px">
            <div style="background:#854F0B;padding:16px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0;font-size:16px">⏰ Rappel — Validation en attente</h2>
            </div>
            <div style="padding:24px;background:#f9f8f5;border:1px solid #e0dcd5">
              <p>Bonjour <strong>%s</strong>,</p>
              <p>Votre validation pour le dossier <strong>%s</strong> est toujours en attente.<br>
              La date limite de soumission est le <strong>%s</strong>.</p>
              <a href="%s" style="display:inline-block;background:#0b1f3a;color:white;padding:12px 24px;
                border-radius:6px;text-decoration:none;font-weight:500;margin-top:16px">
                Accéder au dossier →
              </a>
            </div>
            </body></html>
            """.formatted(
                token.getValidateurNom() != null ? token.getValidateurNom() : "Madame/Monsieur",
                truncate(dossier.getIntituleOffre(), 80),
                dossier.getDtLimSoum() != null ? dossier.getDtLimSoum() : "N/A",
                lien
        );

        sendHtml(token.getValidateurEmail(), subject, body);
    }

    // ── Alerte NO-GO IA (Manager) ───────────────────────────────────────────────

    @Async
    public void sendManagerAiNoGoAlert(String managerEmail, String role, Dossier dossier, double pwinScore) {
        String lienDecision = baseUrl + "/dossiers/" + dossier.getId() + "/scoring-decision";
        String subject = "⚠️ ProjectIQ — L'IA a refusé un dossier — Arbitrage requis : " + truncate(dossier.getIntituleOffre(), 50);

        String body = """
            <html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px">
            <div style="background:#E24B4A;padding:16px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0;font-size:16px">⚠️ ProjectIQ — Alerte NO-GO IA</h2>
            </div>
            <div style="padding:24px;background:#f9f8f5;border:1px solid #e0dcd5">
              <p>Bonjour Monsieur/Madame le <strong>%s</strong>,</p>
              <p>L'Intelligence Artificielle a analysé le dossier <strong>%s</strong> et a calculé un score de probabilité de victoire (P-Win) de <strong>%s%%</strong>.</p>
              <p>Ce score étant inférieur au seuil de rentabilité, l'IA recommande l'abandon de cette offre (NO-GO).</p>
              <p>En tant que responsable de ce budget (%s), votre arbitrage est requis pour statuer :</p>
              <ul>
                 <li><strong>Confirmer le NO-GO</strong> : Abandonner le projet (génère le rapport de refus officiel).</li>
                 <li><strong>Forcer le GO</strong> : Outrepasser l'IA si le projet est stratégique (justification requise).</li>
              </ul>
              <a href="%s" style="display:inline-block;background:#E24B4A;color:white;padding:12px 24px;
                border-radius:6px;text-decoration:none;font-weight:500;margin-top:16px">
                Consulter le rapport de l'IA et statuer →
              </a>
            </div>
            </body></html>
            """.formatted(
                role,
                dossier.getIntituleOffre(),
                String.format("%.1f", pwinScore),
                safe(dossier.getBudgetGlobal()),
                lienDecision
        );

        sendHtml(managerEmail, subject, body);
    }

    // ── Notification analyste ───────────────────────────────────────────────────

    @Async
    public void sendAnalysteNotification(String email, Dossier dossier, String message) {
        String subject = "ProjectIQ — " + message + " : " + truncate(dossier.getIntituleOffre(), 60);
        String body = """
            <html><body style="font-family:Arial,sans-serif">
            <p>%s</p>
            <p>Dossier : <strong>%s</strong></p>
            <p><a href="%s/dossiers/%s">Voir le dossier →</a></p>
            </body></html>
            """.formatted(message, dossier.getIntituleOffre(), baseUrl, dossier.getId());
        sendHtml(email, subject, body);
    }

    // ── Utilitaire d'envoi ──────────────────────────────────────────────────────

    private void sendHtml(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("[Email] Envoyé à {} : {}", to, subject);
        } catch (Exception e) {
            log.error("[Email] Échec envoi à {} : {}", to, e.getMessage(), e);
        }
    }

    private String safe(String v) { return v != null ? v : "N/A"; }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}