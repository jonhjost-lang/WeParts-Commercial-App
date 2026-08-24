/**
 * Persistence of a recognized purchase order.
 *
 * NOT IMPLEMENTED ON PURPOSE — the target tables do not exist in Dataverse.
 * This is the extension point the rest of the feature is built against, so the
 * flow works end to end up to human review and stops at a clear, honest edge
 * instead of pretending to save.
 *
 * TO ENABLE
 * ---------
 * 1. Create the three tables in Power Apps. Take the column list from the
 *    mapping in docs/po-upload (the reference package), NOT from section 5 of
 *    the technical spec: the spec's table omits five columns the code writes.
 *    Note the spec's own typo — the column is wep_supplierref, and the
 *    reference package writes wep_suppliderref.
 * 2. Generate the services:
 *      pac code add-data-source -a dataverse -t wep_purchaseorder
 *      pac code add-data-source -a dataverse -t wep_purchaseorderline
 *      pac code add-data-source -a dataverse -t wep_poimportlog
 * 3. Implement importPurchaseOrder below against the generated services.
 *
 * TWO THINGS TO SETTLE BEFORE WRITING
 * -----------------------------------
 * - There is no multi-table transaction on the client. If the header saves and
 *   the fourth line fails, the environment keeps a partial order. The reference
 *   package rolls back by hand; the spec recommends a Custom API
 *   (wep_ImportPurchaseOrder) writing header and lines server-side, atomically.
 * - Choice values are magic numbers in the reference mapping and must match the
 *   option set actually created.
 *
 * Confirm the publisher prefix too: existing tables use cr720_, the spec
 * proposes wep_.
 */

import type { PoData } from '../lib/poParser';

export interface ImportOutcome {
  ok: boolean;
  code: 'NOT_CONFIGURED' | 'IMPORTED' | 'DUPLICATE' | 'WRITE_FAILED';
  message: string;
  headerId?: string;
  lineCount?: number;
}

export function isImportEnabled(): boolean {
  return false;
}

export async function importPurchaseOrder(data: PoData): Promise<ImportOutcome> {
  return {
    ok: false,
    code: 'NOT_CONFIGURED',
    message: `${data.header.poNumber ?? 'This purchase order'} was read and validated, but saving is not enabled yet: the purchase order tables do not exist in Dataverse.`,
    lineCount: data.items.length,
  };
}
