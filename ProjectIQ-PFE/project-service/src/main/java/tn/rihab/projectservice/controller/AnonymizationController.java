package tn.rihab.projectservice.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.rihab.projectservice.model.entity.AnonymizationDict;
import tn.rihab.projectservice.service.AnonymizationService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/anonymization")
@RequiredArgsConstructor
@Slf4j
public class AnonymizationController {

    private final AnonymizationService anonymizationService;

    @GetMapping("/dict")
    public ResponseEntity<List<AnonymizationDict>> getAll() {
        return ResponseEntity.ok(anonymizationService.getAll());
    }

    @PostMapping("/dict")
    public ResponseEntity<AnonymizationDict> addKeyword(@RequestParam String keyword) {
        log.info("[Admin] Ajout du mot-clé au dictionnaire DLP: {}", keyword);
        return ResponseEntity.ok(anonymizationService.addKeyword(keyword));
    }

    @DeleteMapping("/dict/{id}")
    public ResponseEntity<Void> removeKeyword(@PathVariable UUID id) {
        log.info("[Admin] Suppression mot-clé DLP ID: {}", id);
        anonymizationService.removeKeyword(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/dict/regenerate")
    public ResponseEntity<Void> regenerateCodes() {
        log.info("[Admin] Demande de regénération manuelle de tous les codes DLP");
        anonymizationService.forceRegenerateCodes();
        return ResponseEntity.ok().build();
    }

    /**
     * Endpoint utile pour les autres microservices (comme analyste-service) 
     * qui reçoivent des réponses IA avec des codes et doivent les démasquer.
     */
    @PostMapping("/unmask")
    public ResponseEntity<Map<String, String>> unmaskMap(@RequestBody Map<String, String> values) {
        return ResponseEntity.ok(anonymizationService.unmaskMap(values));
    }

    /**
     * Masquer un texte complet.
     */
    @PostMapping("/mask")
    public ResponseEntity<String> maskText(@RequestBody String text) {
        return ResponseEntity.ok(anonymizationService.mask(text));
    }
}
