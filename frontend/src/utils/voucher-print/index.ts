import { VoucherDocument } from '../../types/document';
import { VoucherPrintModel } from './VoucherPrintModel';
import { toVoucherPrintModel, isAccountingVoucherType } from './VoucherPrintModelAdapter';
import { validateVoucherPrintModel, VoucherPrintValidationError } from './VoucherPrintValidator';
import {
  VoucherTemplateId,
  DEFAULT_VOUCHER_TEMPLATE_ID,
  resolveVoucherTemplateId,
  TEMPLATE_DISPLAY,
} from './templateIds';
import { renderTallyClassic } from './templates/tallyClassic';
import { renderTallyDekhoThermal } from './templates/tdThermal';
import { renderTallyDekhoExecutive } from './templates/tdExecutive';
import { ThermalPaperWidth } from '../pdf/thermalShared';

export type { VoucherPrintModel, VoucherTemplateId };
export {
  isAccountingVoucherType,
  toVoucherPrintModel,
  validateVoucherPrintModel,
  VoucherPrintValidationError,
  resolveVoucherTemplateId,
  DEFAULT_VOUCHER_TEMPLATE_ID,
  TEMPLATE_DISPLAY,
};

export const voucherPdfTemplates = {
  tally_classic_v1: renderTallyClassic,
  td_thermal_v1: renderTallyDekhoThermal,
  td_executive_v1: renderTallyDekhoExecutive,
} as const;

export function renderVoucherPrintHtml(
  model: VoucherPrintModel,
  templateId: VoucherTemplateId = DEFAULT_VOUCHER_TEMPLATE_ID,
  opts: { paperWidth?: ThermalPaperWidth } = {}
): string {
  validateVoucherPrintModel(model);
  if (templateId === 'td_thermal_v1') {
    return renderTallyDekhoThermal(model, opts);
  }
  const render = voucherPdfTemplates[templateId] || voucherPdfTemplates[DEFAULT_VOUCHER_TEMPLATE_ID];
  return render(model);
}

/**
 * End-to-end: VoucherDocument → print model → HTML for the chosen template.
 */
export function renderAccountingVoucherHtml(
  doc: VoucherDocument,
  opts: {
    templateId?: string | number | null;
    companyGuid?: string | null;
    showReceiver?: boolean;
    paperWidth?: ThermalPaperWidth;
  } = {}
): string {
  if (!isAccountingVoucherType(doc.documentType)) {
    throw new Error(`Not an accounting voucher: ${doc.documentType}`);
  }
  const model = toVoucherPrintModel(doc, {
    companyGuid: opts.companyGuid,
    showReceiver: opts.showReceiver,
  });
  const templateId = resolveVoucherTemplateId(opts.templateId);
  return renderVoucherPrintHtml(model, templateId, { paperWidth: opts.paperWidth });
}
