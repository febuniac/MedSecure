exports.up = function(knex) {
  return knex.schema.createTable('provider_patient_assignments', (table) => {
    table.increments('id').primary();
    table.integer('provider_id').notNullable().references('id').inTable('providers').onDelete('CASCADE');
    table.integer('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.integer('assigned_by').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['provider_id', 'patient_id', 'status']);
    table.index(['provider_id', 'status']);
    table.index(['patient_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('provider_patient_assignments');
};
