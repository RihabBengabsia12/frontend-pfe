package tn.rihab.projectservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.rihab.projectservice.model.entity.AnonymizationDict;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AnonymizationDictRepository extends JpaRepository<AnonymizationDict, UUID> {
    Optional<AnonymizationDict> findByKeyword(String keyword);
    boolean existsByKeyword(String keyword);
}
