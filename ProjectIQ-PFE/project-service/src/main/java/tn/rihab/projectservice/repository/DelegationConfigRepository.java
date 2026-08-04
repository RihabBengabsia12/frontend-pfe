package tn.rihab.projectservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.rihab.projectservice.model.entity.DelegationConfig;

@Repository
public interface DelegationConfigRepository extends JpaRepository<DelegationConfig, Long> {
}
