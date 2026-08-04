package tn.rihab.projectservice.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.rihab.projectservice.model.entity.DelegationConfig;
import tn.rihab.projectservice.service.DelegationConfigService;

/**
 * Endpoints pour l'administration de la matrice de délégation et des contacts.
 * Base URL: /api/config/delegation
 */
@RestController
@RequestMapping("/api/config/delegation")
@RequiredArgsConstructor
public class DelegationConfigController {

    private final DelegationConfigService delegationConfigService;

    /**
     * Récupère la configuration actuelle.
     */
    @GetMapping
    public ResponseEntity<DelegationConfig> getConfig() {
        return ResponseEntity.ok(delegationConfigService.getCurrentConfig());
    }

    /**
     * Met à jour la configuration.
     */
    @PutMapping
    public ResponseEntity<DelegationConfig> updateConfig(@RequestBody DelegationConfig config) {
        return ResponseEntity.ok(delegationConfigService.updateConfig(config));
    }
}
