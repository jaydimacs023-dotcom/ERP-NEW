import React from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal renders its children directly into document.body via React Portal.
 * This ensures modal overlays and backdrop-blur cover the ENTIRE viewport,
 * including the header and sidebar, regardless of parent overflow/z-index constraints.
 */
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

export default ModalPortal;
