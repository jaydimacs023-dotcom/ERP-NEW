import { TaxType, InvoiceLine } from '../types';

export class VatService {
    private static readonly DEFAULT_VAT_RATE = 0.12;

    /**
     * Round a number to 2 decimal places.
     */
    private static round(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    /**
     * Compute VAT components for a single line item.
     * 
     * @param quantity Item quantity
     * @param unitPrice Unit price
     * @param taxType VAT, NON_VAT, or ZERO_RATED (Exempt treat as NON_VAT in this context)
     * @param isInclusive Whether the unit price is already VAT inclusive
     * @param vatRate The VAT rate to apply (default 12%)
     */
    static computeLineVat(
        quantity: number,
        unitPrice: number,
        taxType: TaxType | 'EXEMPT' | undefined,
        isInclusive: boolean = true,
        vatRate: number = VatService.DEFAULT_VAT_RATE
    ): { netAmount: number; vatAmount: number; grossAmount: number } {
        const qty = quantity || 0;
        const price = unitPrice || 0;

        // If VAT EXEMPT or Non-VAT
        if (taxType === 'NON_VAT' || taxType === 'ZERO_RATED' || taxType === 'EXEMPT' || !taxType) {
            const net = this.round(qty * price);
            return {
                netAmount: net,
                vatAmount: 0,
                grossAmount: net
            };
        }

        // VAT Registered (VAT)
        if (isInclusive) {
            // VAT INCLUSIVE:
            // gross = quantity × unit_price
            // net = gross / (1 + vat_rate)
            // vat = gross - net
            const gross = this.round(qty * price);
            const net = this.round(gross / (1 + vatRate));
            const vat = this.round(gross - net);

            return {
                netAmount: net,
                vatAmount: vat,
                grossAmount: gross
            };
        } else {
            // VAT EXCLUSIVE:
            // net = quantity × unit_price
            // vat = net × vat_rate
            // gross = net + vat
            const net = this.round(qty * price);
            const vat = this.round(net * vatRate);
            const gross = this.round(net + vat);

            return {
                netAmount: net,
                vatAmount: vat,
                grossAmount: gross
            };
        }
    }

    /**
     * Calculate overall totals for an array of invoice lines.
     */
    static calculateTotals(lines: InvoiceLine[]) {
        const subtotal = lines.reduce((sum, line) => sum + (line.netAmount || 0), 0);
        const totalVat = lines.reduce((sum, line) => sum + (line.vatAmount || 0), 0);
        const totalAmount = lines.reduce((sum, line) => sum + (line.grossAmount || 0), 0);

        return {
            subtotal: this.round(subtotal),
            vatAmount: this.round(totalVat),
            grandTotal: this.round(totalAmount)
        };
    }
}
