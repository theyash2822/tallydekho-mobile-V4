import { VoucherDocument } from '../../types/document';
import {
  CommercialPrintModel,
  CommercialChargeLine,
  CommercialDocumentType,
  Money,
} from './CommercialPrintModel';
import {
  isCommercialDocumentType,
  toCommercialPrintModel,
  commercialTitle,
} from './CommercialPrintModelAdapter';
import {
  validateCommercialPrintModel,
  CommercialPrintValidationError,
} from './CommercialPrintValidator';
import {
  CommercialTemplateId,
  DEFAULT_COMMERCIAL_TEMPLATE_ID,
  DEFAULT,
  resolveCommercialTemplateId,
  TEMPLATE_DISPLAY,
  COMMERCIAL_TEMPLATE_IDS,
} from './templateIds';
import { renderTallyClassicCommercial } from './templates/tallyClassicCommercial';
import { renderTdThermalCommercial } from './templates/tdThermalCommercial';
import { renderTdExecutiveCommercial } from './templates/tdExecutiveCommercial';
import { ThermalPaperWidth } from '../pdf/thermalShared';

export type {
  CommercialPrintModel,
  CommercialChargeLine,
  CommercialDocumentType,
  CommercialTemplateId,
  Money,
};
export {
  isCommercialDocumentType,
  toCommercialPrintModel,
  commercialTitle,
  validateCommercialPrintModel,
  CommercialPrintValidationError,
  resolveCommercialTemplateId,
  DEFAULT_COMMERCIAL_TEMPLATE_ID,
  DEFAULT,
  TEMPLATE_DISPLAY,
  COMMERCIAL_TEMPLATE_IDS,
};

const registry: Record<
  CommercialTemplateId,
  (model: CommercialPrintModel, opts?: { paperWidth?: ThermalPaperWidth }) => string
> = {
  tally_classic_commercial_v1: (m) => renderTallyClassicCommercial(m),
  td_thermal_commercial_v1: (m, opts) => renderTdThermalCommercial(m, opts),
  td_executive_commercial_v1: (m) => renderTdExecutiveCommercial(m),
};

export function renderCommercialPrintHtml(
  model: CommercialPrintModel,
  templateId: CommercialTemplateId = DEFAULT_COMMERCIAL_TEMPLATE_ID,
  opts: { paperWidth?: ThermalPaperWidth } = {}
): string {
  validateCommercialPrintModel(model);
  const render = registry[templateId] || registry[DEFAULT_COMMERCIAL_TEMPLATE_ID];
  return render(model, opts);
}

/**
 * End-to-end: VoucherDocument → print model → HTML for the chosen template.
 */
export function renderCommercialDocumentHtml(
  doc: VoucherDocument,
  opts: {
    templateId?: string | number | null;
    companyGuid?: string;
    tenantId?: string;
    logoUri?: string | null;
    terms?: string[];
    qrImage?: string | null;
    bankInfo?: { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null } | null;
    paperWidth?: ThermalPaperWidth;
  } = {}
): string {
  if (!isCommercialDocumentType(doc.documentType)) {
    throw new Error(`Not a commercial document: ${doc.documentType}`);
  }
  const model = toCommercialPrintModel(doc, {
    companyGuid: opts.companyGuid,
    tenantId: opts.tenantId,
    logoUrl: opts.logoUri ?? null,
  });
  // Settings voucher-config terms override / append when present.
  if (opts.terms && opts.terms.length) {
    const fromSettings = opts.terms.filter(Boolean).join('\n');
    model.terms = model.terms ? `${model.terms}\n${fromSettings}` : fromSettings;
  }
  if (opts.bankInfo) {
    (model as any)._bankInfo = opts.bankInfo;
  }
  if (opts.qrImage) {
    (model as any)._qrImage = opts.qrImage;
  }
  const templateId = resolveCommercialTemplateId(opts.templateId);
  return renderCommercialPrintHtml(model, templateId, { paperWidth: opts.paperWidth });
}
