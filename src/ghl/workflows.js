'use strict';

const logger = require('../utils/logger');

/**
 * Map deal type → GHL Workflow ID from environment variables.
 */
function getWorkflowId(dealType) {
  const map = {
    switch:    process.env.GHL_WORKFLOW_SWITCH,
    refinance: process.env.GHL_WORKFLOW_REFINANCE,
    purchase:  process.env.GHL_WORKFLOW_PURCHASE,
  };

  const workflowId = map[dealType?.toLowerCase()];
  if (!workflowId) {
    throw new Error(
      `No workflow ID configured for deal type "${dealType}". ` +
        `Check GHL_WORKFLOW_SWITCH / REFINANCE / PURCHASE env vars.`
    );
  }
  return workflowId;
}

/**
 * Enroll a GHL contact into the workflow corresponding to their deal type.
 *
 * @param {object} ghl       - Authenticated GHL axios client
 * @param {string} contactId
 * @param {string} dealType  - "switch" | "refinance" | "purchase"
 */
async function enrollInWorkflow(ghl, contactId, dealType) {
  const workflowId = getWorkflowId(dealType);

  logger.info(
    `Enrolling contact ${contactId} in workflow ${workflowId} (deal type: ${dealType})`
  );

  await ghl.post(`/contacts/${contactId}/workflow/${workflowId}/subscribe`, {
    eventStartTime: new Date().toISOString(),
  });

  logger.info(
    `Contact ${contactId} enrolled in ${dealType} workflow (${workflowId}) successfully.`
  );
}

module.exports = { enrollInWorkflow, getWorkflowId };
