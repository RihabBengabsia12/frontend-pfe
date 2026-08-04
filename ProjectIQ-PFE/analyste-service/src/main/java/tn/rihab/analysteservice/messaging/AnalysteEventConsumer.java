package  tn.rihab.analysteservice.messaging;

import tn.rihab.analysteservice.config.RabbitMQConfig;
import tn.rihab.analysteservice.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Consomme les événements publiés par project-service.
 *
 * dossier.indexed   → déclenche le pipeline complet Phase 2→3→4
 *                     (analyse + scoring + matching + APO + génération docs)
 * dossier.submitted → déclenche la génération du rapport d'audit Phase 6
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AnalysteEventConsumer {

    private final AnalyseDeepService     analyseDeepService;
    private final AuditGenerationService auditGenerationService;
    private final tn.rihab.analysteservice.repository.IaAuditLogRepository iaAuditLogRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @RabbitListener(queues = RabbitMQConfig.Q_IA_AUDIT_LOG)
    public void onIaAuditLog(Map<String, Object> event) {
        try {
            String raw = event.get("dossierId").toString();
            UUID dossierId = UUID.fromString(raw);
            if (event.containsKey("payload") && event.get("payload") != null) {
                String payloadStr = event.get("payload").toString();
                Map<String, Object> payload = objectMapper.readValue(payloadStr, Map.class);
                String actionName = payload.get("actionName") != null ? payload.get("actionName").toString() : "UNKNOWN";
                tn.rihab.analysteservice.model.IaAuditLog logEntry = tn.rihab.analysteservice.model.IaAuditLog.builder()
                        .dossierId(dossierId)
                        .actionName(actionName)
                        .tokenUsage(payload.get("token_usage") != null ? ((Number)payload.get("token_usage")).intValue() : null)
                        .processingTimeMs(payload.get("processing_time_ms") != null ? ((Number)payload.get("processing_time_ms")).intValue() : null)
                        .estimatedCost(payload.get("estimated_cost") != null ? ((Number)payload.get("estimated_cost")).doubleValue() : null)
                        .cacheCreationTokens(payload.get("cache_creation_tokens") != null ? ((Number)payload.get("cache_creation_tokens")).intValue() : null)
                        .cacheReadTokens(payload.get("cache_read_tokens") != null ? ((Number)payload.get("cache_read_tokens")).intValue() : null)
                        .build();
                iaAuditLogRepository.save(logEntry);
                log.info("[Consumer] IA_AUDIT_LOG sauvegardé pour {}, action: {}", dossierId, actionName);
            }
        } catch (Exception e) {
            log.error("[Consumer] Erreur sauvegarde IA_AUDIT_LOG : {}", e.getMessage(), e);
        }
    }

    @RabbitListener(queues = RabbitMQConfig.Q_DOSSIER_P1_EXTRACTED)
    public void onDossierP1Extracted(Map<String, Object> event) {
        String raw = event.get("dossierId").toString();
        UUID dossierId = UUID.fromString(raw);
        log.info("[Consumer] DOSSIER_P1_EXTRACTED reçu → pré-extraction Phase 2 pour {}", dossierId);
        
        try {
            analyseDeepService.preExtractPhase2(dossierId);
        } catch (Exception e) {
            log.error("[Consumer] Erreur pré-extraction dossier {} : {}", dossierId, e.getMessage(), e);
        }
    }

    /**
     * Déclenché quand project-service publie DossierIndexed.
     * Lance séquentiellement Phase 2 → scoring → matching → APO → docs.
     *
     * Payload : { "dossierId": "uuid", "eventType": "DOSSIER_INDEXED" }
     */
    @RabbitListener(queues = RabbitMQConfig.Q_DOSSIER_INDEXED)
    public void onDossierIndexed(Map<String, Object> event) {
        String raw = event.get("dossierId").toString();
        UUID dossierId = UUID.fromString(raw);
        log.info("[Consumer] DOSSIER_INDEXED reçu → lancement pipeline Phase 2-4 pour {}", dossierId);
        try {
            analyseDeepService.runFullPipeline(dossierId);
        } catch (Exception e) {
            log.error("[Consumer] Erreur pipeline dossier {} : {}", dossierId, e.getMessage(), e);
        }
    }

    /**
     * Déclenché quand project-service publie DossierSubmitted.
     * Lance la génération du rapport d'audit Phase 6.
     */
    @RabbitListener(queues = RabbitMQConfig.Q_DOSSIER_SUBMITTED)
    public void onDossierSubmitted(Map<String, Object> event) {
        String raw = event.get("dossierId").toString();
        UUID dossierId = UUID.fromString(raw);
        log.info("[Consumer] DOSSIER_SUBMITTED reçu → génération rapport audit pour {}", dossierId);
        try {
            auditGenerationService.generateAuditReport(dossierId);
        } catch (Exception e) {
            log.error("[Consumer] Erreur audit dossier {} : {}", dossierId, e.getMessage(), e);
        }
    }
}