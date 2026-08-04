package tn.rihab.projectservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.rihab.projectservice.messaging.EventPublisher;
import tn.rihab.projectservice.model.DossierStatus;
import tn.rihab.projectservice.model.entity.Dossier;
import tn.rihab.projectservice.model.entity.ValidationToken;
import tn.rihab.projectservice.repository.DossierRepository;
import tn.rihab.projectservice.repository.ValidationTokenRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ValidationService {

    private final DossierRepository         dossierRepository;
    private final ValidationTokenRepository tokenRepository;
    private final ValidationTokenService    tokenService; // <--- CORRIGÉ : Utilise ton service métier
    private final EmailService              emailService;
    private final EventPublisher            eventPublisher;
    private final AuditTrailService         auditTrailService;

    @Value("${delegation.seuil.dda:500000}")
    private Double seuilDDA;
    @Value("${delegation.seuil.dga:2000000}")
    private Double seuilDGA;
    @Value("${delegation.seuil.pdg:10000000}")
    private Double seuilPDG;

    @Value("${delegation.email.do:do@egis.fr}")
    private String emailDO;
    @Value("${delegation.email.dda:dda@egis.fr}")
    private String emailDDA;
    @Value("${delegation.email.dga:dga@egis.fr}")
    private String emailDGA;
    @Value("${delegation.email.pdg:pdg@egis.fr}")
    private String emailPDG;

    @Value("${delegation.nom.do:Direction de l'Offre}")
    private String nomDO;
    @Value("${delegation.nom.dda:Direction du Développement des Affaires}")
    private String nomDDA;
    @Value("${delegation.nom.dga:Direction Générale Adjointe}")
    private String nomDGA;
    @Value("${delegation.nom.pdg:Président Directeur Général}")
    private String nomPDG;

    @Transactional
    public List<ValidationToken> sendToValidators(UUID dossierId) {
        Dossier dossier = findDossier(dossierId);

        if (dossier.getStatus() != DossierStatus.PACK_READY) {
            throw new IllegalStateException("Le pack de soumission doit être prêt.");
        }

        tokenRepository.findByDossierIdAndStatus(dossierId, "PENDING")
                .forEach(t -> {
                    t.setStatus("CANCELLED");
                    tokenRepository.save(t);
                });

        List<ValidationToken> tokens = new ArrayList<>();
        double budget = extractBudgetAmount(dossier.getBudgetGlobal());

        tokens.add(tokenService.generate(dossierId, "DO", emailDO, nomDO));
        if (budget > seuilDDA) tokens.add(tokenService.generate(dossierId, "DDA", emailDDA, nomDDA));
        if (budget > seuilDGA) tokens.add(tokenService.generate(dossierId, "DGA", emailDGA, nomDGA));
        if (budget > seuilPDG) tokens.add(tokenService.generate(dossierId, "PDG", emailPDG, nomPDG));

        tokens.forEach(token -> emailService.sendValidationEmail(token, dossier));

        dossier.setStatus(DossierStatus.PENDING_VALIDATION);
        dossierRepository.save(dossier);

        auditTrailService.log(dossierId, "VALIDATION_SENT", "system",
                String.format("{\"validateurs\":%d}", tokens.size()), DossierStatus.PENDING_VALIDATION);

        return tokens;
    }

    @Transactional
    public String processAction(String tokenStr, String action, String commentaire) {
        ValidationToken token = tokenService.recordAction(tokenStr, action, commentaire);
        UUID dossierId = token.getDossierId();
        Dossier dossier = findDossier(dossierId);

        if ("REJECTED".equals(action)) {
            dossier.setStatus(DossierStatus.PACK_READY);
            dossierRepository.save(dossier);
            return "Votre rejet a été enregistré.";
        }

        if (allValidatorsApproved(dossierId)) {
            dossier.setStatus(DossierStatus.SUBMITTED);
            dossierRepository.save(dossier);
            eventPublisher.publishDossierSubmitted(dossierId);
            return "Toutes les validations sont obtenues.";
        }

        return "Approbation enregistrée.";
    }

    private boolean allValidatorsApproved(UUID dossierId) {
        List<ValidationToken> actifs = tokenRepository.findByDossierId(dossierId).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        return !actifs.isEmpty() && actifs.stream().allMatch(t -> "APPROVED".equals(t.getStatus()));
    }

    private double extractBudgetAmount(String budgetGlobal) {
        try {
            return budgetGlobal == null ? 0 : Double.parseDouble(budgetGlobal.replaceAll("[^0-9.]", ""));
        } catch (Exception e) { return 0; }
    }

    private Dossier findDossier(UUID id) {
        return dossierRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Dossier non trouvé"));
    }

    // Ajoute ceci dans ValidationService.java pour satisfaire le contrôleur
    public List<ValidationToken> getValidationStatus(UUID dossierId) {
        return tokenRepository.findAllByDossierIdOrdered(dossierId);
    }

    @Transactional
    public void sendReminder(UUID dossierId, String role) {
        Dossier dossier = findDossier(dossierId);
        tokenRepository.findByDossierIdAndStatus(dossierId, "PENDING").stream()
                .filter(t -> role.equals(t.getValidateurRole()))
                .findFirst()
                .ifPresentOrElse(
                        t -> emailService.sendReminderEmail(t, dossier),
                        () -> { throw new IllegalArgumentException("Aucun token PENDING pour le rôle : " + role); }
                );
        auditTrailService.log(dossierId, "REMINDER_SENT", "user", "{\"role\":\"" + role + "\"}", null);
    }

    @Scheduled(fixedDelay = 3_600_000)
    public void expireOldTokens() {
        tokenService.expireOldTokens();
    }
}