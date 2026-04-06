/**
 * Migration: Add ssn_hash column for duplicate SSN detection.
 *
 * The ssn_encrypted column uses random salt/IV, producing different ciphertext
 * for the same SSN. This deterministic HMAC-SHA256 hash enables efficient
 * duplicate detection without exposing the raw SSN.
 *
 * Fixes: GitHub Issue #81
 */
exports.up = function (knex) {
  return knex.schema.alterTable('patients', (table) => {
    table.string('ssn_hash', 64).nullable().unique();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('patients', (table) => {
    table.dropColumn('ssn_hash');
  });
};
