import React, { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NavSection } from '../App';

function AccordionSidebarHarness() {
  const [openSection, setOpenSection] = useState<string | null>('financial');
  const toggleSection = (sectionKey: string) => {
    setOpenSection(prev => (prev === sectionKey ? null : sectionKey));
  };

  return (
    <div>
      <NavSection
        label="Finance"
        isOpen={openSection === 'financial'}
        onToggle={() => toggleSection('financial')}
        compact={false}
      >
        <div>Finance Content</div>
      </NavSection>

      <NavSection
        label="Accounts Payable"
        isOpen={openSection === 'apOperations'}
        onToggle={() => toggleSection('apOperations')}
        compact={false}
      >
        <div>AP Content</div>
      </NavSection>

      <NavSection
        label="Purchases"
        isOpen={openSection === 'purchases'}
        onToggle={() => toggleSection('purchases')}
        compact={false}
      >
        <div>Purchases Content</div>
      </NavSection>
    </div>
  );
}

describe('Sidebar Accordion Behavior', () => {
  afterEach(() => {
    cleanup();
  });

  it('only expands one dropdown module at a time by default with graceful slide state', () => {
    render(<AccordionSidebarHarness />);

    const financeBtn = screen.getByRole('button', { name: /Finance/i });
    const apBtn = screen.getByRole('button', { name: /Accounts Payable/i });
    const purchasesBtn = screen.getByRole('button', { name: /Purchases/i });

    expect(financeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(apBtn).toHaveAttribute('aria-expanded', 'false');
    expect(purchasesBtn).toHaveAttribute('aria-expanded', 'false');

    // Check sliding container attributes
    const financeContainer = financeBtn.nextElementSibling;
    const apContainer = apBtn.nextElementSibling;
    const purchasesContainer = purchasesBtn.nextElementSibling;

    expect(financeContainer).toHaveAttribute('aria-hidden', 'false');
    expect(financeContainer?.className).toContain('grid-rows-[1fr]');
    expect(apContainer).toHaveAttribute('aria-hidden', 'true');
    expect(apContainer?.className).toContain('grid-rows-[0fr]');
    expect(purchasesContainer).toHaveAttribute('aria-hidden', 'true');
    expect(purchasesContainer?.className).toContain('grid-rows-[0fr]');
  });

  it('closes the open dropdown when another dropdown is accessed', () => {
    render(<AccordionSidebarHarness />);

    const financeBtn = screen.getByRole('button', { name: /Finance/i });
    const apBtn = screen.getByRole('button', { name: /Accounts Payable/i });
    const purchasesBtn = screen.getByRole('button', { name: /Purchases/i });

    const financeContainer = financeBtn.nextElementSibling;
    const apContainer = apBtn.nextElementSibling;
    const purchasesContainer = purchasesBtn.nextElementSibling;

    // Initially Finance is open
    expect(financeBtn).toHaveAttribute('aria-expanded', 'true');

    // User clicks Accounts Payable
    fireEvent.click(apBtn);

    // Now AP is open, Finance and Purchases are closed
    expect(financeBtn).toHaveAttribute('aria-expanded', 'false');
    expect(financeContainer?.className).toContain('grid-rows-[0fr]');
    expect(apBtn).toHaveAttribute('aria-expanded', 'true');
    expect(apContainer?.className).toContain('grid-rows-[1fr]');
    expect(purchasesBtn).toHaveAttribute('aria-expanded', 'false');
    expect(purchasesContainer?.className).toContain('grid-rows-[0fr]');

    // User clicks Purchases
    fireEvent.click(purchasesBtn);

    // Now Purchases is open, AP and Finance are closed
    expect(financeBtn).toHaveAttribute('aria-expanded', 'false');
    expect(apBtn).toHaveAttribute('aria-expanded', 'false');
    expect(purchasesBtn).toHaveAttribute('aria-expanded', 'true');
    expect(purchasesContainer?.className).toContain('grid-rows-[1fr]');
  });

  it('closes the open dropdown when clicked again (toggled off)', () => {
    render(<AccordionSidebarHarness />);

    const financeBtn = screen.getByRole('button', { name: /Finance/i });
    const financeContainer = financeBtn.nextElementSibling;

    // Initially Finance is open
    expect(financeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(financeContainer?.className).toContain('grid-rows-[1fr]');

    // User clicks Finance again
    fireEvent.click(financeBtn);

    // All dropdowns are closed
    expect(financeBtn).toHaveAttribute('aria-expanded', 'false');
    expect(financeContainer?.className).toContain('grid-rows-[0fr]');
    expect(financeContainer).toHaveAttribute('aria-hidden', 'true');
  });
});
