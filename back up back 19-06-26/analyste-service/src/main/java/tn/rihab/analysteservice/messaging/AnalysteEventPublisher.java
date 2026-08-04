package tn.rihab.analysteservice.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import tn.rihab.analysteservice.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publie des événements depuis analyste-service vers project-service.
 * Version hautement professionnelle utilisant Jackson pour la structure des payloads.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AnalysteEventPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper; // 🚀 Injecté automatiquement par Spring

    // ── Structures de données (Payloads) fortement typées ──────────────────────

    public record ScoringPayload(double pwinScore, String decision) {}

    public record MatchingPayload(double tauxCompetences, double tauxExperts) {}

    public record ApoPayload(String apoDocxPath, String methodoPath, String rapportPath, String packZipPath) {}

    public record AuditPayload(String auditReportPath) {}

    // ── Méthodes de publication ────────────────────────────────────────────────

    public void publishScoringCompleted(UUID dossierId, double pwinScore, String decision) {
        // 🚀 Création de l'objet propre au lieu d'une String manuelle
        ScoringPayload innerPayload = new ScoringPayload(pwinScore, decision);

        sendEvent(dossierId, "SCORING_COMPLETED", RabbitMQConfig.RK_SCORING_COMPLETED, innerPayload);

        log.info("[Publisher] SCORING_COMPLETED — dossier {} P-Win={:.1f}% {}", dossierId, pwinScore, decision);
    }

    public void publishMatchingCompleted(UUID dossierId, double tauxCompetences, double tauxExperts) {
        // 🚀 Utilisation du record typé
        MatchingPayload innerPayload = new MatchingPayload(tauxCompetences, tauxExperts);

        sendEvent(dossierId, "MATCHING_COMPLETED", RabbitMQConfig.RK_MATCHING_COMPLETED, innerPayload);

        log.info("[Publisher] MATCHING_COMPLETED — dossier {}", dossierId);
    }

    public void publishApoGenerated(UUID dossierId, String apoDocxPath, String methodoPath, String rapportPath, String packZipPath) {
        // 🚀 Fini les méthodes utilitaires "safe()", Jackson gère nativement les valeurs nulles ou textuelles complexes
        ApoPayload innerPayload = new ApoPayload(apoDocxPath, methodoPath, rapportPath, packZipPath);

        sendEvent(dossierId, "APO_GENERATED", RabbitMQConfig.RK_APO_GENERATED, innerPayload);

        log.info("[Publisher] APO_GENERATED — dossier {}", dossierId);
    }

    public void publishAuditGenerated(UUID dossierId, String auditReportPath) {
        AuditPayload innerPayload = new AuditPayload(auditReportPath);

        sendEvent(dossierId, "AUDIT_GENERATED", RabbitMQConfig.RK_AUDIT_GENERATED, innerPayload);

        log.info("[Publisher] AUDIT_GENERATED — dossier {}", dossierId);
    }

    // ── Orchestrateur centralisé d'envoi (Principe DRY : Don't Repeat Yourself) ──

    /**
     * Centralise la construction du message global et l'envoi vers RabbitMQ.
     */
    private void sendEvent(UUID dossierId, String eventType, String routingKey, Object innerPayload) {
        try {
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("dossierId", dossierId);
            envelope.put("eventType", eventType);

            // Convertit automatiquement n'importe quel payload d'événement en JSON sécurisé
            envelope.put("payload", objectMapper.writeValueAsString(innerPayload));
            envelope.put("timestamp", LocalDateTime.now().toString());

            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EXCHANGE_ANALYSTE,
                    routingKey,
                    envelope
            );
        } catch (Exception e) {
            log.error("[Publisher] Échec critique de sérialisation pour l'événement {}", eventType, e);
            throw new RuntimeException("Erreur de communication RabbitMQ", e);
        }
    }
}