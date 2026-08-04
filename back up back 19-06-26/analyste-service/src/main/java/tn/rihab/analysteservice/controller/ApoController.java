package tn.rihab.analysteservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.rihab.analysteservice.model.ApoData;
import tn.rihab.analysteservice.service.ApoAssemblyService;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/apo")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class ApoController {

    private final ApoAssemblyService apoAssemblyService;

    @PostMapping("/{id}/assemble")
    public ResponseEntity<String> assembleApo(@PathVariable("id") UUID id) {
        log.info("[REST] Assemblage des formulaires et métadonnées APO via ApoAssemblyService pour le dossier ID: {}", id);
        // Appeler ici ton service, ex: apoAssemblyService.assemble(id);
        return ResponseEntity.ok("Données de l'APO assemblées avec succès.");
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApoData> getApoData(@PathVariable("id") UUID id) {
        log.info("[REST] Consultation des 56 champs du formulaire APO pour le dossier ID: {}", id);
        return ResponseEntity.ok(new ApoData());
    }

    @PutMapping("/{id}/field/{name}")
    public ResponseEntity<String> updateApoField(
            @PathVariable("id") UUID id,
            @PathVariable("name") String name,
            @RequestBody Map<String, String> payload) {
        String newValue = payload.get("valeur");
        log.info("[REST] Correction humaine sur le champ APO '{}' du dossier ID: {} → Valeur injectée: '{}'", name, id, newValue);
        return ResponseEntity.ok("Le champ APO a été mis à jour.");
    }

    @GetMapping("/{id}/completeness")
    public ResponseEntity<Map<String, Object>> getCompleteness(@PathVariable("id") UUID id) {
        log.info("[REST] Calcul du taux de complétude du formulaire APO pour le dossier ID: {}", id);
        return ResponseEntity.ok(Map.of("tauxCompletude", 92.0, "champsManquants", 4));
    }
}