package tn.rihab.projectservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import tn.rihab.projectservice.config.RabbitMQConfig;
import tn.rihab.projectservice.messaging.dto.DossierEvent;

import java.util.UUID;

/**
 * Publie des événements RabbitMQ depuis project-service.
 *
 * Événements publiés :
 *   DossierIndexed    → analyste-service démarre Phase 2
 *   DossierSubmitted  → analyste-service génère le rapport d'audit
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventPublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publié quand l'utilisateur valide les 12 champs Phase 1
     * et que le dossier passe en statut INDEXED.
     * analyste-service consomme cet événement pour démarrer
     * l'extraction Phase 2, le scoring et le matching.
     */
    public void publishDossierIndexed(UUID dossierId) {
        DossierEvent event = DossierEvent.builder()
                .dossierId(dossierId)
                .eventType("DOSSIER_INDEXED")
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_DOSSIER,
                RabbitMQConfig.RK_DOSSIER_INDEXED,
                event
        );

        log.info("[RabbitMQ] Publié DOSSIER_INDEXED pour dossier {}", dossierId);
    }

    public void publishPhase1Extracted(UUID dossierId, tn.rihab.projectservice.dto.ExtractionResponseDto extraction) {
        String payload = null;
        if (extraction != null && extraction.getToken_usage() != null) {
            payload = String.format(java.util.Locale.US, "{\"token_usage\":%d,\"processing_time_ms\":%d,\"estimated_cost\":%f,\"cache_creation_tokens\":%d,\"cache_read_tokens\":%d}",
                    extraction.getToken_usage(),
                    extraction.getProcessing_time_ms(),
                    extraction.getEstimated_cost(),
                    extraction.getCache_creation_tokens(),
                    extraction.getCache_read_tokens());
        }

        DossierEvent event = DossierEvent.builder()
                .dossierId(dossierId)
                .eventType("DOSSIER_P1_EXTRACTED")
                .payload(payload)
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_DOSSIER,
                RabbitMQConfig.RK_DOSSIER_P1_EXTRACTED,
                event
        );

        log.info("[RabbitMQ] Publié DOSSIER_P1_EXTRACTED pour déclencher l'extraction Phase 2 en arrière-plan {}", dossierId);
    }

    public void publishIaAuditLog(UUID dossierId, String actionName, tn.rihab.projectservice.dto.ExtractionResponseDto extraction) {
        if (extraction == null || extraction.getToken_usage() == null) return;
        
        String payload = String.format(java.util.Locale.US, "{\"actionName\":\"%s\",\"token_usage\":%d,\"processing_time_ms\":%d,\"estimated_cost\":%f,\"cache_creation_tokens\":%d,\"cache_read_tokens\":%d}",
                actionName,
                extraction.getToken_usage(),
                extraction.getProcessing_time_ms(),
                extraction.getEstimated_cost(),
                extraction.getCache_creation_tokens(),
                extraction.getCache_read_tokens());

        DossierEvent event = DossierEvent.builder()
                .dossierId(dossierId)
                .eventType("IA_AUDIT_LOG")
                .payload(payload)
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_DOSSIER,
                RabbitMQConfig.RK_IA_AUDIT_LOG,
                event
        );
        log.info("[RabbitMQ] Publié IA_AUDIT_LOG pour dossier {}", dossierId);
    }

    /**
     * Publié quand toutes les validations hiérarchiques sont reçues
     * et que le dossier passe en statut SUBMITTED.
     * analyste-service consomme cet événement pour générer le rapport d'audit.
     */
    public void publishDossierSubmitted(UUID dossierId) {
        DossierEvent event = DossierEvent.builder()
                .dossierId(dossierId)
                .eventType("DOSSIER_SUBMITTED")
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE_DOSSIER,
                RabbitMQConfig.RK_DOSSIER_SUBMITTED,
                event
        );

        log.info("[RabbitMQ] Publié DOSSIER_SUBMITTED pour dossier {}", dossierId);
    }
}